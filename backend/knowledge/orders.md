# Orders

What it is: bag-manufacturing orders. An order = customer + date + one plate
type + one or more product-size lines (kg × rate/kg). Order total =
sum of line amounts + plate charge (custom or default) − round off. Advance can
be recorded at order time; further payments are recorded on the Order Details
page (see payments.md).

Domain terms:
- **Plate type**: the printing plate used; each has a default **Charge** added
  once per order. Can be overridden per order with **Custom Plate Charge**.
- **Product size**: a bag size (e.g. "8x10") with a default **Rate per kg**;
  the rate can be overridden per order line.
- **Round Off Amount**: amount subtracted to round the total (e.g. 5 to turn
  ₹10,005 into ₹10,000).
- Order **status**: Pending → In Progress → Completed → Delivered (or Cancelled).
  Status is set manually in the order form.

## Creating an order
1. Open [Orders](/orders) and tap **New Order** (top right; just **New** on
   phones). (Also reachable from the Dashboard quick action.)
2. Pick the **Customer** (dropdown, required).
3. Set the **Order Date** (date picker, defaults to today, dd/MM/yyyy).
4. Pick the **Plate Type** — the dropdown shows each type with its charge, e.g.
   "4 Colour (₹2,000.00)".
5. Optionally enter **Custom Plate Charge** (the label shows "(Default: ₹…)"
   for the selected type) and **Round Off Amount** ("(Amount to subtract)").
6. Enter **Advance Received** if any money was taken upfront.
7. Set **Order Status** (Pending / In Progress / Completed / Delivered /
   Cancelled).
8. Under **Product Sizes**: for each line pick **Size** (shows "label (₹rate/kg)"),
   enter **Quantity (kg)**, and optionally override **Rate/kg** (label shows the
   default). The **Amount** column updates live. Tap **Add Product Size** for
   more lines; the trash button removes a line (at least one line must remain).
9. Check the summary: **Total Product Amount**, **Plate Charge**,
   **Advance Received**, **Total Receivable**.
10. Tap **Save Order**.

## Viewing / editing an order
1. Open [Orders](/orders); search by customer name, or filter (funnel) by
   **Status**, **From Date**, **To Date** — filters apply automatically.
2. Tap an order to open Order Details (`/orders/:id`): Customer Information,
   Order Information (Order Date, Status, Plate Type, and a **View Invoice →**
   link if billed), **Order Items** table with Plate Charge, Round Off and
   **Total Order Amount**, then **Payment Information** (see payments.md).
3. **Edit Order** (top right) opens the same form as create, pre-filled.
   **Generate Invoice** appears only while the order has no invoice.

## Exporting orders to Excel
1. On [Orders](/orders), set any filters you want, then tap **Download Excel**.

## Deleting an order
1. On [Orders](/orders) (or the Dashboard list), use the delete action on the
   order row and confirm **Delete** in the "Delete Order" modal. Soft delete.

## Managing plate types
1. Open [Plate Types](/plate-types). Tap **New Plate Type**.
2. Fill **Type Name** and **Charge (₹)** (both required), tap
   **Save Plate Type**.
3. To edit: use the edit action on a row (`/plate-types/edit/:id`), same form.
4. Delete via the row's delete action → "Delete plate type" modal. Soft delete.
5. Search box: **Search plate types...**.

## Managing product sizes
1. Open [Product Sizes](/product-sizes). Tap **New Product Size**.
2. Fill **Size Label** (placeholder "Enter size label (e.g. 8x10)") and
   **Rate per kg** (both required), tap **Save Product Size**.
3. Edit via the row's edit action (`/product-sizes/edit/:id`); delete via the
   "Delete product size" modal. Soft delete.

Rules the UI enforces:
- Customer, Order Date, Plate Type, Status, and at least one Product Size line
  are required.
- Changing a size on a line pre-fills its rate from the master only if the line
  has no rate yet — edited orders keep their frozen rates.
- Order create/update/status-change/delete are all written to the audit log
  (visible on [History](/history)).
