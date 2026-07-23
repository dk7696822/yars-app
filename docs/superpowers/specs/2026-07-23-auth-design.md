# Authentication — Design Spec

_Date: 2026-07-23. Status: approved design, pre-implementation._
_Sub-project 1 of 2 (prerequisite for the AI Assistant module, spec `2026-07-23-ai-assistant-design.md`)._

## Problem

The app has no real authentication. Login is a hardcoded username/password in
`frontend/src/context/AuthContext.jsx`, shipped in the JS bundle, and the backend
validates nothing — anyone with the API URL can read/write everything. The upcoming
AI Assistant adds a conversational read path over the entire database plus a metered
Gemini quota, which makes fixing this a prerequisite.

## Goals

- Backend-validated login for the two real users (Deepak + brother).
- Every `/api` route (except login/health) rejects unauthenticated requests with 401.
- Hardcoded credentials removed from the frontend bundle.
- Minimal ceremony: no roles, no refresh tokens, no password-reset flows. Two-user family app.

## Design

### Data

- New `users` table via migration (`YYYYMMDD…` prefix, following existing conventions):
  - `id` UUID PK, `username` (unique, partial-unique not needed — no soft delete here),
    `password_hash` (bcrypt), `display_name`, timestamps.
- Seed file (run individually with `--seed`, never `db:seed:all`) creating the two users.
  Initial passwords chosen by the user at rollout time, supplied via env/CLI — not committed.

### Backend

- `POST /api/auth/login` — validates username + bcrypt-compares password, returns
  `{ token, user: { id, username, displayName } }`. Standard `success()`/`error()`
  response helpers, 401 on bad credentials.
- JWT signed with `JWT_SECRET` (env var on Cloud Run; `backend/.env` locally).
  Expiry **30 days** — long-lived by design; logout is client-side token deletion.
- `authMiddleware` verifies the token on all `/api` routes. Applied in
  `backend/src/routes/index.js` ahead of every module router; login (and any health
  endpoint) mounted before the middleware.
- No changes to existing controllers — auth is purely middleware.

### Frontend

- `AuthContext` replaces the hardcoded check with a call to `/api/auth/login`;
  stores `{ token, user }` in localStorage; exposes `logout()`.
- Both axios clients (`services/api.js`, `services/inventoryAPI.js`) get a request
  interceptor attaching `Authorization: Bearer <token>`, and a response interceptor
  that on 401 clears the session and redirects to the login page.
- Login page UI unchanged apart from wiring (it already collects username/password).

## Error handling

- Bad credentials → 401 with a generic message (no username enumeration).
- Missing/expired/invalid token → 401 `{ message: "Authentication required" }`.
- `JWT_SECRET` missing at boot → server refuses to start (fail fast, not silently unsigned).

## Testing

Per the project's lean-review policy, test the breakage-prone core only:

- Unit tests for the auth middleware (valid, missing, malformed, expired token).
- Login endpoint test (success + wrong password) against the Dockerized test DB.
- Full existing suite (8 suites / 50 tests) must stay green — the middleware must not
  break existing route tests (test setup gets a helper to mint a test token).

## Rollout

1. Migrate + seed production (with `pg_dump` backup first, per handoff policy).
2. Deploy backend with `JWT_SECRET` set on the Cloud Run service.
3. Deploy frontend.
4. Both users log in with their new credentials; old hardcoded credentials are dead.

Order matters: backend deploy before frontend is fine (old frontend sends no token →
401 → users see login; acceptable for a coordinated evening rollout with both users informed).

## Out of scope

- Roles/permissions, password reset, refresh tokens, account management UI.
- Rate limiting on login (two users; revisit only if abuse ever observed).
