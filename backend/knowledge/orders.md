---
area: orders
summary: Creating, finding and editing orders with kg or pieces lines
keywords: order, orders, deliver, delivered, cancel, cancelled, status, pending, progress, completed, kg, pcs, pieces
tables: orders, order_product_sizes
---
# Orders

An order = customer + date + one plate type + size lines. Each line is sold by **Kg** (kg × rate per kg) or **Pcs** (pieces × a price like "1,000 pcs cost ₹375"). Total = line amounts + plate charge (custom or the plate type's) − round off. Status: Pending → In progress → Completed → Delivered, or Cancelled (not counted in totals or dues).

## Finding
[Orders](/orders): grouped by day, newest first, with **Due ₹…** or **Paid ✓**. Search customer or size; chips **All · Due · In progress · This month**. **⋯ → Download Excel**.

## Creating ([New order](/orders/new))
Three steps, **Back** on each:
1. **Customer & date** (＋ New customer if needed; date defaults to today).
2. **Items** — per line: **Size**, then **Kg | Pcs**. Kg: quantity and **Rate per kg** (pre-filled from the size). Pcs: whole-number quantity, **Price** "N pcs cost ₹X" (pre-filled), optional **Weight**. If the size has no saved price for that unit, enter one for this order. **＋ Add another size**.
3. **Plate & review** — **Plate type**; **More options**: custom plate charge, round off, **Advance received** (saved as an advance payment), status. Tap **Save order**.

## Order page (`/orders/:id`)
Money card **Total / Received / Due** with **＋ Record payment**; status chips; tabs **Items**, **Payments**, **Details**. **⋯**: Edit order, Create invoice, Record advance, Record refund, Cancel order (then **Restore**), Delete order (asks first).

## Editing
**⋯ → Edit order** opens the same steps. The advance can't be changed there — record a payment instead. Editing an invoiced order doesn't change the invoice.

## Tables
`orders`: `id`, `customer_id`, `order_date` DATE, `plate_type_id`, `custom_plate_charge` (NULL = plate type's), `round_off_amount`, `advance_received` (legacy), `status` (PENDING, IN_PROGRESS, COMPLETED, DELIVERED, CANCELLED), `invoice_id`, `is_archived`. No total column — see the money_sql area.
`order_product_sizes`: `order_id`, `product_size_id`, `unit` KG|PIECES; KG: `quantity_kg`, `rate_per_kg`; PIECES: `quantity_pieces`, `price_amount` + `price_pieces_count`, optional `weight_kg` + `weight_pieces_count`. No is_archived.
