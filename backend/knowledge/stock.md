---
area: stock
summary: Raw-material stock on hand, FIFO batches, stock issues and wastage
keywords: stock, issue, issued, wastage, material, granules, item, items
tables: inventory_items, inventory_categories, stock_batches, stock_issues, stock_issue_items, stock_movements
---
# Stock (raw materials)

Raw materials only (fabric, ink, granules…); bags are made to order, never stocked. Every receipt makes a **batch** (quantity + rate); issues use the oldest batch first. Stock value = Σ remaining × batch rate. Receipts and issues can't be edited or deleted — corrections are **Add stock / Remove stock** with a reason.

## Checking stock
[Stock](/stock): card with **Stock value**, **Low stock** (N of M), **Received this month**, **Used this month**; search or the **Low stock** chip. An item (`/stock/:itemId`) shows quantity, worth and reorder level, **Issue stock** / **Order more**, tabs **Batches** (oldest first), **Movements**, **Details**. An item is **Low** when stock ≤ its reorder level (above 0).

## Issuing stock
[Stock issues](/stock-issues) → **New**. **What happened**: **Issue** (used for production), **Wastage**, **Add stock**, **Remove stock**; **Date**. Issue and Wastage can be tagged **For order**; Add/Remove need a **Reason**. **Choose an item** (shows **In stock**), **Quantity**, and for Issue optional **Wasted too** (issue 500 + 20 wasted takes 520). It refuses more than is in stock. **Save**.

## Items
[Items](/inventory-items) → **New**: **Name**, optional **Code**, **Category**, **Counted in** (Kg / Pcs / Metre / Roll / Litre), **Reorder at**, optional **Order up to**, details (e.g. GSM). Delete is refused while the item has stock or is on an open purchase order. [Item categories](/inventory-categories) and [Item details](/item-attributes) are edited in place.

## Tables
`inventory_items`: `id`, `name`, `item_code`, `category_id`, `unit`, `reorder_level`, `reorder_target`, `is_archived`.
`stock_batches` (the stock truth): `item_id`, `received_date`, `quantity_received`, `quantity_remaining`, `rate`. Stock of an item = `SUM(quantity_remaining)`.
`stock_issues`: `issue_number` (ISS-2026-0001), `issue_date`, `issue_type` ISSUE|WASTAGE|ADJUSTMENT_IN|ADJUSTMENT_OUT, `order_id`, `reason`. `stock_issue_items`: `stock_issue_id`, `item_id`, `quantity`, `total_cost`, `wastage_quantity`, `wastage_cost`.
`stock_movements`: append-only signed ledger (`quantity` + in / − out), `movement_type`, `item_id`, `movement_date`, `total_cost`.
