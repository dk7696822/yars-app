# Orders

What it is: bag-manufacturing orders. An order = customer + date + one plate
type + one or more product-size lines, each sold by **Kg** (kg × rate/kg) or by
**Pcs** (pieces × a price like "1,000 pcs cost ₹375"). Order total =
sum of line amounts + plate charge (custom or default) − round off. Advance can
be recorded at order time; further payments are recorded on the Order Details
page (see payments.md).

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
8. Under **Product Sizes**: for each line pick **Size** (shows its prices, e.g.
   "8x10 (₹180.00/kg · ₹0.50/pc)"), then the unit toggle **Kg | Pcs** (only
   units the size has a price for are enabled).
   - **Kg**: enter **Quantity (kg)**, optionally override **Rate/kg** (label
     shows the default).
   - **Pcs**: enter **Quantity (pcs)** (whole number). **Price** "N pcs cost ₹X"
     is pre-filled from the size and can be changed for this order.
     **Weight** "N pcs weigh W kg" is pre-filled from the size; typing your own
     makes it a measured weight (shown as "measured"). If the size has no
     weight, an amber note says so and offers **Set weight for <size>** — saving
     it updates the size and fills in earlier pieces lines that had no weight
     (a message says how many).
     Skipping is fine; the order still saves.
   The **Amount** updates live (plus "≈ N kg" for pieces). Tap **Add Product
   Size** for more lines; the trash button removes a line (at least one line
   must remain).
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
   If the order is already on an invoice, the edit screen shows a warning:
   changes won't update that invoice — delete and regenerate the invoice to
   update it.

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
2. Fill **Size Label** (placeholder "Enter size label (e.g. 8x10)"), then any
   of: **Rate per kg**; **Piece price** "[N] piece(s) cost ₹[X]" (N defaults to
   1; e.g. 1 piece costs ₹0.50, or 100 pieces cost ₹250); **Weight** "[N]
   piece(s) weigh [W] kg". At least one of rate per kg / piece price is
   required. Tap **Save Product Size**. Saving a weight also fills it into
   earlier pieces order lines of that size that had no weight (the success
   message says how many). The list's **Pricing** column shows e.g.
   "₹180.00/kg · ₹0.50/pc · 10 g/pc".
3. Edit via the row's edit action (`/product-sizes/edit/:id`); delete via the
   "Delete product size" modal. Soft delete.

Rules the UI enforces:
- Customer, Order Date, Plate Type, Status, and at least one Product Size line
  are required.
- Changing a size on a line pre-fills its kg rate from the master only if the
  line has no rate yet; a pieces line's price and weight reset to the new
  size's values. Saved orders keep their frozen prices and weights.
- Order create/update/status-change/delete are all written to the audit log
  (visible on [History](/history)).
