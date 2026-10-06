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
- The tested pending SQL lives between `<!-- canonical:pending -->` markers in `backend/knowledge/money-sql.md` and the kg/pieces SQL between `<!-- canonical:volume -->` markers in `backend/knowledge/volume-sql.md`; `tests/knowledgeQueries.test.js` runs them through the assistant's guarded `runQuery` and asserts they match `orderMath`, and `scripts/dashboard-verify.js` uses the pending one.
- **Shipped 2026-09-30**: migration applied to Supabase, backend revision `yars-backend-00018-rqx`, frontend on Firebase. Before/after snapshot compare was identical (257 orders, 390 lines, 34 invoices, 97 items, 43 sizes). Backup `~/yars-full-backup-2026-09-30.sql`, snapshots `~/yars-snap-{before,after}-2026-09-30.json`. Rollback: Cloud Run traffic → `yars-backend-00017-cpt`; DB `down` refuses once pieces data exists.
- Migration `20260930000001-add-piece-orders` is purely additive (single transaction; `down` refuses once pieces data exists). Rollout check: `backend/scripts/piece-orders-snapshot.js` (before/after/compare — must be identical).

**Dashboard (rebuilt 2026-09-30, Midnight Forest & Brass phase 1)** — dues-first, mobile-first home screen plus `/dues`. Spec `docs/superpowers/specs/2026-09-30-dashboard-redesign-design.md`.
- Read-only endpoints `GET /api/dashboard/overview|period|trends` → `services/dashboard/{dateRanges,ledger,metrics}.js` (pure, unit-tested). All dates in **IST**; presets resolved server-side; money summed in **paise** via `orderMath`.
- Every response carries `checks` (Sales − Collected = To collect − Credit; aging and customer list sum to To collect). If `checks.ok` is false the UI shows a red banner instead of figures.
- Dashboard excludes CANCELLED orders and payments on deleted orders (and says so); the Orders list does not.
- **Before each dashboard release:** `cd backend && NODE_ENV=production node scripts/dashboard-verify.js` (read-only cross-check vs independent SQL) must print ✅.
- Theme tokens: CSS variables in `frontend/src/assets/styles/index.css` mapped in `tailwind.config.js` (`canvas, surface, raised, line, ink, ink-2, brass, status-*, chart-*`, `font-num` = Sora). App is dark by default. Phase 2 = move the remaining screens onto these tokens.
- Motion via `motion` (import from `motion/react`); every animation respects reduced motion; animated numbers always land on the exact value.

**Sage — the in-app assistant (rebuilt 2026-10-01; was "Jarvis"; DEPLOYED 2026-10-06 — Cloud Run `yars-backend-00023-5b5` (list_orders tool, Cloudflare max_tokens, cut-off answers hidden), rollback `yars-backend-00022-grp`; migration `20261001000001` applied; backup `~/yars-full-backup-2026-10-06-sage.sql`; eval gate 16/17).** Page `/assistant` + floating button. Answers questions and proposes changes as cards a person confirms; it never saves on its own and never deletes. Spec `docs/superpowers/specs/2026-10-01-sage-actions-design.md`.
- **Saves are commands** (`backend/src/commands/`): one Zod-checked definition per save, run in a transaction with an `actor`; the screens' routes (`httpRoute`) and Sage's cards both use them. History entries carry `metadata.source` = `app` or `assistant` (+ `assistant_action_id`). Moved so far: `payments.create`, `customers.create`, `orders.create`, `orders.update`.
- **Assistant** (`backend/src/assistant/`): `config.js` (name, budgets, model chain), `llm.js`/`chain.js`/`providers/openaiCompat.js` (free Groq `gpt-oss-120b` → `qwen3.8-27b` → Cloudflare `gpt-oss-120b` → Groq `gpt-oss-20b`; none trains on our data; a per-minute limit ≤ 8 s is waited out), `prompt/core.md` (~1k tokens). **Areas are switches:** each guide in `backend/knowledge/*.md` is an area (front matter `area / summary / keywords / tables`); a round sends the core prompt, the always-on read tools and only the *open* areas' `propose_` tools (`toolset.toolsFor`). Areas open from keywords in the message (`router.areasFor`, free) or when Sage calls `open_area` (returns the guide). So what a round costs stays flat as features are added; typed read tools (`dues`, `customer_summary`, `period_summary`, `find`) built on the dashboard/customer code, `run_query` as the SQL fallback (SELECT-only role + `db/sqlGuard.js` + LIMIT 200 + 5 s).
- **Cards** (`actionKit/`): propose = the real command in a rolled-back transaction (catches every refusal, gives the after-figures) → row in `assistant_actions` (15 min) → SSE `action` event → card. Confirm locks the row, re-checks the action's fingerprint, runs the command once. "Open in form" pre-fills the real form and records what the person changed.
- **Safety layers against free-model mistakes (all tested):** (1) *broken-reply guard* in `agentLoop.js` — a round with leaked reasoning/raw tool markup, tool names, a looping word, a raw record id, a link to a screen that doesn't exist (`links.js`), a "tap Confirm on the card" with no card, or "order created/saved" right after proposing one is never shown; the model is asked once more, then a plain fallback (text is shown a round at a time, after the check); (2) *grounding* (`actionKit/grounding.js`, `defineAction.grounded`) — a card's customer name, order quantities/rates/prices and payment amount must come from the person's last 3 messages (a payment may also be the order's whole due); (3) the card itself — figures from the trial run, Confirm re-checks and saves once.
- **Model quality (evals 2026-10-01, 17 requests):** Groq `gpt-oss-120b` (low reasoning) is the best and fastest; fallbacks (`qwen3.8-27b`, Cloudflare `gpt-oss-120b`, `gpt-oss-20b`) scored 13–14/17 and make more mistakes, which the safety layers catch. A day of eval runs uses up the main model's free daily tokens — run the full eval sparingly (`--only` / `--ask` re-run single cases).
- **Budgets (Groq free = 8k tokens/min/model):** core prompt + always-on tools ≤ 2k tokens; each guide ≤ 800; each opened area (guide + its propose_ tools) ≤ 1.4k — tests fail above them.
- **Adding a feature to Sage:** (1) make its save a command in `src/commands/` and list it in `src/commands/index.js`; (2) add `src/assistant/actions/<name>.js` with `defineAction` (input, resolve, preview, toCommandInput, fingerprint if it depends on changing figures, links, ≥ 3 evals); (3) add or update its area's guide in `backend/knowledge/` (with keywords people would use); (4) remove its routes from `src/assistant/screenOnly.js`. The contract test fails until each step is done; a new write endpoint fails it until it is covered or listed screen-only.
- **Checking quality:** `cd backend && NODE_ENV=test node scripts/assistant-eval.js --gate` (local test DB, real free model, ~120k tokens). **Learning:** `NODE_ENV=production node scripts/assistant-report.js --since <date>` lists cancelled / failed / changed-in-form cards — turn them into evals and guide fixes.
- Env: `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ASSISTANT_DB_URL`. The display name is set only in `backend/src/assistant/config.js` and `frontend/src/app/assistant.js`. **Maintenance rule: a change to a screen updates its guide in the same commit.**

## Conventions

- Models: UUID PKs, `underscored: true`, snake_case tables, `is_archived` soft deletes everywhere. Deletes are refused (HTTP **409**) while referenced. 400 = validation, 404 = missing.
- Sequelize returns DECIMAL as **strings** — `parseFloat()` before arithmetic. #1 bug source.
- Responses: `success(res, code, msg, data)` / `error(...)` from `backend/src/utils/response.js`. Paginated payloads: rows at `response.data.data.data`, metadata at `...data.pagination` (frontend uses `unwrapPaginated`).
- Active-name uniqueness via **partial unique indexes** (`WHERE is_archived = false`) — archived names are reusable.
- Migrations: `YYYYMMDD…` prefix; inventory ones are `20260711000001–11`. `ALTER TYPE ... ADD VALUE` cannot run in a transaction (see migration 000010).
- **Auth (added 2026-07-23)**: all `/api` routes require `Authorization: Bearer <JWT>` (30-day expiry, signed with `JWT_SECRET` env var — server refuses to boot without it). Public exceptions: `POST /api/auth/login`, `GET /api/health`. Users live in the `users` table (bcrypt hashes); manage them with `node backend/scripts/create-user.js <username> <password> <displayName>` (idempotent). Frontend stores the token in localStorage; both axios clients attach it and auto-logout on 401.

## UX redesign — sub-project 1 (branch `feature/ux-redesign`, DEPLOYED 2026-09-30: Cloud Run yars-backend-00019-n7j + Firebase Hosting, together with the dashboard)

Built on `feature/dashboard-redesign`; deployed together with the dashboard on
2026-09-30 (the user asked to ship it now). Sub-projects 2–3 follow. Branches
are NOT merged to main/pushed yet. Pre-release DB backup:
`~/yars-full-backup-2026-09-30-ux-redesign.sql`. Spec: `docs/superpowers/specs/2026-09-30-ux-redesign-1-core-design.md`;
plan: `docs/superpowers/plans/2026-09-30-ux-redesign-1-core.md`.

- **Money comes from one place:** `backend/src/services/orderFacts.js`
  (paise, built on `orderMath`). Used by the dashboard, `GET /api/orders/list`,
  `/api/customers/directory`, `/api/customers/:id/summary`, invoices, and the
  `money` block on `GET /api/orders/:id`.
- **Refunds** reduce received everywhere (orderMath both sides, dashboard,
  Jarvis canonical SQL). Jarvis "pending" now skips cancelled orders.
- **Invoices:** due = final amount incl. tax − received on the invoice's
  orders (+ invoice-only payments); status derived (Cancelled is the only
  manual one). `PATCH /invoices/:id/status` accepts only PENDING/CANCELLED.
- **Orders:** includes are `required:false` (archived sizes/plates/customers
  never hide an order); editing never changes the advance; server dates use
  `todayIST()`.
- **Customers:** page is by `customer_id` (not name); `city` and `gstin` in
  `metadata`; `/customers/similar` warns about duplicates.
- **Frontend:** kit in `src/ui/`, screens in `src/features/{orders,customers,
  invoices,payments}`, TanStack Query (`src/lib/queryKeys.js` →
  `invalidateMoney` after any money change), every route lazy, vendor chunks.
- **Verify before release:** `NODE_ENV=production node scripts/dashboard-verify.js`
  now also cross-checks the orders list, the customer directory and every
  invoice's paid amount against SQL, and reports orders on two invoices.
- Catalog (Sizes, Plate types) was redesigned right after release
  (`frontend/src/features/catalog`). Order lines can be Kg or Pcs whatever the
  size has saved; a ₹0 saved kg rate means "rate set on each order".
- **UX redesign part 2 (branch `feature/ux-redesign-2`, DEPLOYED 2026-09-30: Cloud Run yars-backend-00021-fll + Firebase Hosting; backup `~/yars-full-backup-2026-09-30-ux-redesign-2.sql`):** every remaining page
  is on the kit — `src/features/{expenses,history,inventory,assistant,auth}`,
  `src/app/NotFoundPage.jsx`. No legacy pages, components, stylesheets,
  `<Legacy>` wrapper, react-icons or react-datepicker remain; `index.css` holds
  only the tokens, base and the few animations in use. Spec
  `docs/superpowers/specs/2026-09-30-ux-redesign-2-rest-design.md`, plan
  `docs/superpowers/plans/2026-09-30-ux-redesign-2-rest.md`.
  - `/audit-logs` date filter is India days (`services/auditFilters.js`) and
    `entity_type` takes a comma list. History hides the before→after figures on
    deleted payments: the delete hook only estimates "after" as received − amount.
  - Expense form shows the total read-only — the server recalculates
    quantity × cost on every save.
  - Supplier page takes PO totals from `/purchase-orders?supplier_id=`
    (`/suppliers/:id` returns orders without their lines).
- Backend tests run with `TZ=UTC` (package.json) so they behave like Cloud Run.
- Invoice GST: order totals exclude GST, so the invoice payment sheet offers
  "The invoice itself" — saved with `invoice_id` and no `order_id`. It counts
  toward the invoice's due but not any order's, and the dashboard discloses it
  separately from Collected.
- List endpoints load every live order and page in memory (fine at a few
  thousand orders; move to SQL aggregation if it ever grows past that).

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
2. **The GitHub repo is public.** `.gitignore`s cover `.env`/`.env.*` (fixed 2026-09-30), but still stage by explicit path — never `git add .`/`-A` — and never commit credentials.
3. Nothing may ever hard-delete a `goods_receipt` or `stock_issue` — `stock_movements.reference_id` is polymorphic with no FK.

## Known issues / debt (pre-existing, deliberately out of scope so far)

- **Old credentials in public git history**: `supabase.js`/`render.yaml` (removed from HEAD 2026-09-30) held credentials for the OLD Supabase project `tnrwottbdozuvdcmugve` (production is `hqenqposkeiwyephomza`; production JWT secret differs). They remain in public history → the owner should rotate or delete that old project. An old YARS copy is still live at `yars-app.netlify.app` (calls a dead EC2 API) — worth taking down.
- CORS allowlist cleaned 2026-09-30 (takes effect on the next backend deploy).
- Original modules do client-side pagination (fetch-all).
- The owner's own uncommitted local changes — leave them alone: `frontend/.env.production` (adds `/api` to `VITE_API_URL` — this is what production builds use) and the deleted `backend/.env.example`. Old untracked `backend/scripts/*recover*`/`restore*` scripts are from an Aug-2025 product-size incident.

## State as of handoff

- `main` = production (merge commit `adee6db`). Everything deployed and verified end-to-end (15-step browser walkthrough at 390px).
- **Pending user action**: opening stock not yet entered — all items show 0. Each real material goes in as an Adjustment In with reason "Opening stock".
- Docs: spec `docs/superpowers/specs/2026-07-11-inventory-module-design.md`, plan `docs/superpowers/plans/2026-07-11-inventory-module.md` (plan code blocks were kept in sync with post-review hardening).

## Working preferences (from the user)

- Pin **Fable 5** on all subagents for this project — production-grade, no cheaper-model delegation.
- Review/test only what might realistically break (stock math, raw SQL, transactions, migrations, rollout); skip ceremony for routine CRUD/UI.
- Deploys are outward-facing: confirm before touching production; back up before migrating.
