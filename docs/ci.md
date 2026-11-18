# Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`.

**Backend job** (with a PostgreSQL 17 service container)
1. `npm ci`, `prisma generate`
2. ESLint (type-aware rules) and `tsc --noEmit`
3. `prisma migrate deploy` — applies the real migration history
4. `prisma migrate diff --exit-code` — fails if `schema.prisma` and the migrations disagree
5. `npm test` — Vitest unit tests (scorer) and Supertest integration tests (auth, listings,
   interests, chat authorization, wishlist, notifications, hardening)
6. `npm run build`

**Frontend job**
1. `npm ci`, ESLint (Next.js core-web-vitals + React compiler rules), `tsc --noEmit`
2. `next build` — the API is not running in CI; public pages degrade gracefully during prerender.

Run the same checks locally:

```bash
cd backend  && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

_Rent & Flatmate Finder — developed by Anumodit Shukla._
