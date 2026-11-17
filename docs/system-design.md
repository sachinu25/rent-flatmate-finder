# System design

_Rent & Flatmate Finder — developed by Sachin Upadhyay._

## 1. Architecture

```
                         ┌──────────────────────────── Vercel ───────────────────────────┐
 Browser ──HTTPS──────▶  │ Next.js 16 (App Router, React 19)                              │
   │                     │  • RSC pages (landing, listing detail, sitemap) fetch the API  │
   │                     │  • rewrites: /api/* and /uploads/* ──▶ BACKEND_URL             │
   │                     └───────────────────────────────┬───────────────────────────────┘
   │                                                     │ HTTPS (proxied, same-origin for the browser)
   │  WSS (Socket.IO, bearer token)                      ▼
   └────────────────────────────────────────▶ ┌──────────── Render (persistent Node) ───────┐
                                              │ Express 4 REST API  +  Socket.IO server      │
                                              │ Prisma ORM · Zod · Pino · helmet · rate limit │
                                              └──────┬─────────────┬──────────┬───────────────┘
                                                     │             │          │
                                     Neon PostgreSQL ◀┘   Cloudinary ◀┘   Resend / OpenAI / Anthropic
```

**Why not run Express on Vercel?** Socket.IO needs a long-lived process holding
WebSocket connections and in-memory rooms/presence. Vercel Functions are
request-scoped and cannot hold WebSockets, so the API runs as one persistent service
(Render, Railway or Fly.io all work) and the Next.js frontend runs on Vercel.

**Why proxy `/api` through Next.js?** The refresh token lives in an httpOnly cookie.
Proxying makes that cookie first-party to the site (no third-party-cookie blocking,
`SameSite=Lax` works) and removes browser CORS for REST. WebSockets can't be proxied
by Vercel, so the socket connects directly to the API with a short-lived bearer token.
Multipart photo uploads also go directly to the API (bearer token, no cookies) so they are not
subject to proxy request-size limits. API responses default to `Cache-Control: private, no-store`
so Vercel's proxy cache never stores personalised data.

## 2. Authentication & sessions

| Token | Lifetime | Storage | Notes |
|---|---|---|---|
| Access (JWT HS256, `typ=access`, iss/aud pinned) | 15 min | JS memory only | Sent as `Authorization: Bearer`; also used for the socket handshake |
| Refresh (opaque, 48 random bytes) | 30 days | httpOnly, `Secure`, `SameSite=Lax`, `Path=/api/auth` cookie | DB stores only SHA-256 |

- **Rotation**: every `/auth/refresh` marks the presented token as replaced and issues a new
  one in the same *family*. A conditional update prevents two concurrent refreshes both winning.
- **Reuse detection**: presenting a replaced/revoked token revokes the whole family.
- **CSRF**: refresh requires `X-Requested-With: fetch` (cannot be sent by cross-site forms)
  in addition to `SameSite=Lax`.
- **Logout / password change / admin deactivation** revoke refresh tokens server-side.
- Every authenticated request reloads the user, so deactivation takes effect immediately.
- Login runs bcrypt even for unknown emails (no user enumeration by timing) and returns a
  single generic error.

## 3. Compatibility engine

See [ADR-002](adr/002-compatibility-v2.md). In short: instant rule-based scores
(cached by content hash) everywhere, AI analysis only on explicit request, with schema
validation and labelled fallback.

## 4. Real-time chat & notifications

- Rooms: `user:{id}` (personal) and `conversation:{id}` (joined only after
  `getAuthorizedConversation` verifies the user is the tenant or listing owner and the
  interest is `ACCEPTED`).
- Events: `message:send` (ack-based, ≤ 2000 chars, token-bucket rate limit, authorization
  re-checked on every send), `message:new`, `chat:activity` (to personal rooms, keeps lists
  and badges fresh), `typing:start/stop` and `messages:markRead` (only inside joined rooms),
  `messages:read`, `presence:update`, `notification:new`.
- Presence is an in-memory connection count — accurate for a single API instance. For
  multiple instances add the Socket.IO Redis adapter and move presence to Redis.
- A `NEW_MESSAGE` notification is created only when the recipient isn't viewing the
  conversation and has no unread message-notification for it already (no spam).
- Notification types: interest received/accepted/declined, new message, new match
  (rule-based score ≥ `HIGH_SCORE_THRESHOLD` when a listing is published), listing
  updated (rent/availability change → tenants who saved or requested it), listing filled.
- Email (Resend HTTPS API or SMTP) is fire-and-forget; failures are logged, never thrown.
  All user-supplied values are HTML-escaped in templates.

## 5. Data integrity

- Interest creation relies on the `(tenantId, listingId)` unique constraint — concurrent
  duplicates yield one `201` and one `409`.
- Accept/decline runs in a transaction with a conditional `updateMany … where status=PENDING`;
  only one concurrent resolution can win, so a conversation is created exactly once.
- Listing photo uploads are stored before the DB write and rolled back (deleted) if it fails.
- View counts are recorded by an explicit `POST /listings/:id/view` (once per browser
  session, owners excluded) rather than on every GET.

## 6. Security controls

| Area | Control |
|---|---|
| Input | Zod on every body and query; unknown keys stripped (no mass-assignment of `ownerId`, `status`, `viewCount`…) |
| Uploads | Memory buffer, ≤ 5 MB, ≤ 8 per request, magic-byte sniffing (JPEG/PNG/WebP only), server-chosen extension, `nosniff` + `default-src 'none'` on served files |
| Authz | Role middleware + ownership checks on every mutation; chat authorization shared by REST and sockets |
| Rate limits | Global 300/min/IP, login/register 10 failures/15 min per IP **and** 10 failed logins/15 min per account (spoof-proof), refresh 120/15 min, AI 30/h/user, writes 60/h/user, socket messages 10 burst + 2/s |
| Headers | helmet (API: `default-src 'none'`), Next.js CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| CORS | Explicit origin allow-list (comma-separated `CORS_ORIGIN`) for REST and Socket.IO |
| Errors | Central handler maps Zod/Prisma/Multer/body-parser errors to 4xx; no stack traces leak |
| Privacy | Public listing responses expose owner first name + last name, avatar and join date only; owners see tenant contact details only via accepted chat |
| Secrets | Validated at boot; production refuses to start without a ≥ 32-char `JWT_SECRET` |

## 7. Performance

- Indexes for the hot paths: `listings(status, created_at)`, `listings(status, location)`,
  `chat_messages(conversation_id, created_at)`, `notifications(user_id, read, created_at)`.
- Browse issues one count + one page query; scores for the page are read in one query
  and missing ones written in one transaction.
- Landing page is statically generated and revalidated every 60 s; listing pages are
  server-rendered with 30 s data revalidation; images go through `next/image`
  (AVIF/WebP, responsive `sizes`), with the hero images self-hosted.
