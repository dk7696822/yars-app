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

## Recording a payment against an order
1. Open the order: [Orders](/orders) → tap the order (`/orders/:id`).
2. Scroll to **Payment Information**. It shows **Total Order Amount**,
   **Total Paid** (with "(Includes ₹… advance)" when relevant),
   **Remaining Balance**, and **Payment Status** (FULLY PAID / PARTIALLY PAID).
3. Tap **Record Payment** (button hidden once fully paid). A modal titled
   "Record Payment" opens.
4. Fill:
   - **Amount** (required; pre-filled with the remaining balance)
   - **Payment Date** (required, defaults to today, dd/MM/yyyy)
   - **Payment Method** (Cash / Bank Transfer / UPI / Check / Other)
   - **Payment Type** (Advance / Partial / Final / Refund)
   - **Reference Number** "(Optional)" — placeholder "Transaction ID, Check
     Number, etc."
   - **Notes** "(Optional)"
5. Tap **Record Payment**. The summary and **Payment History** refresh.

## Recording a payment against an invoice
1. Open the invoice (`/invoices/:id`), scroll to **Payment Information**, tap
   **Record Payment**. Same form as above; the amount pre-fills with the
   invoice's remaining balance.

## Editing or deleting a payment
1. On the order's detail page, in **Payment History**, open the row's action
   menu: **Edit** opens the same modal titled "Edit Payment" (submit button says
   **Update Payment**); **Delete** asks for confirmation ("Delete payment" —
   this permanently removes the payment) and restores the outstanding balance.
2. The invoice detail page lists payments read-only (no edit/delete there);
   edit/delete controls exist only in the order page's Payment History.

Notes:
- Payment create/update/delete are audited with before/after order metrics
  (total, received, outstanding) — visible on [History](/history).
- Payments are hard-deleted rows (no `is_archived`), so SQL sums over `payments`
  always reflect the current truth.
