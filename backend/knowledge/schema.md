# Database schema (PostgreSQL / Sequelize)

## Global quirks — read before writing SQL

- All PKs are UUIDs (column `id`). FKs are UUIDs too.
- Soft deletes: most tables have `is_archived BOOLEAN NOT NULL DEFAULT false`.
  Live rows = `is_archived = false`. "Deleted" records are archived, not removed.
  Exceptions with NO `is_archived`: `payments`, `order_product_sizes`,
  `invoice_items`, `purchase_order_items`, `goods_receipt_items`,
  `stock_batches`, `stock_issue_items`, `stock_movements`, `audit_logs`,
  `users`, `item attribute link tables` (see below), `assistant_messages`.
- DECIMAL columns are returned as strings by the driver — cast/parse when doing
  arithmetic in the app; in SQL they behave as numerics normally.
- Timestamps: `created_at`, `updated_at` (TIMESTAMPTZ). `stock_movements` has
  only `created_at` (append-only); `audit_logs` only `created_at`;
  `order_product_sizes` has neither.
- **Stock truth**: current stock of an item =
  `SELECT SUM(quantity_remaining) FROM stock_batches WHERE item_id = ?`.
  Equivalently `SUM(quantity) FROM stock_movements` per item (signed ledger) —
  both are kept in sync; batches are the authoritative source.
- `stock_movements` is an append-only signed ledger: positive quantity = into
  stock (RECEIPT, ADJUSTMENT_IN), negative = out (ISSUE, WASTAGE,
  ADJUSTMENT_OUT). Rows are never updated or deleted.
- Document numbers: purchase orders `PO-2026-0001`, goods receipts `GR-2026-0001`,
  stock issues `ISS-2026-0001` (year + zero-padded sequence). Invoices use a
  plain 8-digit sequence: `00000001`, `00000002`, …
- Two module generations: "original" (customers, orders, invoices, payments,
  expenses, plate_types, product_sizes, audit_logs) and "inventory" (suppliers,
  inventory_*, purchase_*, goods_*, stock_*, item_attribute*). They are linked
  only via `stock_issues.order_id` / `stock_movements.order_id` (optional tags).
- `orders` has **no** `total_amount` column — the API computes it:
  SUM(line amount) + plate charge (`COALESCE(orders.custom_plate_charge, plate_types.charge)`)
  − `COALESCE(orders.round_off_amount, 0)`, where **line amount** is exactly:
  `CASE WHEN ops.unit = 'PIECES' THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2) ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END`
- **Units — never double count:** every order line is EITHER a kg line
  (`unit = 'KG'`: `quantity_kg` × rate) OR a pieces line (`unit = 'PIECES'`:
  `quantity_pieces` priced "N pieces cost ₹X" = `price_pieces_count` pieces
  cost `price_amount`). Kg sold = kg of KG lines + ESTIMATED kg of PIECES
  lines (`quantity_pieces × weight_kg / weight_pieces_count`); PIECES lines
  with NULL weight have unknown kg — always say how many pieces are
  unweighted when answering kg questions. Never add `quantity_kg` and
  pieces-estimated kg of the same line (a line is only ever one unit).
- **Advance rule — tricky, do not improvise:** an order's advance is EITHER the
  sum of its `payments` rows with `payment_type = 'ADVANCE'` (when any exist) OR
  the legacy `orders.advance_received` column — NEVER both. Many old orders have
  the same advance recorded in both places, so adding them double-counts.
  Paid = `SUM(payments.amount)` where `payment_type <> 'ADVANCE'`.
  Pending = total − paid − advance.
- **For ANY pending / outstanding / due / balance question, use exactly this
  query** (it matches the app's dashboard to the rupee). Aggregate the final
  SELECT differently as needed (total, per customer, top N) but never change
  the balance computation inside `order_calc`:

<!-- canonical:pending -->
  WITH order_calc AS (
    SELECT o.customer_id,
      COALESCE((SELECT SUM(CASE WHEN ops.unit = 'PIECES'
                                THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2)
                                ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END)
                FROM order_product_sizes ops JOIN product_sizes ps ON ps.id = ops.product_size_id
                WHERE ops.order_id = o.id), 0)
      + COALESCE(o.custom_plate_charge, pt.charge, 0)
      - COALESCE(o.round_off_amount, 0)
      - COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END) FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type <> 'ADVANCE'), 0)
      - CASE WHEN COALESCE((SELECT SUM(p.amount) FROM payments p
                            WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE'), 0) > 0
             THEN (SELECT SUM(p.amount) FROM payments p
                   WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE')
             ELSE COALESCE(o.advance_received, 0) END AS balance
    FROM orders o
    LEFT JOIN plate_types pt ON pt.id = o.plate_type_id
    WHERE o.is_archived = false AND o.status <> 'CANCELLED'
  )
  SELECT c.name, ROUND(SUM(oc.balance), 2) AS pending
  FROM order_calc oc JOIN customers c ON c.id = oc.customer_id
  GROUP BY c.name HAVING SUM(oc.balance) > 0 ORDER BY pending DESC
<!-- /canonical:pending -->
- Refunds (`payment_type = 'REFUND'`) are money given back — always subtract
  them from received. Cancelled orders are never owed.
- **For ANY kg sold / pieces sold / volume question, use exactly this query**
  (add date/customer filters on `o` as needed; never change the sums):

<!-- canonical:volume -->
  SELECT
    ROUND(COALESCE(SUM(ops.quantity_kg) FILTER (WHERE ops.unit = 'KG'), 0), 3) AS kg_from_kg_lines,
    ROUND(COALESCE(SUM(ops.quantity_pieces * ops.weight_kg / ops.weight_pieces_count)
          FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NOT NULL), 0), 3) AS kg_from_pieces,
    ROUND(COALESCE(SUM(ops.quantity_kg) FILTER (WHERE ops.unit = 'KG'), 0)
          + COALESCE(SUM(ops.quantity_pieces * ops.weight_kg / ops.weight_pieces_count)
            FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NOT NULL), 0), 3) AS kg_sold,
    COALESCE(SUM(ops.quantity_pieces) FILTER (WHERE ops.unit = 'PIECES'), 0) AS pieces_total,
    COALESCE(SUM(ops.quantity_pieces) FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NULL), 0) AS pieces_without_weight
  FROM order_product_sizes ops
  JOIN orders o ON o.id = ops.order_id
  WHERE o.is_archived = false
<!-- /canonical:volume -->
- Active-name uniqueness on master tables is via partial unique indexes
  (`WHERE is_archived = false`) — archived names can be reused.

## Original modules

### customers
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| name | TEXT NOT NULL | customer name |
| metadata | JSONB | `{phone, email, address, city, gstin}` — contact details live here, NOT in columns |
| is_archived | BOOLEAN | soft delete |
| created_at / updated_at | TIMESTAMPTZ | |

### plate_types
`id`, `type_name TEXT` (name), `charge DECIMAL(10,2)` (default plate charge ₹),
`is_archived`, timestamps. Referenced by orders.

### product_sizes
`id`, `size_label TEXT` (e.g. "8x10"), `rate_per_kg DECIMAL(10,2) NULL` (default
₹/kg; NULL = sold only by pieces), `piece_price_amount DECIMAL(12,4) NULL` +
`piece_price_count INTEGER NULL` ("N pieces cost ₹X" — e.g. 1000 pcs cost
₹375 → per piece ₹0.375), `weight_kg DECIMAL(12,3) NULL` + `weight_pieces_count
INTEGER NULL` ("N pieces weigh W kg"), `is_archived`, timestamps. A size has at
least one of rate_per_kg / piece price.

### orders
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK → customers.id | |
| order_date | DATE | |
| advance_received | DECIMAL(10,2) | advance taken at order time |
| plate_type_id | UUID FK → plate_types.id | |
| custom_plate_charge | DECIMAL(10,2) NULL | overrides plate_types.charge when set |
| round_off_amount | DECIMAL(10,2) | subtracted from the total (can be negative) |
| status | ENUM | PENDING, IN_PROGRESS, COMPLETED, DELIVERED, CANCELLED |
| invoice_id | UUID FK → invoices.id NULL | set once the order is billed |
| is_archived | BOOLEAN | soft delete |
| created_at / updated_at | | |

### order_product_sizes (order line items)
`id`, `order_id FK → orders`, `product_size_id FK → product_sizes`,
`unit ENUM('KG','PIECES')`, and either
- KG: `quantity_kg DECIMAL(10,2)`, `rate_per_kg DECIMAL(10,2)` (rate frozen for
  this order; may differ from the master rate), or
- PIECES: `quantity_pieces INTEGER`, `price_amount DECIMAL(12,4)` +
  `price_pieces_count INTEGER` (price frozen for this order), and optionally
  `weight_kg` + `weight_pieces_count` + `weight_source ENUM('SIZE','MANUAL')`
  (SIZE = copied from the size, MANUAL = measured for this order).
The other unit's columns are NULL (DB-enforced). No timestamps, no is_archived.
Line amount: see the CASE expression above.

### invoices
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK → customers | |
| invoice_number | VARCHAR UNIQUE | 8-digit sequence, e.g. "00000042" |
| invoice_date | DATE | |
| billing_period_start / billing_period_end | DATE | |
| payment_due_date | DATE NULL | |
| total_amount | DECIMAL(10,2) | subtotal (orders total, pre-tax, pre-advance) |
| tax_percent | DECIMAL(5,2) | |
| tax_amount | DECIMAL(10,2) | |
| final_amount | DECIMAL(10,2) | total_amount + tax_amount |
| status | ENUM | PENDING, PAID, CANCELLED |
| is_archived | BOOLEAN | |

### invoice_items
`id`, `invoice_id FK → invoices`, `order_id FK → orders NULL`,
`description TEXT`, `quantity DECIMAL(10,2)` (kg or pieces), `unit_price
DECIMAL(10,2)` (can be NEGATIVE — advance payments appear as negative lines with
description containing "Advance Payment"), `total_price DECIMAL(10,2)`,
`unit ENUM('KG','PIECES') NULL` (NULL for plate-charge/advance lines and for
items created before piece orders existed), `price_amount` + `price_pieces_count`
(pieces price as entered), timestamps.

### payments
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| invoice_id | UUID FK → invoices NULL | set for invoice payments |
| order_id | UUID FK → orders NULL | set for order payments |
| customer_id | UUID FK → customers NOT NULL | always set |
| payment_type | ENUM | ADVANCE, PARTIAL, FINAL, REFUND |
| amount | DECIMAL(10,2) | |
| payment_date | DATE | |
| payment_method | ENUM | CASH, BANK_TRANSFER, UPI, CHECK, OTHER |
| reference_number | VARCHAR NULL | txn id / cheque no |
| notes | TEXT NULL | |
No `is_archived` — payments are hard-deleted (audited in audit_logs).

### expense_categories
`id`, `name TEXT UNIQUE`, `is_archived`, timestamps.

### expenses
`id`, `bill_date DATE`, `category_id FK → expense_categories`,
`description TEXT`, `vendor TEXT`, `quantity INTEGER (>=1)`,
`unit_cost DECIMAL(10,2)`, `total_cost DECIMAL(10,2)` (= quantity × unit_cost),
`due_date DATE NULL`, `payment_status ENUM('PAID','UNPAID')`, `is_archived`,
timestamps.

### audit_logs (History screen)
`id`, `entity_type ENUM('PAYMENT','ORDER','PURCHASE_ORDER','GOODS_RECEIPT','STOCK_ISSUE')`,
`entity_id UUID` (polymorphic, no FK), `action ENUM('CREATE','UPDATE','DELETE')`,
`old_values JSONB`, `new_values JSONB`, `changed_fields TEXT[]`,
`metadata JSONB` (customer_name, before/after payment metrics, etc.),
`created_at` only.

### users
`id`, `username TEXT UNIQUE`, `password_hash TEXT` (bcrypt),
`display_name TEXT`, timestamps. Never show password_hash.

### assistant_conversations / assistant_messages
Conversations: `id`, `title TEXT`, `is_archived`, timestamps.
Messages: `id`, `conversation_id FK`, `role TEXT ('user'|'assistant')`,
`content TEXT`, timestamps.

## Inventory module (raw materials only — finished bags are never stocked)

### suppliers
`id`, `name TEXT`, `phone TEXT NULL`, `email TEXT NULL`, `gst_number TEXT NULL`,
`address TEXT NULL`, `is_archived`, timestamps.

### inventory_categories
`id`, `name TEXT` (unique among live rows), `is_archived`, timestamps.

### inventory_items
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| name | TEXT | material name |
| item_code | TEXT NULL | optional code, unique among live rows |
| category_id | UUID FK → inventory_categories | |
| unit | ENUM | KG, PCS, METRE, ROLL, LITRE |
| reorder_level | DECIMAL(12,3) | low-stock threshold (0 = no alert) |
| reorder_target | DECIMAL(12,3) NULL | restock-to level; suggested buy = target − in_stock |
| notes | TEXT NULL | |
| is_archived | BOOLEAN | |

### item_attributes / item_attribute_values / inventory_item_attribute_values
- `item_attributes`: `id`, `name TEXT` (e.g. Cut, GSM, Color), `is_archived`.
- `item_attribute_values`: `id`, `attribute_id FK → item_attributes`,
  `value TEXT` (e.g. "W Cut", "60"), `is_archived`.
- `inventory_item_attribute_values` (link): `id`, `item_id FK → inventory_items`,
  `attribute_id FK`, `attribute_value_id FK → item_attribute_values`,
  UNIQUE(item_id, attribute_id) — one value per attribute per item.

### purchase_orders
`id`, `po_number TEXT UNIQUE` (PO-2026-0001), `supplier_id FK → suppliers`,
`order_date DATE`, `expected_date DATE NULL`,
`status ENUM('PENDING','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')`,
`notes TEXT NULL`, `is_archived`, timestamps. Status moves automatically as
receipts are recorded. Total value = SUM(items quantity_ordered × rate).

### purchase_order_items
`id`, `purchase_order_id FK`, `item_id FK → inventory_items`,
`quantity_ordered DECIMAL(12,3)`, `rate DECIMAL(14,2)`,
`quantity_received DECIMAL(12,3)` (running total; may EXCEED ordered —
over-receiving is allowed), timestamps. Pending = ordered − received (floor 0).

### goods_receipts
`id`, `receipt_number TEXT UNIQUE` (GR-2026-0001),
`purchase_order_id FK NULL` (NULL = direct receipt without a PO),
`supplier_id FK NOT NULL`, `receipt_date DATE`, `supplier_bill_ref TEXT NULL`,
`notes TEXT NULL`, `is_archived`, timestamps.
Receipts have NO edit/delete anywhere — corrections go through adjustments.

### goods_receipt_items
`id`, `goods_receipt_id FK`, `purchase_order_item_id FK NULL`,
`item_id FK → inventory_items`, `quantity_received DECIMAL(12,3)`,
`rate DECIMAL(14,2)`, timestamps. Each row spawns exactly one stock_batch.

### stock_batches (FIFO lots — THE stock truth)
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| item_id | UUID FK → inventory_items | |
| goods_receipt_item_id | UUID FK NULL | NULL for adjustment-in batches |
| received_date | DATE | FIFO key #1 (oldest consumed first) |
| sequence_number | BIGINT identity | FIFO tiebreaker for same-day batches |
| quantity_received | DECIMAL(12,3) | original size |
| quantity_remaining | DECIMAL(12,3) | what's left — SUM per item = current stock |
| rate | DECIMAL(14,2) | unit cost of this lot; stock value = SUM(remaining × rate) |

### stock_issues (header for issues/wastage/adjustments)
`id`, `issue_number TEXT UNIQUE` (ISS-2026-0001), `issue_date DATE`,
`issue_type ENUM('ISSUE','WASTAGE','ADJUSTMENT_IN','ADJUSTMENT_OUT')`,
`order_id FK → orders NULL` (optional customer-order tag; issues only),
`reason TEXT NULL` (mandatory for adjustments), `notes TEXT NULL`,
`is_archived`, timestamps. No edit/delete after creation.

### stock_issue_items
`id`, `stock_issue_id FK`, `item_id FK → inventory_items`,
`quantity DECIMAL(12,3)` (issued/adjusted qty),
`total_cost DECIMAL(14,2)` (FIFO cost of the issued qty),
`wastage_quantity DECIMAL(12,3)` (same-line wastage — consumed IN ADDITION to
quantity: issue 500 + 20 wastage removes 520 from stock),
`wastage_cost DECIMAL(14,2)`, timestamps.

### stock_movements (append-only signed ledger)
| column | type | meaning |
|---|---|---|
| id | UUID PK | |
| item_id | UUID FK → inventory_items | |
| movement_type | ENUM | RECEIPT, ISSUE, WASTAGE, ADJUSTMENT_IN, ADJUSTMENT_OUT |
| quantity | DECIMAL(12,3) | SIGNED: + into stock, − out of stock |
| stock_batch_id | UUID FK NULL | the batch touched |
| unit_cost / total_cost | DECIMAL(14,2) | valuation of the movement |
| reference_type | ENUM | GOODS_RECEIPT, STOCK_ISSUE, STOCK_ADJUSTMENT |
| reference_id | UUID | polymorphic → goods_receipts.id or stock_issues.id (no FK) |
| order_id | UUID FK → orders NULL | customer-order tag on issues |
| movement_date | DATE | |
| created_at | | no updated_at — rows are never modified |

## Handy query patterns

```sql
-- Current stock per item, with value and low-stock flag
SELECT i.name, i.unit,
       COALESCE(SUM(b.quantity_remaining), 0)          AS in_stock,
       COALESCE(SUM(b.quantity_remaining * b.rate), 0) AS stock_value,
       i.reorder_level
FROM inventory_items i
LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
WHERE i.is_archived = false
GROUP BY i.id, i.name, i.unit, i.reorder_level;

-- Order total + outstanding per order
SELECT o.id, c.name,
       COALESCE(SUM(ops.quantity_kg * ops.rate_per_kg), 0)
         + COALESCE(o.custom_plate_charge, pt.charge)
         - COALESCE(o.round_off_amount, 0)                       AS total_amount,
       o.advance_received
         + COALESCE((SELECT SUM(p.amount) FROM payments p
                     WHERE p.order_id = o.id), 0)                AS received
FROM orders o
JOIN customers c   ON c.id = o.customer_id
JOIN plate_types pt ON pt.id = o.plate_type_id
LEFT JOIN order_product_sizes ops ON ops.order_id = o.id
WHERE o.is_archived = false
GROUP BY o.id, c.name, pt.charge;
-- outstanding = total_amount - received
```
