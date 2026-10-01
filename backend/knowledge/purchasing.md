---
area: purchasing
summary: Suppliers, purchase orders and receiving material
keywords: supplier, suppliers, purchase, po
tables: suppliers, purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items
---
# Purchasing

## Purchase orders
[Purchase orders](/purchase-orders) → **New**. Three steps with **Back**: **Supplier** (search; **＋ New supplier**), **Order date**, optional **Expected by** and **Notes**; **Items** (**Choose an item**, **Quantity**, **Rate per unit**; amounts and total update live); **Review** → **Create order**. It gets a number like PO-2026-0001 and status **Ordered**. The PO page has tabs **Items**, **Deliveries**, **Details**. **⋯ → Cancel / Delete purchase order** appear only before anything is received.

## Receiving material
On the PO tap **Receive material** (while Ordered or Part received). Set **Arrived on** and optional **Supplier's bill number**; each line is pre-filled with what is still to come at the PO rate (leave blank if it didn't come; receiving more than ordered is allowed with a warning). **Save** makes a goods receipt (GR-…), one stock batch per line, and moves the PO to **Part received** or **Received**. Receipts can't be edited or deleted.

## Suppliers
[Suppliers](/suppliers) → **New**: **Name**, optional **Mobile**, **Email**, **GSTIN**, **Address** → **Save supplier**. A supplier's page has **Call**, **WhatsApp**, **New purchase order**, tabs **Purchase orders · Details**. Delete is refused while they have purchase orders or receipts.

## Tables
`suppliers`: `id`, `name`, `phone`, `email`, `gst_number`, `address`, `is_archived`.
`purchase_orders`: `po_number`, `supplier_id`, `order_date`, `expected_date`, `status` PENDING|PARTIALLY_RECEIVED|RECEIVED|CANCELLED, `is_archived`. Value = Σ items quantity_ordered × rate.
`purchase_order_items`: `purchase_order_id`, `item_id`, `quantity_ordered`, `rate`, `quantity_received`.
`goods_receipts`: `receipt_number`, `purchase_order_id`, `supplier_id`, `receipt_date`, `supplier_bill_ref`. `goods_receipt_items`: `goods_receipt_id`, `item_id`, `quantity_received`, `rate`.
