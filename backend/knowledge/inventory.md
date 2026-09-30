# Inventory (raw materials)

What it is: raw-material management — fabric rolls, ink, thread, etc. Finished
bags are made to order and never stocked. Flow: define **Suppliers** and
**Items** → order via **Purchase Orders** → **Receive material**
(goods receipts create FIFO stock batches) → consume via **Stock Issues** →
watch it all on the **Stock** screen.

Domain terms:
- **Stock issue** (type **Issue**): raw material taken out of stock for
  production. Optionally tagged to a customer order.
- **Wastage**: material lost. Two forms — (a) same-line wastage on a production
  issue (of the material taken, that much was wasted; it is consumed from stock
  IN ADDITION to the issued quantity: issue 500 + 20 wastage consumes 520), and
  (b) a standalone **Wastage** issue type.
- **Adjustment IN / OUT** (types **Add stock** / **Remove stock**): manual corrections (stock take differences, damage, opening stock).
  A **Reason** is mandatory. Opening stock is entered as an Adjustment IN with
  reason "Opening stock".
- **FIFO batches**: every receipt creates a batch (quantity + rate). Issues
  consume the oldest batch first; the item stock page's **Batches** tab lists
  them oldest first ("Used oldest first"). Stock value = Σ remaining × batch rate.
- **Over-receiving**: allowed by design — you can receive more than ordered;
  the form warns "More than the N still to come — the extra will be recorded."
- **Goods receipt without PO**: supported by the backend (receipt with no
  purchase order); the UI path is via a PO's Receive screen, so day-to-day
  receiving happens against POs.
- **Why receipts/issues can't be edited or deleted**: they move stock through a
  FIFO ledger; rewriting history would corrupt batch remainders and costs.
  Corrections are made with a new Adjustment (IN or OUT) with a reason.
- **Reorder level / target**: when stock ≤ reorder level (and the level is
  above 0) the item shows a **Low** tag. "Order up to" is the reorder target.

## Checking stock
1. Open [Stock](/stock). The card at the top shows **Stock value**, **Low
   stock** (N of M items), **Received this month** and **Used this month**.
2. Search (**Search item name or code**) or tap the **Low stock** chip.
3. Each row shows the item, category and details (e.g. GSM), **On order** when
   a purchase order is still open, and on the right the quantity in stock and
   its value.
4. **⋯ → Download Excel of all stock** downloads inventory.xlsx. The same menu
   links to Purchase orders, Stock issues, Items and Suppliers.
5. Tap an item (`/stock/:itemId`): the card shows quantity in stock, its worth
   and the reorder level, with **Issue stock** and **Order more** buttons. Tabs:
   **Batches** (received date, receipt number, supplier, rate per unit,
   remaining of received, value — oldest first), **Movements** (Received /
   Issued / Wastage / Added (count) / Removed (count), signed quantity and
   cost, loads more as you scroll) and **Details** (code, category, unit,
   reorder level, order up to, details, notes, **Edit item**).

## Recording a stock issue (with wastage)
1. Open [Stock issues](/stock-issues) and tap **New** (or **Issue stock** on
   the Stock screen or an item's page, which pre-fills that item).
2. Under **What happened** pick **Issue** (material used for production),
   **Wastage**, **Add stock** or **Remove stock**; set the **Date** (Today /
   Yesterday shortcuts).
3. For Issue and Wastage an optional **For order** picker appears (search
   customer or size). For Add/Remove stock the **Reason** is required ("Say
   why the count changed").
4. Tap **Choose an item** (recently used items first; each shows what is in
   stock). The line shows **In stock: N unit**.
5. Enter **Quantity** (for Wastage: **Wasted**) and, for Issue, optionally
   **Wasted too**. If the total is more than in stock (counting the same item
   on other lines) it warns "Only N in stock — M short. It won't save until
   stock is received."; the server also refuses it.
6. **Add another item** adds a line; the bin icon removes one.
7. Optional **Notes**, then **Save**. You return to the list. Issues cannot be
   edited or deleted afterwards — correct mistakes with Add stock / Remove
   stock.

## Browsing stock issues
[Stock issues](/stock-issues) lists issues grouped by date, newest first: the
number (ISS-…), a type tag, the items, the order it was for (tap to open it),
the reason, and the cost (including wastage). Search by issue number; chips
filter by type.

## Creating a purchase order
1. Open [Purchase orders](/purchase-orders) and tap **New**. Three steps, with
   **Back** on each (nothing typed is lost):
2. **Supplier** — choose the supplier (search; **＋ New supplier "name"** adds
   one on the spot), **Order date**, optional **Expected by** and **Notes**.
3. **Items** — for each line **Choose an item**, then **Quantity** and **Rate
   per unit**; the line **Amount** and the total at the bottom update as you
   type. **Add another item** for more lines.
4. **Review** — check, then **Create order**. You land on the order page; it
   gets a number like PO-2026-0001 and the status **Ordered**.

## Receiving material against a PO
1. Open the PO and tap **Receive material** (shown while the PO is Ordered or
   Part received).
2. Set **Arrived on** and optional **Supplier's bill number**.
3. Each line is pre-filled with the quantity still to come and the PO rate —
   leave a line blank if it didn't come. Receiving more than is still to come
   shows the over-receipt warning but is allowed.
4. Tap **Save**. This creates a goods receipt (GR-…), one stock batch per
   line, and moves the PO to **Part received** or **Received** automatically.
   Receipts cannot be edited or deleted.
5. The PO page has tabs **Items** (ordered, received and still to come per
   line), **Deliveries** (each receipt with date, bill number and value) and
   **Details**.

PO rules the server enforces: a PO that has received material cannot be
cancelled or deleted, so **⋯ → Cancel purchase order / Delete purchase order**
only appear before anything is received (both ask first); receiving against a
cancelled PO is refused.

## Managing items
1. Open [Items](/inventory-items) and tap **New**.
2. Fill **Name** (required), optional **Code**, **Category** (required), how
   it is **Counted in** (Kg / Pcs / Metre / Roll / Litre), **Reorder at**,
   optional **Order up to**, one optional choice per item detail (e.g. **GSM**,
   **Color**, **Cut**) and **Notes**.
3. Tap **Save item** (editing: **Save changes**). **Delete item** is at the end
   of the edit form and asks first; the server refuses while the item "still
   has stock on hand" or "is on an open purchase order", and the app shows why.
4. **⋯ → Item categories** and **⋯ → Item details (GSM, colour…)** open those
   lists.

## Managing suppliers
1. Open [Suppliers](/suppliers) and tap **New**.
2. Fill **Name** (required), optional **Mobile**, **Email**, **GSTIN**,
   **Address**; tap **Save supplier**.
3. Search matches name or phone. Tap a supplier for their page: **Call**,
   **WhatsApp**, **New purchase order** (supplier pre-filled), and tabs
   **Purchase orders** · **Details**. **⋯ → Edit supplier / Delete supplier**.
4. Delete is refused while the supplier has purchase orders or goods receipts,
   and the app shows the reason.

## Managing item categories
1. Open [Item categories](/inventory-categories) (or **⋯ → Item categories**
   on Items).
2. Type a name and tap **Add**. Rename with the pencil (tick to save), delete
   with the bin (asks first). Delete is refused while items use the category.

## Managing item details (attributes)
1. Open [Item details](/item-attributes) (or **⋯ → Item details** on Items).
2. Add a detail (e.g. GSM) with **Add**. Tap **N values** on a row to open its
   values; add, rename or delete values the same way.
3. Deleting a detail or value that items use is refused.
4. Each item can hold at most one value per detail (enforced by the database).
