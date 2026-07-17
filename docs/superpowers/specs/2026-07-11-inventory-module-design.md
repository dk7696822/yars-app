# Inventory Module — Design Spec

**Date:** 2026-07-11
**Project:** YARS (non-woven bag factory back-office)
**Status:** Approved for planning

## 1. Purpose

YARS today tracks money and work — orders, invoices, payments, expenses — but has no record of
**physical material**. The system cannot say whether there is fabric on hand to fulfil an order,
what that fabric cost, or when to reorder.

The Inventory module adds raw-material management: what was ordered from suppliers, what was
actually received, what is in stock, what it is worth, how much is needed, and how much is lost
to wastage.

**Scope:** raw material only — non-woven fabric plus consumables (handles, thread, ink, packing).
Finished bags are made to order and ship out; they are not stocked and are out of scope.

## 2. Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| What is stocked | Raw material only | Made-to-order factory; finished goods never sit in stock |
| Consumption | Manual issue entries | Orders carry no fabric field; keeps existing billing logic untouched |
| Reorder signal | Reorder level per item | Works without coupling to Orders; "on order" shown alongside |
| Costing | FIFO batches | True cost per issue; traceable to supplier lot |
| Expenses relationship | Material leaves Expenses | Purchases recorded only in Inventory — no double-counting |
| Suppliers | Proper master table | Per-supplier history and outstanding deliveries |
| Units | Fixed enum per item | Physical, finite, code reasons about it; free text fragments data |
| Categories | User-managed CRUD table | Business taxonomy, must change without a migration |
| Item variations (cut, GSM, colour) | User-managed attributes + values | Hardcoded columns can't keep up with the factory's vocabulary; user extends from the UI. Unit stays a fixed enum because it drives stock math |
| Stock balance | Batch remainders + movement ledger | FIFO needs batches anyway; ledger gives audit + reconciliation |

### Why material purchases leave the Expenses module

Recording a fabric purchase in both Expenses and Inventory would double-count it in any total-cost
view. Going forward, material purchases are recorded **only** as goods receipts in Inventory.
Expenses keeps everything else — rent, electricity, salaries, transport. Material cost then enters
the P&L as *material consumed* (via issues), which is the accounting-correct treatment.

Existing material rows already in Expenses remain as historical records; nothing is migrated or
deleted.

### Why stock is not a cached column

A `current_stock` column on the item is the fastest thing to read and the easiest thing to get
wrong: after a crash mid-transaction or a bad edit it silently disagrees with reality, and there is
no way to tell which number is right. Instead:

- **Stock on hand** = `SUM(stock_batches.quantity_remaining)` for the item — authoritative, and it
  is the same data FIFO already requires.
- **`stock_movements`** is an append-only ledger of every event, used for history and for
  reconciliation against the batch remainders.

## 3. Data model

Eleven new tables. Follows existing YARS conventions throughout: Sequelize models, UUID primary
keys, `underscored: true`, snake_case table names, `is_archived` soft deletes, timestamps.

### Masters

**`inventory_categories`** — cloned from the existing `expense_categories` pattern.
- `id` (UUID, PK), `name` (TEXT, unique, not empty), `is_archived` (bool), timestamps.
- Seeded with: Fabric, Handle, Thread, Ink, Packing.
- Full CRUD. Delete is soft, and is **refused while any non-archived item still references the
  category** — mirrors `expenseCategoryController.deleteExpenseCategory`.

**`suppliers`** — mirrors the `customers` table.
- `id`, `name` (TEXT, not empty), `phone`, `email`, `gst_number`, `address`, `is_archived`, timestamps.

**`inventory_items`**
- `id`, `name` (TEXT, not empty), `item_code` (TEXT, unique, nullable)
- `category_id` (UUID, FK → inventory_categories)
- `unit` (ENUM: `KG`, `PCS`, `METRE`, `ROLL`, `LITRE`)
- `reorder_level` (DECIMAL(12,3), default 0) — at or below this, the item reads as low stock
- `reorder_target` (DECIMAL(12,3), nullable) — top back up to this; suggested qty = target − in_stock.
  **If null, the suggested qty falls back to `reorder_level − in_stock`.**
- `notes` (TEXT, nullable), `is_archived` (bool), timestamps

### Item attributes

Raw materials vary — by cut type (D Cut, W Cut, U Cut, Loop Handle), by GSM, by colour, by whatever
the next supplier invents. Hardcoded columns cannot keep up, so item variations follow the same
philosophy as categories: **user-managed definitions and values, chosen via dropdowns on the item,
full CRUD, nothing baked into code.** `unit` stays a fixed enum because units drive stock math;
attributes are purely descriptive.

**`item_attributes`**
- `id`, `name` (TEXT, unique, not empty), `is_archived`, timestamps.
- Seeded with: Cut, GSM, Color.

**`item_attribute_values`**
- `id`, `attribute_id` (FK → item_attributes, RESTRICT), `value` (TEXT, not empty), `is_archived`, timestamps.
- UNIQUE(`attribute_id`, `value`); index on `attribute_id`.
- Seeded: Cut → D Cut, W Cut, U Cut, Loop Handle; GSM → 60, 70, 80, 90, 100; Color → none
  (colours are business-specific — the user adds their own).

**`inventory_item_attribute_values`** — the link table.
- `id`, `item_id` (FK → inventory_items, CASCADE), `attribute_id` (FK → item_attributes, RESTRICT),
  `attribute_value_id` (FK → item_attribute_values, RESTRICT), timestamps.
- **UNIQUE(`item_id`, `attribute_id`)** — an item holds at most **one** value per attribute.
- **Composite FK** `(attribute_value_id, attribute_id)` → `item_attribute_values(id, attribute_id)`
  (backed by a UNIQUE on that pair in the values table) — a value can never be paired with an
  attribute it does not belong to.
  `attribute_id` is deliberately denormalised into the link row precisely so both rules can live in
  the database rather than in application code. The controller re-checks them only to produce
  friendly errors — and enforces the one rule the schema cannot express: an item may not be linked
  to an **archived** value.

Deleting an attribute or a value is soft, and is **refused while any non-archived item still uses
it** — the same guard as categories.

This replaces the earlier idea of `gsm` and `color` columns on the item: they become seeded "GSM"
and "Color" attributes instead. One mechanism, user-extensible, no duplicates.

### Procurement

**`purchase_orders`**
- `id`, `po_number` (TEXT, unique — generated), `supplier_id` (FK)
- `order_date` (DATEONLY), `expected_date` (DATEONLY, nullable)
- `status` (ENUM: `PENDING`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`, default `PENDING`)
- `notes`, `is_archived`, timestamps

**`purchase_order_items`**
- `id`, `purchase_order_id` (FK), `item_id` (FK)
- `quantity_ordered` (DECIMAL(12,3), > 0), `rate` (DECIMAL(14,2), ≥ 0)
- `quantity_received` (DECIMAL(12,3), default 0) — rolling total across receipts
- timestamps

**This pair answers "how much we ordered vs how much we received"**, including partial deliveries.

**`goods_receipts`** — an actual delivery arriving.
- `id`, `receipt_number` (TEXT, unique — generated)
- `purchase_order_id` (FK, **nullable** — material can arrive without a PO)
- `supplier_id` (FK), `receipt_date` (DATEONLY)
- `supplier_bill_ref` (TEXT, nullable), `notes`, `is_archived`, timestamps

**`goods_receipt_items`**
- `id`, `goods_receipt_id` (FK), `purchase_order_item_id` (FK, nullable), `item_id` (FK)
- `quantity_received` (DECIMAL(12,3), > 0)
- `rate` (DECIMAL(14,2), ≥ 0) — the rate **actually charged**; the receipt is the truth, not the PO
- timestamps

### Stock

**`stock_batches`** — the FIFO lots. One row per goods-receipt line.
- `id`, `item_id` (FK), `goods_receipt_item_id` (FK)
- `received_date` (DATEONLY)
- `quantity_received` (DECIMAL(12,3)), `quantity_remaining` (DECIMAL(12,3), ≥ 0, and ≤ `quantity_received` — both CHECK-enforced)
- `rate` (DECIMAL(14,2))
- `sequence_number` (BIGINT identity, DB-generated) — deterministic FIFO tiebreaker; `received_date`
  is a DATEONLY, so same-day batches would otherwise have no stable order
- timestamps
- Index on `(item_id, received_date, sequence_number)` — every FIFO walk hits this.

Derived: **stock on hand** = `SUM(quantity_remaining)`; **stock value** = `SUM(quantity_remaining × rate)`.

**`stock_movements`** — append-only ledger. Never updated, never deleted.
- `id`, `item_id` (FK)
- `movement_type` (ENUM: `RECEIPT`, `ISSUE`, `WASTAGE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`)
- `quantity` (DECIMAL(12,3), signed: positive in, negative out)
- `stock_batch_id` (FK, nullable — null for `ADJUSTMENT_IN`, which creates its own batch)
- `unit_cost` (DECIMAL(14,2)), `total_cost` (DECIMAL(14,2))
- `reference_type` (ENUM: `GOODS_RECEIPT`, `STOCK_ISSUE`, `STOCK_ADJUSTMENT`), `reference_id` (UUID)
- `order_id` (UUID, FK → orders, **nullable**) — optional tag linking consumption to a customer
  order. Nullable and one-directional: Orders remain completely unaware of Inventory.
- `movement_date` (DATEONLY), `notes` (TEXT), `created_at`
- Indexes on `(item_id, movement_date)` and `(reference_type, reference_id)`.

**`stock_issues`** + **`stock_issue_items`** — material leaving stock (production, wastage, adjustment).
- `stock_issues`: `id`, `issue_number` (unique — generated), `issue_date` (DATEONLY),
  `issue_type` (ENUM: `ISSUE`, `WASTAGE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`),
  `order_id` (FK, nullable), `reason` (TEXT — **required** for adjustments), `notes`,
  `is_archived`, timestamps
- `stock_issue_items`: `id`, `stock_issue_id` (FK), `item_id` (FK),
  `quantity` (DECIMAL(12,3), > 0), `total_cost` (DECIMAL(14,2) — computed FIFO cost),
  `wastage_quantity` (DECIMAL(12,3), default 0), `wastage_cost` (DECIMAL(14,2), default 0),
  timestamps

**Wastage rides along on a normal issue line.** A production line of `quantity` 500 with
`wastage_quantity` 20 consumes **520** from stock: 500 written as `ISSUE` movements and 20 as
`WASTAGE` movements, each costed FIFO. This keeps daily entry to one form and one document — the
factory user records what he consumed and what was lost in the same row — while wastage remains a
distinct movement type, separately reportable in quantity and cost.

A header `issue_type` of `WASTAGE` (a pure write-off with no production against it) remains
available, as do the two adjustment types.

Issuing 500 kg when the oldest open batch holds 300 kg produces **two** `stock_movements` rows at
two different rates. That split is what makes the cost true.

### Audit

`audit_logs.entity_type` is currently `ENUM('PAYMENT','ORDER')`. Extend it with
`GOODS_RECEIPT`, `STOCK_ISSUE`, `PURCHASE_ORDER` so inventory activity appears in the existing
History page. Postgres enum values are added via `ALTER TYPE ... ADD VALUE`, which **cannot run
inside a transaction block** — the migration must therefore not be wrapped in one, or must recreate
the type instead. Getting this wrong fails on deploy, not locally.

**Known limitation:** the app has a single shared hardcoded credential and the backend performs no
authentication, so audit entries cannot attribute an action to a person. Every entry looks
identical regardless of who made it. Pre-existing; out of scope for this module; worth addressing
separately now that a second person (factory) uses the app daily.

## 4. Business logic — `stockService`

All stock mutation lives in **one service**, not spread across controllers. Every operation runs in
a **database transaction**.

### `receiveStock(receipt)`
1. Create `goods_receipts` + `goods_receipt_items`.
2. For each line: create a `stock_batch` (`quantity_remaining` = `quantity_received`, at the
   receipt's rate) and a `RECEIPT` movement.
3. If linked to a PO: increment `purchase_order_items.quantity_received`, then recompute PO status —
   `RECEIVED` when every line is fully received, else `PARTIALLY_RECEIVED`.

Over-receiving against a PO line (more than ordered) is **allowed but flagged in the UI** — suppliers
do over-deliver, and blocking it would just push the user to fudge the numbers.

### `issueStock(issue)` — also handles wastage
1. **Lock** the item's open batches (`SELECT ... FOR UPDATE`, ordered by `received_date` ASC,
   `sequence_number` ASC — the identity column breaks ties between same-day batches) so two
   concurrent issues cannot spend the same batch twice.
2. Validate: available stock ≥ **`quantity` + `wastage_quantity`** for the line. **If not, abort the
   whole transaction** with a clear error naming the item, the requested qty, and the available qty.
   Stock is never allowed to go negative.
3. Walk batches oldest-first, decrementing `quantity_remaining`, writing one movement row per batch
   touched, each at that batch's rate. Consumption is written as `ISSUE` movements; the wastage
   portion is written as `WASTAGE` movements — both drawn from the same FIFO walk, wastage taken
   after consumption.
4. Sum the per-batch costs into `stock_issue_items.total_cost` and `wastage_cost` respectively.

### `adjustStock(adjustment)`
- `ADJUSTMENT_OUT` (damage, stock-take shortfall): consumes FIFO, exactly like an issue.
- `ADJUSTMENT_IN` (stock-take surplus): creates a **new batch**. Its rate is the item's most recent
  batch rate, or 0 if the item has never been received.
- `reason` is **required** — an unexplained stock correction is worthless six months later.

### Derived values

| Question | Computation |
|---|---|
| How much we ordered | `purchase_order_items.quantity_ordered` |
| How much we received | `purchase_order_items.quantity_received` |
| How much is on order | `SUM(quantity_ordered − quantity_received)` over non-cancelled, non-complete POs |
| How much we have | `SUM(stock_batches.quantity_remaining)` |
| What it is worth | `SUM(quantity_remaining × rate)` |
| How much we need | `reorder_target − in_stock`, where `in_stock ≤ reorder_level` |
| What it cost us | FIFO cost on issue movements |
| What we wasted | `WASTAGE` movements, qty and cost |

Wastage never inflates consumption: `ISSUE` and `WASTAGE` movements are separate rows, so the cost
of material actually used and the cost of material lost are always distinguishable.

## 5. API

Mounted in `backend/src/routes/index.js` beside the existing routers. Uses the existing
`success` / `error` response helpers from `utils/response.js`.

```
/api/inventory-categories   GET, POST, GET/:id, PUT/:id, DELETE/:id
/api/item-attributes        GET (attributes with values nested), POST, PUT/:id, DELETE/:id
                            POST /:id/values      → add a value to an attribute
                            PUT /values/:valueId, DELETE /values/:valueId
/api/suppliers              GET, POST, GET/:id, PUT/:id, DELETE/:id
/api/inventory-items        GET, POST, GET/:id, PUT/:id, DELETE/:id
/api/purchase-orders        GET, POST, GET/:id, PUT/:id, DELETE/:id
                            POST /:id/receive     → create goods receipt against this PO
/api/goods-receipts         GET, POST, GET/:id
/api/stock-issues           GET, POST, GET/:id    (issue | wastage | adjustment)
/api/stock                  GET                   → stock-on-hand list (the Stock page)
                            GET /summary          → headline stats
                            GET /:itemId          → item detail: batches + stock + value
                            GET /:itemId/movements → paginated movement history
/api/export/inventory       GET                   → Excel (stock / movements / purchases)
```

**Server-side pagination and filtering on every list endpoint.** Existing YARS list endpoints return
every row and paginate client-side by slicing the array (see `Orders.jsx`). That does not work for a
movement ledger, which grows without bound. All Inventory list endpoints take `page`, `limit`,
`search`, and their relevant filters, and return `{ data, pagination: { page, limit, total,
totalPages } }`.

Filters per endpoint:
- **Stock:** search by name/code, filter by category, filter by attribute value, low-stock-only toggle, sort by name / stock / value
- **Items:** search, category, attribute value, archived
- **Purchase orders:** search by PO number/supplier, supplier, status, date range
- **Movements:** item, movement type, date range
- **Issues:** date range, type, order tag

## 6. Frontend

New **Inventory** section in `Sidebar.jsx`, six pages. **Mobile-first — the factory user works on a
phone on the shop floor.** Desktop is a secondary concern: the layouts should not break on it, but
mobile drives the design. Reuses existing `ResponsiveTable`, `MobileActionDropdown`, `Modal`,
`ConfirmationModal`, `Spinner`, and the established Tailwind/dark-theme system.

**Stock** (landing page, the one used most)
- Headline stats: total stock value, items below reorder level, value received this month, value
  consumed this month.
- Item list: name, category, unit, attribute chips (e.g. *W Cut · 60*), **in stock**, **on order**,
  **stock value**, reorder level, status pill. Items at or below reorder level show **Low stock**
  with a suggested purchase qty.
- Search + category filter + attribute-value filter + low-stock-only toggle, all server-side.
- Cards on mobile, table on desktop.

**Item detail** — current stock and value; open FIFO batches (received date, supplier, rate, qty
remaining); full paginated movement history.

**Purchase Orders** — list (search, status, supplier, date filters); create/edit (supplier, item
lines with qty + rate, live total); detail showing **ordered vs received per line** with the
shortfall, and a **Receive** action that opens a goods receipt pre-filled from the outstanding
quantities, with both qty and rate editable. Partial deliveries: receive repeatedly against the same
PO until complete.

**Stock Issues** — the daily-use screen, **optimised for speed on a phone**:
- Date defaults to today.
- Item picker surfaces recently-used items first.
- Add-a-line: item, quantity, optional wastage on the same line.
- Optional customer-order tag.
- Target: a typical day's entry in under a minute. If this is slow, it will not get used, and every
  number in the module degrades.
- Same form, with a type switch and a mandatory reason, handles adjustments.

**Suppliers** — CRUD cloned from Customers, plus a detail page showing that supplier's POs and total
purchased.

**Categories** — simple CRUD list, cloned from the Expense Categories page.

**Item attributes** — accordion list of attributes, each expanding to its values; add / rename /
delete inline at both levels, with the in-use delete guards surfaced. The item create/edit forms
render **one dropdown per non-archived attribute** (each optional, with a "—" empty choice) in
place of hardcoded GSM/colour inputs. Reached from the Inventory Items page, beside Categories.

**Excel export** — stock, movements, and purchases, following the existing `exportController` xlsx
pattern. The Stock sheet carries a single flattened **Attributes** column (`Cut: W Cut; GSM: 60`).

**Not building:** a separate Inventory dashboard page. The stats live on the Stock page, where the
user already is. A tile on the main Dashboard can come later.

## 7. Testing

The repo has no test suite (`npm test` is a stub). This module introduces money-and-quantity logic
where silent errors compound invisibly, so `stockService` gets tests even though nothing else in the
repo does. Cases that must be covered:

1. **FIFO across batches** — issuing 500 from batches of 300 @ ₹80 and 400 @ ₹90 leaves 200 in the
   second batch and costs 300×80 + 200×90.
2. **Exact batch exhaustion** — issuing exactly the oldest batch's remainder leaves it at 0, not negative.
3. **Insufficient stock** — issuing more than available rolls back the *entire* transaction; no
   partial consumption, no batch left decremented.
4. **Negative stock is impossible** — under every path, including adjustments.
5. **Partial receipt** — PO goes `PENDING` → `PARTIALLY_RECEIVED` → `RECEIVED` across two deliveries,
   with `quantity_received` accumulating correctly.
6. **Over-receipt** — receiving more than ordered succeeds and is flagged.
7. **Receipt without a PO** — creates batches and movements correctly.
8. **Rate change between PO and receipt** — the batch carries the receipt's rate, not the PO's.
9. **Concurrent issues** — two simultaneous issues of the same item cannot double-spend a batch.
10. **Reconciliation** — `SUM(batch remainders)` always equals the sum of the movement ledger for
    every item.
11. **Category delete guard** — deleting a category still in use is refused.

Manual verification: run through the real flow end-to-end — create a supplier and item, raise a PO,
receive it partially, issue material, record wastage, confirm stock and value are right at each step.

## 8. Out of scope

- Authentication and per-user attribution (pre-existing gap; should be addressed separately).
- Linking fabric to customer orders / auto-deduction from orders.
- Finished-goods stock.
- Purchase-unit → stock-unit conversion (e.g. buy by the roll, stock in kg).
- Migrating historical material rows out of Expenses.
- Multi-location / warehouse stock.
