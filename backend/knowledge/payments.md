# Payments

What it is: money received from customers. There is no standalone Payments page —
payments are recorded and managed in two places:
- on an **order's** detail page (`/orders/:id`) → payment gets `order_id`
- on an **invoice's** detail page (`/invoices/:id`) → payment gets `invoice_id`
Every payment also stores the customer. The order-time **Advance Received**
field is separate (a column on the order, not a payments row) but is counted in
"Total Paid".

Payment types: **Advance Payment**, **Partial Payment**, **Final Payment**,
**Refund**. Methods: **Cash**, **Bank Transfer**, **UPI**, **Check**, **Other**.

A **Refund** is money given back to the customer: it is subtracted from what
the order has received (so the due goes up again). A refund can't be more than
the order has received.

## Recording a payment against an order
1. Open the order ([Orders](/orders) → tap it, `/orders/:id`). The money card at
   the top shows **Total**, **Received** and **Due** (or "Paid in full ✓").
2. Tap **＋ Record payment**. A sheet opens: type the **Amount** (or tap
   **Full due ₹…**), pick how it was paid (**Cash / UPI / Bank / Cheque /
   Other**), check the **Date** (today by default; Today / Yesterday
   shortcuts), and optionally **＋ Add reference or note**.
3. The type is worked out from the amount: the whole due (or more) is saved as
   a **Final payment**, less as a **Part payment**. If the amount is more than
   the due, the sheet says by how much and the button becomes **Save anyway**.
4. **Advance** and **Refund** are separate: the order's **⋯** menu has
   **Record advance** and **Record refund** (a refund can't be more than what
   was received).

## Recording a payment against an invoice
1. Open the invoice (`/invoices/:id`) and tap **＋ Payment**. Under **Money is
   for**, choose an order on the invoice (orders still owing are listed first,
   oldest first; paid ones follow) or **The invoice itself** — for money that
   isn't for one order, such as the invoice's GST. When every order is already
   paid, "The invoice itself" is preselected. Then the same sheet as above;
   "Full due" is the invoice's due (GST included).
2. A payment on "the invoice itself" has no order: it counts toward the
   invoice's due, but not toward any order's due or the dashboard's Collected
   (the dashboard notes it separately).

## Editing or deleting a payment
1. On the order page, open the **Payments** tab. Each payment has a **⋯**
   button: **Edit payment** (same sheet, where the type can also be changed)
   or **Delete payment** (asks first).
2. Invoice and customer pages list payments read-only.

Notes:
- Payment create/update/delete are audited with before/after order metrics
  (total, received, outstanding) — visible on [History](/history).
- Payments are hard-deleted rows (no `is_archived`), so SQL sums over `payments`
  always reflect the current truth.
