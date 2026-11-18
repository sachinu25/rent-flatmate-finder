# Deployment guide

_Rent & Flatmate Finder — developed by Anumodit Shukla._

## Architecture

| Piece | Service | Why |
|---|---|---|
| Frontend (Next.js 16) | **Vercel** | First-class Next.js hosting, CDN, image optimisation |
| API + Socket.IO (Express) | **Render** web service (`render.yaml`) | Needs a persistent process for WebSockets (Vercel Functions can't hold them) |
| Database | **Neon** PostgreSQL | Managed Postgres; Render's free Postgres expires |
| Images | **Cloudinary** | Persistent; Render's disk is wiped on every deploy |
| Email (optional) | **Resend** | HTTPS API (Render blocks outbound SMTP on free instances) |
| AI (optional) | **OpenAI** or **Anthropic** | Rule-based scoring works without it |

### How traffic flows (verified behaviour)

| Traffic | Path | Notes |
|---|---|---|
| REST calls (JSON) | Browser → `https://<app>.vercel.app/api/*` → Vercel rewrite → `BACKEND_URL/api/*` | Same-origin for the browser, so the refresh cookie is first-party. Vercel forwards the visitor IP in `x-forwarded-for`; proxied requests time out after 120 s. |
| Refresh-token cookie | Set by the API, passed back through the rewrite | `rff_rt`; `HttpOnly; Secure; SameSite=Lax; Path=/api/auth`, scoped to the Vercel domain. |
| Photo uploads (multipart) | Browser → `NEXT_PUBLIC_SOCKET_URL/api/listings` **directly** | Bearer token only, no cookies; allowed by `CORS_ORIGIN`. Bypasses proxy size limits. |
| Socket.IO | Browser → `wss://<api>.onrender.com` directly | Bearer token in the handshake; origin must be in `CORS_ORIGIN`. |
| Listing images | Cloudinary `https://res.cloudinary.com/...` | Allowed by `next.config.ts` (`images.remotePatterns` and CSP). |
| SSR / ISR fetches | Vercel server → `BACKEND_URL/api/*` directly | Public data only. |

API responses default to `Cache-Control: private, no-store`, so Vercel's proxy cache never stores
personalised data. Only `/listings/featured`, `/listings/cities` and `/stats/public` opt in to public caching.

---

## Environment variables: where each one goes

### Render → backend service → Environment

| Variable | Required | Value | Notes |
|---|---|---|---|
| `NODE_ENV` | ✅ | `production` | Preset in `render.yaml` |
| `NODE_VERSION` | ✅ | `22.13.0` | Preset |
| `DATABASE_URL` | ✅ | Neon **direct** URL ending in `?sslmode=require` | Not the `-pooler` host (migrations need session locks) |
| `JWT_SECRET` | ✅ | ≥ 32 random characters | Generated automatically by the Blueprint |
| `CORS_ORIGIN` | ✅ | `https://<app>.vercel.app` (comma-separate extra domains) | The server **refuses to start** without it in production. Exact origins, no trailing slash, no wildcards. Add preview URLs if you test chat on previews. |
| `APP_URL` | ✅ | `https://<app>.vercel.app` | Links in emails |
| `TRUST_PROXY` | ✅ | `2` | Preset. Vercel proxy + Render load balancer. Use `1` only if browsers call Render directly for REST. |
| `COOKIE_SAMESITE` | – | `lax` | Preset. Keep `lax` with the rewrite setup. |
| `CLOUDINARY_CLOUD_NAME` | ✅ | from Cloudinary dashboard | Without all three, photos go to the ephemeral disk and **are lost on redeploy** (a warning is logged) |
| `CLOUDINARY_API_KEY` | ✅ | ″ | |
| `CLOUDINARY_API_SECRET` | ✅ | ″ | |
| `CLOUDINARY_FOLDER` | – | `rent-flatmate-finder` | Default |
| `EMAIL_PROVIDER` | – | `resend` (preset) or `none` | |
| `EMAIL_API_KEY` | if Resend | Resend API key | |
| `EMAIL_FROM` | if Resend | `Name <noreply@your-verified-domain>` | `onboarding@resend.dev` only delivers to your own address |
| `LLM_PROVIDER` | – | `openai` (preset), `anthropic` or `none` | |
| `LLM_API_KEY` | if AI | provider API key | Leave empty for rule-based scoring only |
| `LLM_MODEL` | – | `gpt-4o-mini` (preset) / `claude-opus-5-5` | |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `HIGH_SCORE_THRESHOLD`, `LLM_TIMEOUT_MS`, `LOG_LEVEL` | – | defaults `15m`, `30`, `80`, `45000`, `info` | Optional tuning |

Do **not** set `ALLOW_DEMO_SEED` or `SEED_PASSWORD` in production. Leave `PUBLIC_API_URL` unset when Cloudinary is configured.

### Vercel → Project → Settings → Environment Variables (Production **and** Preview)

| Variable | Required | Value |
|---|---|---|
| `BACKEND_URL` | ✅ | `https://<api>.onrender.com` (no trailing slash, no `/api`) |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | `https://<api>.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://<app>.vercel.app` (or your custom domain) |

All three are read at **build time** (rewrites, CSP, client bundle). A Vercel build **fails with a clear
error** if any is missing. Redeploy after changing them.

### GitHub → repository → Settings → Secrets

None needed. CI uses a throwaway Postgres container and test-only values defined in `.github/workflows/ci.yml`.

### Never commit

`backend/.env`, `frontend/.env.local` and any `.env.*` file except `.env.example` are gitignored and
excluded from Docker builds by the `.dockerignore` files.

---

## Step-by-step

1. **Push to GitHub** on branch `main` (`git init`, commit, add remote, push).
2. **Neon:** create a project and copy the direct connection string with `?sslmode=require`.
3. **Cloudinary:** copy the cloud name, API key and API secret.
4. **Resend** (optional): create an API key and verify your sending domain.
5. **Render:** New → Blueprint → select the repo. Fill every `sync: false` value from the Render table
   (use a temporary `CORS_ORIGIN` such as `https://placeholder.vercel.app` until step 7) → Apply.
   - Build: `npm ci --include=dev && npx prisma generate && npm run build`
   - Start: `npm start`, which runs `prisma migrate deploy`, then the server. Migrations apply automatically on every deploy.
   - Check `https://<api>.onrender.com/api/health` → `{"status":"ok","database":{"status":"connected"}}`.
6. **Vercel:** Add New → Project → import the repo → **Root Directory `frontend`** → add the three
   variables → Deploy.
7. **Wire up:** set Render `CORS_ORIGIN` and `APP_URL` to the final Vercel URL → Render redeploys.

---

## Post-deploy verification

| # | Check | Expected |
|---|---|---|
| 1 | Register, then reload the page | Still signed in. DevTools → Application → Cookies shows `rff_rt` (HttpOnly, Secure) on the Vercel domain. |
| 2 | DevTools → Network → `api/auth/refresh` response headers | `cache-control: private, no-store` |
| 3 | Owner: create a listing with a photo | Photo URL starts with `https://res.cloudinary.com/`. Redeploy Render and confirm the photo still loads. |
| 4 | Open chat in two browsers | No "Reconnecting…" badge. A `wss://<api>.onrender.com/socket.io/` connection shows status 101; messages and typing appear live. |
| 5 | Render → Logs: any request line | `clientIp` shows **your public IP**, not a Vercel/Render internal address. If it shows a proxy IP, adjust `TRUST_PROXY`. |
| 6 | Render → Logs on boot | `CORS origins: https://<app>.vercel.app`, `Email: resend`, and no Cloudinary warning |
| 7 | Tenant: Run AI analysis | Badge says "AI analysis · <model>". If it says "Rule-based score", check `LLM_API_KEY` in the logs. |

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Vercel build error "Missing required environment variable(s)" | Add the listed variables (Production + Preview) and redeploy |
| Render fails to boot: "CORS_ORIGIN is required" | Set `CORS_ORIGIN` |
| Signed out on every reload | `BACKEND_URL` wrong, or the cookie isn't reaching the browser. Check check 1. |
| Chat stuck on "Reconnecting…" | `NEXT_PUBLIC_SOCKET_URL` wrong, or the Vercel URL is missing from `CORS_ORIGIN` |
| Photo upload fails with a CORS error | Vercel URL missing from `CORS_ORIGIN` |
| Everyone rate-limited at once | `clientIp` in logs is a proxy IP. Fix `TRUST_PROXY`. |
| Images vanish after redeploy | Cloudinary variables missing |
| `P1001` / migration lock timeout | Use Neon's **direct** (non-pooled) URL |
| First request takes ~50 s | Free Render instance waking from sleep. Use a paid instance for always-on chat. |
