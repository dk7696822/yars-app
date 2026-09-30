# Piece-Based Orders — Design

_Date: 2026-09-30 · Status: approved in brainstorming, awaiting spec review_

## Goal

Today every order line is sold by weight (kg × rate/kg). Customers also want to
order by **number of pieces**. The owner needs to:

1. Create order lines in **pieces**, priced per size ("N pieces cost ₹X").
2. Configure, per size, **how much N pieces weigh**, so the system can estimate
   the kg of every pieces line.
3. Keep reporting **total kg sold** — including the estimated kg of pieces
   lines — **without ever counting a line twice**.

## Non-negotiables

- **Existing data is untouched.** Real customer data. The migration is purely
  additive (new nullable columns, a new column with default `KG`, two
  `DROP NOT NULL`s). No existing value is rewritten. Every existing order total,
  invoice amount and receivable must be identical before and after rollout
  (verified by snapshot diff, see Rollout).
- **No double counting.** Each order line is exactly one of KG or PIECES,
  enforced by a database CHECK constraint.
- **Snapshots, not live links.** Prices and weights are copied onto the order
  line at creation. Changing a size's settings affects only future orders —
  with one exception: back-fill of missing weights (see below).
- Every field on an order line stays editable after creation.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| 1 | Unit lives **per line**: one order may mix kg lines and pieces lines. |
| 2 | Weight is configured as "**N pieces weigh W kg**", any N (1, 100, 10,000…). |
| 3 | Piece price is configured as "**N pieces cost ₹X**", any N — "1 piece costs ₹2.50", "1 piece costs ₹0.50" and "100 pieces cost ₹250" are all valid. Stored exactly as typed; per-piece value is only a display hint. |
| 4 | A pieces order for a size **without a weight is allowed**. The form reminds the user (and lets them set it inline); skipping never blocks the order. |
| 5 | When a weight is later set on a size, pieces lines of that size with **no weight** are back-filled once; lines with any weight are never overwritten. |
| 6 | A pieces line can override **both price and weight** for that order. A user-entered weight is `MANUAL` and always wins. |
| 7 | Editing an **invoiced** order is allowed but shows a warning that the invoice won't change (delete & regenerate to update). |
| 8 | A size needs **at least one** of: kg rate, piece price. It may have both (some customers buy that size by kg, others by pieces). |
| 9 | Estimated weight is internal — it never appears on customer invoices. |

## 1. Data model

### `product_sizes`

| Column | Type | Notes |
|---|---|---|
| `rate_per_kg` | DECIMAL(10,2) | **NOT NULL → nullable.** Existing values untouched. |
| `piece_price_amount` | DECIMAL(12,4) NULL | "…cost ₹X" |
| `piece_price_count` | INTEGER NULL, ≥ 1 | "N pieces…" |
| `weight_kg` | DECIMAL(12,3) NULL, > 0 | "…weigh W kg" |
| `weight_pieces_count` | INTEGER NULL, ≥ 1 | "N pieces…" |

CHECK constraints:
- `piece_price_amount` and `piece_price_count` both NULL or both NOT NULL.
- `weight_kg` and `weight_pieces_count` both NULL or both NOT NULL.
- `rate_per_kg IS NOT NULL OR piece_price_amount IS NOT NULL`.

### `order_product_sizes`

| Column | Type | Notes |
|---|---|---|
| `unit` | ENUM(`KG`,`PIECES`) NOT NULL DEFAULT `KG` | every existing row becomes KG via the default |
| `quantity_kg` | DECIMAL(10,2) | **NOT NULL → nullable.** Existing values untouched. |
| `quantity_pieces` | INTEGER NULL, ≥ 1 | |
| `price_amount` | DECIMAL(12,4) NULL | line price "…cost ₹X" (copied from size or custom) |
| `price_pieces_count` | INTEGER NULL, ≥ 1 | line price "N pieces…" |
| `weight_kg` | DECIMAL(12,3) NULL, > 0 | line weight "…weigh W kg" |
| `weight_pieces_count` | INTEGER NULL, ≥ 1 | line weight "N pieces…" |
| `weight_source` | ENUM(`SIZE`,`MANUAL`) NULL | where the weight came from |

CHECK constraint (the no-double-counting rule):

```
(unit = 'KG'
   AND quantity_kg IS NOT NULL
   AND quantity_pieces IS NULL AND price_amount IS NULL AND price_pieces_count IS NULL
   AND weight_kg IS NULL AND weight_pieces_count IS NULL AND weight_source IS NULL)
OR
(unit = 'PIECES'
   AND quantity_pieces IS NOT NULL AND quantity_kg IS NULL AND rate_per_kg IS NULL
   AND price_amount IS NOT NULL AND price_pieces_count IS NOT NULL
   AND ((weight_kg IS NULL AND weight_pieces_count IS NULL AND weight_source IS NULL)
     OR (weight_kg IS NOT NULL AND weight_pieces_count IS NOT NULL AND weight_source IS NOT NULL)))
```

The KG branch deliberately does **not** require `rate_per_kg` — legacy rows may
have it NULL (the app falls back to the size's rate). Postgres validates all
existing rows when the constraint is added; any violation aborts the migration
with no changes.

### `invoice_items`

| Column | Type | Notes |
|---|---|---|
| `unit` | ENUM(`KG`,`PIECES`) NULL | NULL for plate-charge/advance rows **and all existing rows** |
| `price_amount` | DECIMAL(12,4) NULL | exact pieces price, as entered |
| `price_pieces_count` | INTEGER NULL | |

For PIECES items: `quantity` = pieces, `total_price` = rounded line amount,
`unit_price` = per-piece price rounded to 2 dp (kept only so any reader of the
old column still works; all UI uses the exact pair).

### Migration

- One migration file, one transaction (new enum types via `CREATE TYPE` are
  transactional; no `ALTER TYPE … ADD VALUE` needed).
- `down` reverses everything; it is only safe while no PIECES rows exist.
- Sequelize models and the `yars_assistant_ro` grants are verified to expose the
  new columns (table-level SELECT grants cover new columns).

## 2. Calculation rules — single source of truth

One module per side, identical behaviour, driven by one shared JSON file of
test vectors:
- Backend: `backend/src/services/orderMath.js` (CommonJS)
- Frontend: `frontend/src/utils/orderMath.js` (ESM)

| Function | Rule |
|---|---|
| `lineAmount(line, size)` | **KG:** `quantity_kg × (line.rate_per_kg ‖ size.rate_per_kg)` — exactly today's expression, **no added rounding**, so no existing total changes. **PIECES:** `round₂(quantity_pieces × price_amount ÷ price_pieces_count)`, half-up, exact decimal arithmetic (scaled BigInt) so it matches Postgres `ROUND(numeric, 2)` including ₹x.xx5 cases. |
| `lineKg(line)` | KG → `quantity_kg`. PIECES → `quantity_pieces × weight_kg ÷ weight_pieces_count`, or `null` if no weight. |
| `linePieces(line)` | PIECES → `quantity_pieces`. KG → `0`. |
| `orderTotal(order)` | Σ `lineAmount` + plate charge (`custom_plate_charge ‖ plateType.charge`) − `round_off_amount`. Unchanged formula. |
| `orderReceived / orderOutstanding` | Unchanged advance either/or rule. |
| `volumeSummary(orders)` | `{ kgFromKgLines, piecesTotal, kgFromPieces, piecesWithoutWeight, kgSold = kgFromKgLines + kgFromPieces }` — each line counted exactly once. |

Every place that computes these today switches to the module:
- Backend: `orderController`, `invoiceController`, `exportController`,
  `auditService.calculateOrderMetrics`.
- Frontend: `OrderForm`, `OrderList`, `OrderDetails`, `GenerateInvoiceForm`,
  `Dashboard`.

## 3. Back-fill of missing weights

When a size's weight is created or changed (`productSizeController` update),
in the **same transaction**:

```sql
UPDATE order_product_sizes
   SET weight_kg = :w, weight_pieces_count = :n, weight_source = 'SIZE'
 WHERE product_size_id = :sizeId AND unit = 'PIECES' AND weight_kg IS NULL;
```

- Only NULL-weight lines are touched; `SIZE`-frozen and `MANUAL` weights are
  never overwritten. Removing a size's weight clears nothing.
- Money columns are never touched by back-fill.
- The API returns the number of lines filled; the UI toasts
  "Weight added to N earlier order lines".
- Setting a weight inline from the order form saves it to the size through the
  same endpoint (so back-fill applies there too).

## 4. API changes

- **Product sizes** create/update accept `rate_per_kg` (optional),
  `piece_price_amount` + `piece_price_count`, `weight_kg` +
  `weight_pieces_count`. 400 on: no price at all, half a pair, count < 1,
  negative amounts, weight ≤ 0.
- **Orders** create/update: each `product_sizes[]` item carries `unit`
  (default `KG` when absent — keeps old clients working).
  - KG: `quantity_kg` (+ optional `rate_per_kg`) — unchanged behaviour.
  - PIECES: `quantity_pieces` (integer ≥ 1), optional `price_amount` +
    `price_pieces_count` (default: copy from size; 400 if the size has no piece
    price and none supplied), optional `weight_kg` + `weight_pieces_count`
    (supplied → `MANUAL` unless the client echoes back an unchanged `SIZE`
    weight with `weight_source: 'SIZE'`; absent → copy from size as `SIZE`, or
    NULL if the size has none).
  - Update keeps today's delete-and-recreate of lines; the client sends back
    each line's stored values so nothing is silently re-snapshotted.
- **Order responses** add per-line computed `line_amount`, `line_kg`, and
  per-order `volume` (`volumeSummary` of that order).
- **Invoice generation** uses `orderMath`; writes `unit` / price pair on items.

## 5. Screens

**Product Sizes form/list**
- Fields: Size label · Rate per kg (optional) · `[N] piece(s) cost ₹[X]`
  (N defaults to 1) · `[N] piece(s) weigh [W] kg`. Hints: "= ₹0.375 per piece",
  "≈ 10 g per piece".
- List shows `₹180/kg · ₹0.50/pc · 10 g/pc` ("—" for unset).
- Back-fill toast when applicable.

**Order form — per line**
- Size dropdown label shows available prices: `8×10 (₹180/kg · ₹0.50/pc)`.
- Unit toggle `[ Kg | Pcs ]`; only units the size has a price for are enabled;
  auto-selected when only one.
- Kg line: exactly today's fields.
- Pcs line: Quantity (pcs) · Price `[N] pcs cost ₹[X]` (prefilled, editable) ·
  Weight `[N] pcs weigh [W] kg` (prefilled, editable → MANUAL).
- No size weight → amber note with inline optional weight entry that saves to
  the size; skipping never blocks.
- Live read-out: `Amount ₹2,500.00 · ≈ 50 kg` / `kg: weight not set`.
- Mobile: fields stack, as today.
- **Invoiced order** (edit screen): banner "This order is on invoice
  #00000042 — changes here won't update the invoice. Delete and regenerate it
  to update."

**Order display** (Orders list, Order details, Customer details)
- Kg line unchanged: `8×10 · 50 kg × ₹180/kg = ₹9,000`.
- Pcs line: `8×10 · 5,000 pcs × ₹0.50/pc = ₹2,500 · ≈ 50 kg`, with a
  "measured" tag for MANUAL weight or "kg: weight not set".
- Orders page summary strip: Kg sold / Pieces sold (same rule as dashboard).

**Invoice screen + PDF**
- Rate column shows the price as entered: `Rs. 180.00 / kg`,
  `Rs. 375.00 / 1,000 pcs`, `Rs. 0.50 / pc`. Qty column: `50 kg`, `5,000 pcs`.
- Items with `unit` NULL (all existing invoices) render exactly as today.
- No estimated weight on invoices.

**Excel export (dashboard export)**
- Keep existing columns; "Quantity (kg)" filled for KG lines only.
- Add: Unit · Quantity (pcs) · Price (as entered) · Est. kg · Weight source.
- Totals row: kg from kg lines, pieces, est. kg from pieces, **Total kg sold**,
  pieces without weight.

**Dashboard summary bar** (above Recent Orders)
- Four pills (2×2 on phone): **Kg sold** (sub-line "1,150 kg ordered + ≈100 kg
  from pcs") · **Pieces sold** · Amount · Receivable.
- If un-weighted pieces exist: amber "+ 2,000 pcs without weight (not in kg)",
  tap → Product Sizes.
- Nothing else on the dashboard changes in this project.

## 6. Jarvis knowledge base (ships in the same deploy — required)

- `schema.md`: new columns and the KG/PIECES rule; canonical **line amount**
  expression:
  `CASE WHEN ops.unit = 'PIECES' THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2) ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END`
- The canonical pending/outstanding query switches to that expression; the rest
  of the query is unchanged.
- Canonical kg-sold / pieces-sold query with the no-double-counting rule and a
  pieces-without-weight count; instruction to always mention un-weighted pieces
  in kg answers.
- Walkthroughs (`orders.md`, `dashboard.md`, `invoices.md`, product-sizes
  section): new labels, reminder, back-fill, invoiced-order warning, new pills.

## 7. Testing

- **Shared vectors** (`backend/tests/fixtures/order-math-vectors.json`), run by
  Jest (backend) and Vitest (frontend; added as a dev dependency): legacy KG
  lines incl. NULL line rate, pieces with N = 1 and N = 1,000, half-paisa
  rounding, missing weight, mixed orders, plate charge / round-off / advance.
- **Migration test** on the Docker test DB: seed legacy-shaped rows, migrate,
  assert every old value unchanged; constraints reject double-counted and
  priceless lines; `down` works.
- **Back-fill tests**: fills only NULL-weight lines of that size; MANUAL and
  SIZE weights untouched; money columns untouched.
- **Controller tests**: size validation; order create/update for KG, PIECES,
  mixed; old-client payload without `unit` still works; invoice generation
  totals and items.
- **Jarvis query test**: new canonical pending query equals `orderMath`
  receivable on a mixed dataset.
- Code review of the full diff before deploy (money math + migration).

## 8. Rollout

Each production step needs the owner's go-ahead.

1. Full `pg_dump` (schema + data) → `~/yars-full-backup-<date>.sql`.
2. Read-only **before snapshot**: per order total / kg / receivable; per invoice
   amounts and item sums; all sizes → file.
3. Run migration (additive, single transaction).
4. **After snapshot** using the new unit-aware formula → diff must be
   **identical**. Any difference: stop, run `down`, investigate.
5. Deploy backend (Cloud Run), then frontend (Firebase). Every intermediate
   state is compatible (old code runs on the new schema; new backend accepts
   old frontend payloads).
6. Verify: health, Jarvis can read new columns, dashboard totals unchanged.
7. Full click-through is done **locally** (backend on the test DB, 390px
   browser). Production gets read-only checks only; the owner's first real
   pieces order is the live check, with numbers verified together.

Rollback: Firebase previous release; Cloud Run traffic back to `00017`; DB
`down` only while no PIECES rows exist (otherwise keep the schema — old code
runs on it).

## Out of scope

- Dashboard redesign (separate project; see follow-ups).
- Auto-updating invoices when an invoiced order is edited.
- Stock/inventory linkage of pieces (finished bags are not stocked).
- Server-side pagination for orders.
