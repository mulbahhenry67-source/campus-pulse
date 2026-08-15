# Campus Pulse — Deployment Guide

## Local development (no Docker)

```bash
cp .env.example .env              # fill in JWT secrets at minimum
docker compose up -d db           # Postgres only
cd backend
npm install
npm run migrate
npm run seed                      # optional: realistic demo users/matches/messages
npm run dev                       # http://localhost:4000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173, proxies /api and /ws
```

Demo login (after `npm run seed`): `maya@demo.campuspulse.local` / `DemoPass123`
(all seeded accounts share that password — see `backend/src/db/seed.ts`).

## Full stack via Docker Compose (staging-style)

```bash
cp .env.example .env
docker compose up -d --build
```

This builds and runs three containers: `db` (Postgres), `backend` (migrations run
automatically on container start via `docker-entrypoint.sh`, then the API listens on
`4000`), and `frontend` (production Vite build served by nginx on `8080`, which also
reverse-proxies `/api` and `/ws` to the backend container over the Docker network).

Visit `http://localhost:8080`. This setup is plain HTTP and uses default Postgres
credentials — fine for local staging, **not** what you'd expose to the internet as-is.

## Production deployment

This repo gives you production-*shaped* containers, not a turnkey production deploy —
the pieces that are inherently environment-specific are called out explicitly rather
than papered over:

1. **Secrets**: generate real values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
   (`openssl rand -base64 48`), a strong Postgres password, and set `NODE_ENV=production`.
   Never commit `.env`.
2. **Database**: point `DATABASE_URL` at a managed Postgres instance (RDS, Cloud SQL,
   etc.) rather than the `db` container in `docker-compose.yml`, which is for local use.
   Run `node dist/db/migrate.js` (or let the backend container's entrypoint do it) against
   that instance before traffic hits it.
3. **TLS**: put a TLS-terminating load balancer or reverse proxy (e.g. a managed LB, or
   Caddy/nginx with a real certificate) in front of both the `frontend` and `backend`
   containers. Neither container terminates TLS itself.
4. **CORS/origins**: set `CORS_ALLOWED_ORIGINS` and `APP_URL` to your real production
   domain(s) — the backend rejects credentialed requests from anywhere else by design.
5. **Object storage**: photo and verification-document uploads currently accept a hosted
   URL (see `SECURITY.md`). Wire up S3 (or equivalent) with presigned uploads and update
   `profile.routes.ts` / `verification.routes.ts` accordingly before accepting real user
   uploads at scale.
6. **Email**: set `EMAIL_PROVIDER=smtp` and real SMTP credentials (SES, SendGrid,
   Postmark, Mailgun all expose an SMTP endpoint) — `EMAIL_PROVIDER=console` is dev-only
   and just logs emails instead of sending them.
7. **Horizontal scaling**: if you run more than one backend instance behind a load
   balancer, the WebSocket connection hub (`ws/hub.ts`) needs to move from in-process to
   a shared pub/sub (Redis) — flagged in that file's comments.
8. **Migrations on deploy**: run migrations as a separate release step (or rely on the
   entrypoint script) *before* rolling out new backend instances, not concurrently with
   them serving traffic.
9. **Monitoring**: `LOG_LEVEL` and structured JSON logs (`pino`) are ready to ship to any
   log aggregator. An error-tracking DSN slot (`SENTRY_DSN`) is stubbed in `.env.example`
   — wire up whatever error monitoring service you use.

## External services required for a full production deployment

| Service | Purpose | Where it plugs in |
|---|---|---|
| Managed PostgreSQL | Primary datastore | `DATABASE_URL` |
| SMTP provider (SES/SendGrid/Postmark/Mailgun) | Verification, password reset, notification emails | `SMTP_*` env vars, `email.service.ts` |
| Object storage (S3-compatible) | Profile photos, student ID verification images | Not yet wired — see gap #5 above |
| TLS-terminating load balancer or reverse proxy | HTTPS | In front of both containers, not included here |
| (Optional, for scale) Redis | Shared WebSocket pub/sub across multiple backend instances | `ws/hub.ts` |
| (Optional) Error monitoring (Sentry or similar) | Production error visibility | `SENTRY_DSN` stub in `.env.example` |

## Testing

```bash
cd backend
npm install
npm test          # jest --runInBand, requires DATABASE_URL pointed at a disposable test DB
```

All ~70 backend tests are integration tests against a real Postgres database (not
mocked) — point `DATABASE_URL` at a throwaway database, since tests `TRUNCATE` tables
between runs. Coverage includes every phase: auth flows and session security, the
matching algorithm (pure unit tests, no DB needed), discovery/likes/matches, real
end-to-end WebSocket tests (actual server, actual socket clients), messaging, communities,
the date planner, and admin RBAC boundaries.

**Note on this delivery**: the sandboxed environment this was built in has no npm
registry access, so these tests were written and manually cross-checked (imports, route
wiring, schema references) but not executed here. Run `npm test` yourself after
`npm install` to get a real pass/fail signal before deploying.

## Administrator access

There's no hardcoded admin account. To create one locally or in a demo environment,
register normally through the app, then promote the account directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

In production, do this deliberately and rarely — the audit log (`audit_logs` table)
records every admin action taken from that point on, so treat the role grant itself with
the same care.
