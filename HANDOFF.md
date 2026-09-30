# YARS App — Handoff

_Last updated: 2026-09-30, after piece-based orders shipped to production._

## What this is

Back-office management system for a **non-woven bags factory** (YARS). Single-family userbase — the owner (Deepak) and his brother, who runs the factory floor and uses the app **on a phone**. Mobile-first matters more than desktop.

## Repo layout

```
yars-app/
├── backend/          # the API (Node/Express/Sequelize)
├── frontend/         # the UI (React/Vite/Tailwind)
├── docs/superpowers/ # design specs and implementation plans
└── HANDOFF.md        # this file
```

**Epidermohydra (a separate skincare business) used to live in `epidermohydra/` inside this repo. On 2026-09-30 it was moved to its own local repo at `~/Desktop/epidermohydra`** (history carried over) and stripped from this repo's unpushed history, so it never reached the public GitHub repo. It has nothing to do with YARS — don't bring it back. Full pre-split backup: `~/yars-app-full-history-2026-09-30.bundle`.

**`github.com/dk7696822/yars-app` is PUBLIC.** Never commit secrets; stage by explicit path.

## Tech stack

- **Backend**: Node 20, Express 5, Sequelize 6, PostgreSQL. Entry: `backend/src/server.js`. Routes mounted in `backend/src/routes/index.js`.
- **Frontend**: React 19, Vite, Tailwind, react-router-dom v7, axios, lucide-react. API clients: `frontend/src/services/api.js` (original modules) and `inventoryAPI.js` (inventory).
- **DB**: Supabase Postgres — **this is production and the business's only copy of its data.** Host: `db.hqenqposkeiwyephomza.supabase.co` (credentials in `backend/.env`, untracked). A different host appears in old committed files (`render.yaml`, plan docs) — those are stale.
- **Tests**: Jest + throwaway Dockerized Postgres (`backend/docker-compose.test.yml`, port 5433, tmpfs). `cd backend && npm run test:db:up && npm run test:migrate && npm test` → 26 suites / 184 tests (2026-09-30). Frontend: `cd frontend && npm test` (Vitest, 37 tests). Local click-through: backend `NODE_ENV=test PORT=5055 node src/server.js` (port 5000 is taken by macOS AirPlay), frontend `VITE_API_URL=http://localhost:5055/api npx vite --port 5173`. `tests/setup.js` refuses to run against anything that isn't a `*_test` DB on localhost.

## Modules

Original: Customers, Orders (bag manufacturing orders: sizes, plate types), Invoices, Payments, Expenses (+ user-managed expense categories), Excel/PDF export, Audit-log History, Dashboard.

**Inventory (shipped 2026-07-17)** — raw-material management (finished bags are made-to-order, never stocked):
- **Masters**: Suppliers, user-managed Inventory Categories, Inventory Items (fixed unit enum KG/PCS/METRE/ROLL/LITRE, reorder level/target), and user-managed **Item Attributes** (Cut/GSM/Color seeded; one value per attribute per item, enforced by DB composite FK + UNIQUE).
- **Procurement**: Purchase Orders (PENDING → PARTIALLY_RECEIVED → RECEIVED / CANCELLED) → Goods Receipts (also possible with no PO). Over-receiving is allowed by design. Receipts have NO delete/update — corrections go through adjustments.
- **Stock**: FIFO batches (`stock_batches`, remainders are the authoritative stock), append-only `stock_movements` ledger (signed quantities), Stock Issues with same-line wastage (issue 500 + 20 wastage consumes 520 FIFO), Adjustments (IN/OUT, reason mandatory).
- **The rule that matters**: ALL stock mutation goes through `backend/src/services/stockService.js` — transactions + `SELECT FOR UPDATE` row locks, input quantization to DECIMAL(12,3)/(14,2), epsilon 0.0005, audit rows written after commit. Never write batches/movements directly. Invariant: `SUM(batches.quantity_remaining) === SUM(movements.quantity)` per item — tested.
- Document numbers (`PO-2026-0001`, `GR-…`, `ISS-…`): `documentNumber.js`, advisory-lock serialized, safe past 9999.
- Server-side pagination (`backend/src/utils/pagination.js`, default 20/max 100) — inventory only; original modules still return all rows.

**Piece-based orders (built 2026-09-30)** — each order line is sold by **KG** (kg × rate/kg, unchanged) or **PIECES** ("N pieces cost ₹X", stored exactly as typed). Sizes carry an optional kg rate, optional piece price and optional weight ("N pieces weigh W kg"); at least one price is DB-enforced. Spec `docs/superpowers/specs/2026-09-30-piece-orders-design.md`, plan `docs/superpowers/plans/2026-09-30-piece-orders.md`.
- **All money/volume math lives in `backend/src/services/orderMath.js` and its mirror `frontend/src/utils/orderMath.js`**, both pinned by `backend/tests/fixtures/order-math-vectors.json` (Jest + Vitest run the same file). KG line amount is byte-for-byte the pre-pieces float expression (existing totals must never move); PIECES amount is exact BigInt half-up rounding to the paisa (matches Postgres `ROUND`). Change both files together.
- **No double counting**: a line is exactly one unit — DB CHECK `order_product_sizes_unit_chk`. Kg sold = kg of KG lines + estimated kg of weighted PIECES lines; pieces sold = PIECES lines only (`volumeSummary`).
- **Snapshots**: price/weight are copied onto the line (`services/orderLines.js`). Changing a size never rewrites lines, except back-fill: saving a size weight fills PIECES lines of that size whose `weight_kg IS NULL` (weight_source `SIZE`); `MANUAL` (measured) weights are never overwritten. Money columns are never touched by back-fill.
- Invoiced orders stay editable but the edit screen warns the invoice won't change (delete + regenerate). `invoice_items.unit` is NULL for pre-pieces items → they render exactly as before.
- Jarvis's canonical pending and kg/pieces SQL live between `<!-- canonical:… -->` markers in `backend/knowledge/schema.md`; `tests/knowledgeQueries.test.js` runs them through the assistant's guarded `runQuery` and asserts they match `orderMath`.
- **Shipped 2026-09-30**: migration applied to Supabase, backend revision `yars-backend-00018-rqx`, frontend on Firebase. Before/after snapshot compare was identical (257 orders, 390 lines, 34 invoices, 97 items, 43 sizes). Backup `~/yars-full-backup-2026-09-30.sql`, snapshots `~/yars-snap-{before,after}-2026-09-30.json`. Rollback: Cloud Run traffic → `yars-backend-00017-cpt`; DB `down` refuses once pieces data exists.
- Migration `20260930000001-add-piece-orders` is purely additive (single transaction; `down` refuses once pieces data exists). Rollout check: `backend/scripts/piece-orders-snapshot.js` (before/after/compare — must be identical).

**AI Assistant “Jarvis” (built 2026-07-23)** — in-app chat (named Jarvis in the UI and system prompt) (page at `/assistant` + floating button) that answers data questions and explains the app. Multi-provider quota-fallback chain (see `docs/superpowers/specs/2026-07-23-multi-provider-fallback-design.md`): Gemini `gemini-flash-latest` → `gemini-flash-lite-latest` → `gemini-2.0-flash` (via `@google/genai`; free-tier daily caps on the top model are tiny, ~20 req/day), then Mistral `mistral-small-latest`, then Groq `llama-3.3-70b-versatile` (free tier is 12k tokens/min — barely one request with our ~11k-token knowledge base, so it 413s often; treated as quota → steps down), then `open-mistral-nemo`. Architecture: `agentLoop.js` (provider-neutral loop) + `providerChain.js` (per-entry cooldown failover) + `providers/geminiProvider.js` / `providers/openaiCompatProvider.js` (adapters own provider quirks: Gemini thought-signature echo, Mistral 9-char tool_call ids). SSE streaming (`POST /api/assistant/conversations/:id/messages`); conversations persisted (`assistant_conversations`/`assistant_messages`). Data access is READ-ONLY through three layers: (1) SELECT-only Postgres role `yars_assistant_ro` (`backend/scripts/create-assistant-role.sql`, connection in `ASSISTANT_DB_URL`), (2) strict SQL validator `src/services/assistant/sqlGuard.js`, (3) LIMIT 200 wrap + 5s statement timeout. Env vars: `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY` (each provider optional — chain entries are skipped when the key is absent), `ASSISTANT_DB_URL`. **Maintenance rule: any PR that changes a screen's UI must update that module's `backend/knowledge/*.md` in the same commit** — the assistant's answers are only as accurate as those files.

## Conventions

- Models: UUID PKs, `underscored: true`, snake_case tables, `is_archived` soft deletes everywhere. Deletes are refused (HTTP **409**) while referenced. 400 = validation, 404 = missing.
- Sequelize returns DECIMAL as **strings** — `parseFloat()` before arithmetic. #1 bug source.
- Responses: `success(res, code, msg, data)` / `error(...)` from `backend/src/utils/response.js`. Paginated payloads: rows at `response.data.data.data`, metadata at `...data.pagination` (frontend uses `unwrapPaginated`).
- Active-name uniqueness via **partial unique indexes** (`WHERE is_archived = false`) — archived names are reusable.
- Migrations: `YYYYMMDD…` prefix; inventory ones are `20260711000001–11`. `ALTER TYPE ... ADD VALUE` cannot run in a transaction (see migration 000010).
- **Auth (added 2026-07-23)**: all `/api` routes require `Authorization: Bearer <JWT>` (30-day expiry, signed with `JWT_SECRET` env var — server refuses to boot without it). Public exceptions: `POST /api/auth/login`, `GET /api/health`. Users live in the `users` table (bcrypt hashes); manage them with `node backend/scripts/create-user.js <username> <password> <displayName>` (idempotent). Frontend stores the token in localStorage; both axios clients attach it and auto-logout on 401.

## Deployment — direct from local, NO GitHub push involved

**GCP account: `dk7696822@gmail.com` (already credentialed). Project ID: `yars-dashboard`** ("Yars Dashboard", number 848592267490). The user's *active* gcloud account is their work account — always pass `--account`/`--project` per command, never switch global config.

**Backend → Cloud Run** (service `yars-backend`, region `asia-south1`):
```bash
gcloud builds submit backend/ \
  --tag asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend \
  --project yars-dashboard --account dk7696822@gmail.com
gcloud run deploy yars-backend \
  --image asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend \
  --region asia-south1 --project yars-dashboard --account dk7696822@gmail.com
```
Runtime env vars live on the Cloud Run service (not in the image — `.dockerignore`/`.gcloudignore` exclude `.env` since 2026-07-17). API URL: `https://yars-backend-848592267490.asia-south1.run.app/api`.

**Frontend → Firebase Hosting** (project `yars-dashboard`, from `frontend/`):
```bash
cd frontend && npm run build && npx firebase-tools deploy --only hosting --project yars-dashboard
```
Live at **https://yars-dashboard.web.app**. `VITE_API_URL` comes from `frontend/.env.production`. CORS allowlist is hardcoded in `backend/src/server.js` — `yars-dashboard.web.app` and `localhost:5173` are in it.

**Database migrations**: `cd backend && NODE_ENV=production npm run migrate` — but ALWAYS `pg_dump` first, and never run `db:seed:all` against production (old seeders aren't idempotent; seed individual files with `--seed`). Backups from the inventory rollout: `~/yars-schema-backup-2026-07-17.sql`, `~/yars-full-backup-2026-07-17.sql`.

## Safety rails (hard-learned — keep them)

1. **Never point anything at Supabase casually.** Tests are guarded, and `server.js`/`config/database.js` load `.env.test` when `NODE_ENV=test` — don't undo that.
2. **`backend/.gitignore` is broken** (every line commented out) — `backend/.env` and `node_modules/` are untracked only by luck. NEVER `git add .`/`-A` in backend/; stage by explicit path. (Fixing the gitignore is safe and desirable, just hasn't been done.)
3. Nothing may ever hard-delete a `goods_receipt` or `stock_issue` — `stock_movements.reference_id` is polymorphic with no FK.

## Known issues / debt (pre-existing, deliberately out of scope so far)

- **Live credentials committed**: `backend/src/config/supabase.js` and `backend/render.yaml` contain real connection strings/secrets in git history.
- Stale CORS entries (Vercel/Netlify/Amplify) in `server.js`.
- Original modules do client-side pagination (fetch-all).
- `frontend/src/pages/Orders.jsx`, `frontend/.env.production`, `frontend/package-lock.json` + deleted `backend/.env.example` are the USER'S OWN uncommitted local changes — leave them alone.

## State as of handoff

- `main` = production (merge commit `adee6db`). Everything deployed and verified end-to-end (15-step browser walkthrough at 390px).
- **Pending user action**: opening stock not yet entered — all items show 0. Each real material goes in as an Adjustment In with reason "Opening stock".
- Docs: spec `docs/superpowers/specs/2026-07-11-inventory-module-design.md`, plan `docs/superpowers/plans/2026-07-11-inventory-module.md` (plan code blocks were kept in sync with post-review hardening).

## Working preferences (from the user)

- Pin **Fable 5** on all subagents for this project — production-grade, no cheaper-model delegation.
- Review/test only what might realistically break (stock math, raw SQL, transactions, migrations, rollout); skip ceremony for routine CRUD/UI.
- Deploys are outward-facing: confirm before touching production; back up before migrating.
