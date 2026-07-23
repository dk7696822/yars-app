# Inventory (raw materials)

What it is: raw-material management — fabric rolls, ink, thread, etc. Finished
bags are made to order and never stocked. Flow: define **Suppliers** and
**Inventory Items** → order via **Purchase Orders** → **Receive material**
(goods receipts create FIFO stock batches) → consume via **Stock Issues** →
watch it all on the **Stock** screen.

Domain terms:
- **Stock issue** (type "Production issue"): raw material taken out of stock for
  production. Optionally tagged to a customer order.
- **Wastage**: material lost. Two forms — (a) same-line wastage on a production
  issue (of the material taken, that much was wasted; it is consumed from stock
  IN ADDITION to the issued quantity: issue 500 + 20 wastage consumes 520), and
  (b) a standalone "Wastage write-off" issue type.
- **Adjustment IN / OUT** ("Adjustment — add stock" / "Adjustment — remove
  stock"): manual corrections (stock take differences, damage, opening stock).
  A **Reason** is mandatory. Opening stock is entered as an Adjustment IN with
  reason "Opening stock".
- **FIFO batches**: every receipt creates a batch (quantity + rate). Issues
  consume the oldest batch first; the Stock Item Detail page lists open batches
  "(oldest first — consumed first)". Stock value = Σ remaining × batch rate.
- **Over-receiving**: allowed by design — you can receive more than ordered;
  the form warns "This is more than the outstanding quantity. Over-receipt will
  be recorded."
- **Goods receipt without PO**: supported by the backend (receipt with no
  purchase order); the UI path is via a PO's Receive screen, so day-to-day
  receiving happens against POs.
- **Why receipts/issues can't be edited or deleted**: they move stock through a
  FIFO ledger; rewriting history would corrupt batch remainders and costs.
  Corrections are made with a new Adjustment (IN or OUT) with a reason.
- **Reorder level / target**: when stock ≤ reorder level the item shows a LOW
  badge and a "Suggested purchase" quantity (reorder target − in stock).

## Checking stock
1. Open [Stock](/stock). Top tiles: **Stock value**, **Low stock items**,
   **Received this month**, **Consumed this month**.
2. Search (**Search item or code…**), filter by **Category** / **Attribute**,
   or tap the **Low stock** toggle to see only items at/below reorder level.
3. Each row shows **In stock**, **On order** (pending PO quantity), **Value**,
   and LOW/OK status with "Buy N unit" suggestions.
4. **Export** downloads inventory.xlsx.
5. Tap an item to open its detail (`/stock/:itemId`): tiles for **In stock**,
   **Stock value**, **Reorder level**; **Open batches** (Received date,
   Supplier, Rate, Remaining, Value — oldest first); **Movement history** with
   an **All movements** filter (RECEIPT / ISSUE / WASTAGE / ADJUSTMENT IN /
   ADJUSTMENT OUT), signed quantities and costs.

## Recording a stock issue (with wastage)
1. Open [Stock Issues](/stock-issues) and tap **Record issue** (the big button
   at the top of the page).
2. Set the **Date** (defaults to today) and **Type** — "Production issue",
   "Wastage write-off", "Adjustment — remove stock", or "Adjustment — add stock".
3. For adjustments a **Reason** field appears and is required (placeholder
   "e.g. Stock take shortfall, water damage"). For non-adjustments an optional
   **Customer order** dropdown appears ("Not linked to an order" by default;
   options show "customer — date").
4. Under **Items**, pick the item in the **Select item…** dropdown (recently
   used items float to the top; each shows "name (unit)"). The line then shows
   **Available: N unit**.
5. Enter **Quantity used**, and optionally **Wastage** "(optional)" (hidden for
   adjustments). If quantity + wastage exceeds stock, a warning shows: "Only N
   unit in stock — this needs M." (the server will also reject it).
6. **Add item** adds more lines; the trash button removes a line.
7. Optional **Notes**, then tap **Record issue** (pinned at the bottom).
8. On success you return to the list ("Stock issue recorded successfully").
   Issues cannot be edited or deleted afterwards — correct mistakes with an
   adjustment.

## Browsing stock issues
1. Open [Stock Issues](/stock-issues). Search by issue number, filter by
   **Type**, **From date**, **To date**. Columns: Issue (ISS-…), Date, Type
   badge, Items, Total cost, Wastage cost, Order.

## Creating a purchase order
1. Open [Purchase Orders](/purchase-orders) and tap **New PO** (top right).
2. Pick the **Supplier** (required), set **Order date** and optionally
   **Expected delivery**.
3. Under **Items**: **Select item…**, then **Quantity** (unit shown in the
   label) and **Rate (₹)** per line; **Line total** and **Grand total** update
   live. **Add item** for more lines.
4. Optional **Notes**, then tap **Create purchase order**. You land on the PO
   detail page; the PO gets a number like PO-2026-0001, status PENDING.

## Receiving material against a PO
1. Open the PO ([Purchase Orders](/purchase-orders) → tap it) and tap
   **Receive material** (shown unless the PO is RECEIVED or CANCELLED).
2. Set the **Receipt date** and optional **Supplier bill ref** (placeholder
   "e.g. INV-4821").
3. Each PO line is pre-filled with its pending quantity and PO rate under
   **Received (unit)** and **Rate (₹)** — "everything arrived as ordered" is
   one tap. Adjust as needed; "(set a quantity to 0 to skip a line)". Receiving
   more than pending shows the over-receipt warning but is allowed.
4. Tap **Record receipt**. This creates a goods receipt (GR-…), one stock batch
   per line, positive RECEIPT movements, and updates the PO status to
   PARTIALLY_RECEIVED or RECEIVED automatically. Receipts cannot be edited or
   deleted.
5. The PO detail page shows **Items — ordered vs received** (Ordered /
   Received / Pending with DONE/PENDING badges) and a **Goods receipts** list.

PO rules the server enforces: only PENDING POs can be edited; a PO that has
received material cannot be cancelled or deleted ("Cannot delete a purchase
order that has received material. Cancel it instead." applies to un-received
ones); receiving against a CANCELLED PO is refused.

## Managing inventory items
1. Open [Inventory Items](/inventory-items) and tap **New**.
2. Fill **Name** (required), optional **Item code**, **Category** (required
   dropdown), **Unit** (KG / PCS / METRE / ROLL / LITRE), one optional dropdown
   per attribute (e.g. **Cut**, **GSM**, **Color**), **Reorder level**,
   **Reorder target**, optional **Notes**.
3. Tap **Create item**. Edit uses the same form with **Save changes**.
4. Delete from the list (trash icon → "Delete inventory item" modal). The server
   refuses with 409 while the item "still has stock on hand" or "is on an open
   purchase order".
5. The **Categories** and **Attributes** buttons at the top link to those
   master screens.

## Managing suppliers
1. Open [Suppliers](/suppliers) and tap **New Supplier**.
2. Fill **Name** (required), optional **Phone**, **Email**, **GST number**,
   **Address**; tap **Create supplier** (edit: **Save changes**).
3. Search matches name, phone or GST. Tap a supplier for their detail page
   (contact info with tap-to-call/email, plus their **Purchase orders**).
4. Delete → 409 "Cannot delete this supplier as it is being used by purchase
   orders or goods receipts" while referenced.

## Managing inventory categories
1. Open [Inventory Categories](/inventory-categories) (or the **Categories**
   button on Inventory Items).
2. Type in **New category name…** and tap **Add**. Rename inline via the edit
   icon (check to save, X to cancel); delete via the trash icon.
3. Delete is refused (409, "…being used by inventory items") while in use.

## Managing item attributes
1. Open [Item Attributes](/item-attributes) (or the **Attributes** button on
   Inventory Items).
2. Add an attribute via **New attribute name…** + **Add**. Tap an attribute row
   to expand its values; add values via **Add value…** + **Add**; rename/delete
   attributes and values inline.
3. Deleting an attribute or value in use by items is refused with a 409.
4. Each item can hold at most one value per attribute (enforced by the DB).
