# Orders

What it is: bag-manufacturing orders. An order = customer + date + one plate
type + one or more size lines, each sold by **Kg** (kg × rate/kg) or by
**Pcs** (pieces × a price like "1,000 pcs cost ₹375"). Order total = sum of
line amounts + plate charge (custom or default) − round off. An advance can be
recorded when the order is created; every other payment is recorded on the
order page (see payments.md).

Domain terms:
- **Plate type**: the printing plate used; each has a default **Charge** added
  once per order. Can be overridden per order with **Custom Plate Charge**.
- **Product size**: a bag size (e.g. "8x10") with an optional **Rate per kg**,
  an optional piece price ("**N piece(s) cost ₹X**") — at least one of the two —
  and an optional weight ("**N piece(s) weigh W kg**") used only to estimate
  the kg of pieces lines. Prices and weights are copied onto each order line
  when the order is saved; changing the size later affects only new orders
  (except: lines with no weight pick up a newly-set size weight — see below).
- **Round Off Amount**: amount subtracted to round the total (e.g. 5 to turn
  ₹10,005 into ₹10,000).
- Order **status**: Pending → In progress → Completed → Delivered (or Cancelled). Set in the order form's More options or with the status chips on the order page.

## Finding an order
1. Open [Orders](/orders). Orders are grouped by day (Today, Yesterday,
   dates), newest first. Each row shows the customer, first size and quantity,
   status, the total, and **Due ₹…** in red or **Paid ✓** in green.
2. Search by customer name or size. Chips: **All · Due · In progress · This
   month**. The line under the chips shows how many orders, their total and
   the due; cancelled orders are listed (struck through) but not counted.
3. **⋯ → Download Excel** exports the orders matching the search (this month
   only when that chip is on).

## Creating an order
Three steps with **Back** on every step (nothing typed is lost) and a progress
bar you can tap to jump back:
1. **Customer & date** — tap to choose the customer (search by name or phone;
   recent customers first; shows what they owe). Not a customer yet? **＋ New
   customer** adds one with just name + mobile and returns here. The **Order
   date** defaults to today (Today / Yesterday shortcuts).
2. **Items** — per size: choose the **Size** (the list shows its prices), then
   **Kg | Pcs** (either can be chosen; if the size has no saved price for that unit, a note asks for the price for this order).
   - **Kg**: quantity in kg (up to 2 decimals, e.g. 12.25) and **Rate per kg**
     (pre-filled from the size).
   - **Pcs**: quantity (whole number), **Price** "N pcs cost ₹X" (pre-filled),
     optional **Weight** "N pcs weigh W kg" (pre-filled; typing your own marks
     it as measured). If the size has no weight, a note offers **Set weight
     for <size>** — saving it updates the size and fills earlier pieces lines
     that had none (a message says how many). Skipping is fine.
   Each line shows its amount live (and ≈ kg for pieces). **＋ Add another
   size** adds a line.
3. **Plate & review** — choose the **Plate type** (shows its charge). **More
   options**: custom plate charge (empty = the plate type's charge), round off
   (taken off the total), **Advance received** (saved as an advance payment on
   the order date) and status. The review shows each section with **Edit**.
   The total is always at the bottom. Tap **Save order**.

## The order page
`/orders/:id`: customer, date and status; a money card with **Total**,
**Received**, **Due** and **＋ Record payment**; Call / WhatsApp for the
customer; status chips (Pending → In progress → Completed → Delivered); tabs
**Items** (lines, plate, round off, total), **Payments** (edit/delete each via
⋯) and **Details**. The **⋯** menu: **Edit order**, **Create invoice** (while
not invoiced), **Record advance**, **Record refund**, **Cancel order** (shows
a Restore button afterwards) and **Delete order** (asks first; soft delete).

## Editing an order
**⋯ → Edit order** opens the same three steps, filled in. The advance can't be
changed here — record an advance or refund as a payment instead. If the order
is already on an invoice, a warning says the invoice won't change: delete and
regenerate the invoice to update it.

## Managing plate types
1. Open [Plate types](/plate-types) (More → Plate types). Each row shows the
   name and its charge; search at the top. Tap **New** to add one.
2. Fill **Name** and **Charge** (₹0 is allowed) and tap **Save plate type**.
3. Tap a row to edit it. Note: orders that use a plate type without their own
   custom plate charge use the plate type's current charge — changing it also
   changes those past orders' totals and dues.
4. **Delete plate type** (on its edit page) asks first; it is no longer offered
   for new orders. Soft delete.

## Managing sizes
1. Open [Sizes](/product-sizes) (More → Sizes). Each row shows the size and
   how it is priced, e.g. "₹180/kg · ₹375 per 1,000 pcs · 10 g per piece", or
   "Rate set on each order" when it has no saved price. Tap **New** to add one.
2. Fill **Size** (e.g. 14 x 18), then any of: **Rate per kg** (leave empty or
   0 if the rate is set on each order), **Piece price** "[N] pcs cost ₹[X]",
   **Weight** "[N] pcs weigh [W] kg" (only used to estimate kg for pieces
   orders). At least a rate per kg or a piece price is needed. Tap **Save size**.
3. Tap a row to edit it. Changing prices affects new orders only. Saving a
   weight also fills it into earlier pieces order lines of that size that had
   no weight (a message says how many).
4. **Delete size** (on its edit page) asks first. Soft delete.

Rules the UI enforces:
- Customer, order date, plate type and at least one size line are required;
  each line needs its quantity and rate/price. Problems show next to the field
  and Next/Save goes to the first one.
- Changing a size on a line pre-fills its kg rate only if the line has no rate
  yet; a pieces line's price and weight reset to the new size's values. Saved
  orders keep their frozen prices and weights.
- Order create/update/status-change/delete are all written to the audit log
  (visible on [History](/history)).
