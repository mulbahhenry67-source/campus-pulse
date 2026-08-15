# Campus Pulse — Security Checklist

## Response to the 20-item pre-launch checklist

Going through it item by item, honestly:

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Hide API keys | Done | All secrets live in `.env` (gitignored), never in source. No third-party API keys are hardcoded anywhere in the repo. |
| 2 | Purge Git secrets | Done | `.gitignore` excludes `.env`/`.env.local` from day one — nothing to purge because nothing sensitive was ever committed. |
| 3 | Use public DB key | N/A for this architecture | This applies to BaaS setups (e.g. Supabase) where the client talks to the database directly with a public anon key. Campus Pulse's Postgres is never exposed to the client at all — every query goes through the Express API. There's no "public key" to scope because there's no direct client-DB path. |
| 4 | Enable row-level security | N/A for this architecture, see reasoning below | Same root cause as #3: RLS matters when clients query the DB directly. Here, the API is the sole gatekeeper, so authorization is enforced in application code instead (see `SECURITY.md` → Authorization table below) — every message, match, and admin action checks the requester's identity against the resource before touching the DB. This is a legitimate alternative to RLS, not a skipped step, *provided nothing ever bypasses the API* — true today since Postgres isn't publicly reachable in the deployment model in `DEPLOYMENT.md`. |
| 5 | Encrypt sensitive data | Done, with one infra step for you | Passwords are bcrypt-hashed (irreversible — stronger than encryption for this use case). Refresh/reset/verification tokens are stored as SHA-256 hashes, never raw. Encryption-*at-rest* for the database volume itself is an infra-level setting on your managed Postgres provider (RDS/Cloud SQL/etc. all offer this as a checkbox) — turn it on there; see `DEPLOYMENT.md`. |
| 6 | Enforce server-side auth | Done | `authenticate` middleware on every protected route; access tokens are verified server-side on every request, never trusted from the client. |
| 7 | Lock record access | Done | Resource-level checks everywhere, not just role checks — e.g. messages require active match participancy, users can only delete their own posts/messages, date plans check both parties. |
| 8 | Block field tampering | Done | Every mutating endpoint validates against an explicit zod schema (allowlist, not denylist) — a client can't smuggle extra fields like `role` or `id` into a request body and have them honored. |
| 9 | Secure session cookies | Done | Refresh token cookie is `httpOnly`, `secure` in production, `sameSite: lax`. |
| 10 | Hash passwords | Done | bcrypt, configurable salt rounds (12 by default). |
| 11 | Rate limit login | Done | `authRateLimiter` on `/api/auth/login` and `/register`, plus account lockout after 5 failed attempts. |
| 12 | Add bot protection | **Fixed this pass** | Added a CAPTCHA verification scaffold (`utils/captcha.ts`) supporting Cloudflare Turnstile or hCaptcha, wired into register and login. Off by default (`CAPTCHA_PROVIDER=none`) so it doesn't break local dev; set the env vars to turn it on for a public launch. Rate limiting + account lockout were already real bot mitigation even before this. |
| 13 | Parameterize queries | Done | Every single query in the codebase uses `pool.query(sql, [params])` — audited with a full-repo grep, zero string-concatenated SQL. |
| 14 | Validate all input | Done | zod schemas on every mutating endpoint. |
| 15 | Escape user content | Done | React escapes all rendered text by default (no `dangerouslySetInnerHTML` anywhere); emails HTML-escape user-supplied names via `escapeHtml()`. |
| 16 | Restrict file uploads | Honest gap | Photo/verification endpoints currently accept a hosted URL, not a direct file upload — so there's no upload attack surface *yet*, but also no real validation until object-storage integration lands (tracked since Phase 2, detailed below). |
| 17 | Trim API responses | Done, just re-audited | Grepped every `SELECT *` in the codebase against what actually reaches `res.json()` — password hashes and token hashes are only ever used internally (auth service logic), never serialized in a response. The one endpoint returning full verification-request rows (including the student ID URL) is admin-only, gated by `requireRole`. |
| 18 | Add security headers | Done | `helmet()` on the API; `nginx.conf` adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` at the edge for the production frontend container. |
| 19 | Force HTTPS | **Fixed this pass** | Added a production-only redirect middleware (`app.ts`) that 308-redirects any non-HTTPS request to HTTPS, based on `X-Forwarded-Proto` from the upstream proxy. Skipped outside production so it doesn't break local dev/tests. HSTS header is already sent by helmet's defaults. |
| 20 | Scan dependencies | **Fixed this pass** | Added an `npm run audit` script to both `backend` and `frontend` (`npm audit --audit-level=high`). Not wired into CI in this repo — add it as a required check before merge/deploy. |

Three items were genuinely missing before this review (12, 19, 20) and are now real code, not just documentation. Two items (3, 4) don't map cleanly onto this architecture and I've explained why rather than silently skip them. Everything else was already correctly implemented across Phases 1-6 and I re-verified it here rather than taking my own earlier claims on faith.

---


## Full detail, by category

Honest status of every security control the spec calls for, each pointing at the actual
code enforcing it — not a checkbox exercise. Items marked with a warning are known gaps
with the reason and what closing them would take.

## Authentication & sessions

| Control | Status | Where |
|---|---|---|
| Password hashing (bcrypt, never plaintext) | Done | `backend/src/utils/password.ts` |
| Server-side password policy (length, char classes) | Done | `passwordMeetsPolicy()` in `password.ts` |
| Access tokens short-lived (15 min default) | Done | `JWT_ACCESS_TTL_MIN` in `.env.example` |
| Refresh tokens rotated on every use | Done | `auth.service.ts` -> `refresh()` |
| Refresh-token reuse detection (revokes whole session family) | Done | `auth.service.ts` -> `refresh()`, tested in `tests/auth.test.ts` |
| Refresh token stored as httpOnly cookie, never JS-readable | Done | `auth.controller.ts` -> `setRefreshCookie()`; frontend never touches it |
| Access token held in memory only (not localStorage) | Done | `frontend/src/lib/api.ts` |
| Account lockout after repeated failed logins | Done | `user.repository.ts` -> `recordLoginFailure()`, 5 attempts / 15 min |
| Session enumeration / "logout all devices" | Done | `POST /api/auth/logout-all` |
| Password reset tokens: single-use, expiring, hashed at rest | Done | `auth.service.ts`; `password_resets` stores only a SHA-256 hash |
| Password reset invalidates all existing sessions | Done | `auth.service.ts` -> `resetPassword()` |
| Minimum age enforced server-side (DB constraint, not just UI) | Done | `CHECK` constraint on `users.date_of_birth`, migration 001 |

## Authorization

| Control | Status | Where |
|---|---|---|
| Every protected endpoint requires a valid access token | Done | `authenticate` middleware on all non-public routes |
| Role-based access control (user/moderator/admin/super_admin) | Done | `requireRole()`, enforced on all `/api/admin/*` routes, tested in `tests/admin.test.ts` |
| Resource-level authorization, not just role checks | Done | Messages require active match participancy; matches/date-plans check both parties; users can only delete their own messages/posts |
| Client-supplied identity never trusted | Done | `req.user` is derived only from the verified JWT, never from the request body |

## Input handling

| Control | Status | Where |
|---|---|---|
| All request bodies validated server-side | Done | `zod` schemas on every mutating endpoint (`*.validators.ts` per module) |
| Output sanitization in emails | Done | `escapeHtml()` in `email.service.ts` |
| XSS | Done | React escapes all text content by default; no `dangerouslySetInnerHTML` anywhere in the frontend |
| SQL injection | Done | 100% parameterized queries (`pool.query(sql, [params])`) — no string-concatenated SQL anywhere |
| File upload validation (type/size/dimensions) | Gap | Photo endpoints currently accept a hosted URL, not a direct upload — real validation lands with object-storage integration (S3 presigned uploads), noted since Phase 2 |

## Network & transport

| Control | Status | Where |
|---|---|---|
| Security headers (helmet) | Done | `middleware/security.ts` |
| CORS allowlist (not wildcard) | Done | `corsMiddleware`, configured via `CORS_ALLOWED_ORIGINS` |
| Rate limiting on auth endpoints | Done | `authRateLimiter`, stricter than the general limiter |
| Bot protection on register/login | Done (opt-in) | `utils/captcha.ts`, Turnstile/hCaptcha scaffold — off by default via `CAPTCHA_PROVIDER=none`, enable with real credentials for public launch |
| Rate limiting on general API traffic | Done | `generalRateLimiter` |
| CSRF | Mitigated | Refresh/logout rely on the httpOnly cookie, but the strict CORS allowlist blocks credentialed cross-origin requests from any origin not explicitly configured — the primary defense here. No separate CSRF token is issued. |
| Reverse-proxy security headers | Done | `frontend/nginx.conf` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| TLS termination | Gap | Not configured in this repo — expected to be handled by whatever sits in front of the containers in production. `docker-compose.yml` here is plain HTTP, for local/staging use. HTTPS is now *enforced* in production mode (redirects non-HTTPS requests), but something still has to actually terminate TLS upstream. |

## Privacy

| Control | Status | Where |
|---|---|---|
| Exact GPS coordinates never sent to other users | Done | `profile.routes.ts` strips `latitude`/`longitude` before returning another user's profile |
| Verification documents never exposed to non-admins | Done | `student_id_image_url` only readable via the admin verification endpoint, gated by `requireRole` |
| Date-plan locations are free-text general areas, never coordinates | Done | `date_plans.location_note`; no lat/lon columns exist on that table |
| Passwords never logged | Done | `logger.ts` redacts `password`/`password_hash`/`token`; `pino-http` doesn't log bodies |

## Abuse prevention & moderation

| Control | Status | Where |
|---|---|---|
| Block enforcement in discovery | Done | `discovery.repository.ts` excludes blocked users in both directions |
| Block enforcement in messaging | Done | `messages.service.ts` checks `areBlocked()` before every send |
| Reporting (messages, users, posts, communities) | Done | Shared `reports` table, written to since Phase 3, read by the Phase 6 admin queue |
| Audit logging of security-relevant events | Done | `audit_logs` — login attempts, password changes, admin actions, refresh-token reuse detection |
| Suspending/banning revokes active sessions immediately | Done | `admin.service.ts` -> `suspendUser()`/`banUser()` |

## Known gaps and what closing them requires

- **Direct file upload** (photos, student ID images): needs real object-storage
  integration (S3 + presigned POST + server-side type/size/dimension validation). The
  endpoint shapes already accept this without further API changes.
- **TLS**: this repo's Docker setup is HTTP-only for local/staging; production needs a
  TLS-terminating proxy or managed load balancer in front of it.
- **Multi-instance WebSocket fan-out**: `connectionHub` (Phase 3) is in-process. Running
  more than one API instance behind a load balancer needs a shared pub/sub (Redis) so a
  push reaches a user connected to a different instance — flagged in code since Phase 3.
- **Automated dependency scanning / SAST**: an `npm run audit` script now exists in both
  `backend` and `frontend` (`npm audit --audit-level=high`), but it's not wired into CI in
  this repo — add it as a required check, and consider a SAST tool too, before production use.
- **This checklist was produced by manual code review, not a penetration test.** Treat
  it as a starting point, not a compliance sign-off — have a real security review done
  before handling production user data.
