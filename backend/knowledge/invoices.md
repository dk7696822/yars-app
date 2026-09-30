# Invoices

What it is: invoices built from a customer's orders that are not on an invoice
yet (not cancelled). Creating one stamps those orders with the invoice id,
copies their lines into `invoice_items`, applies optional GST, and assigns the
next 8-digit number (e.g. 00000042).

## How much is due
**Due = invoice total (including GST) − everything received on the invoice's
orders** (payments, advances; refunds subtracted). The status is worked out
from that: **Paid** when nothing is due, **Overdue** when the due date has
passed with money still due, otherwise **Unpaid** — only **Cancelled** is set
by hand. The same Due shows on the list, the invoice page and the PDF.

## Making an invoice
1. Open [Invoices](/invoices) → **New** (or an order's **⋯ → Create invoice**,
   which starts with that customer). Three steps with **Back** on each:
2. **Customer** — choose from the picker.
3. **Orders** — every order not yet invoiced is ticked; untick any to leave
   out. **Add GST** switches tax on (default 18%, editable). The billing period
   is taken from the ticked orders.
4. **Review** — orders total, GST, invoice total; set **Payment due** (30 days
   by default). Tap **Create invoice**. You land on the new invoice.

## The invoice page
`/invoices/:id`: customer, dates and status; a money card — **Orders total**,
**GST**, **Received on these orders**, **Due** — with **Share PDF** (phone
share sheet, or a download), **＋ Payment** (choose which order the money is
for) and **Remind** (WhatsApp with the invoice number and balance). Tabs:
**Items**, **Payments**, **Details** (dates, GST and the orders with each
one's due). **⋯**: **Cancel invoice** (asks first; Restore afterwards) and
**Delete invoice** (its orders become un-invoiced; payments stay on the orders).

## Finding invoices
[Invoices](/invoices) lists them newest first with **Due ₹…** or **Paid ✓**;
chips **All · Unpaid · Overdue**; search by customer or invoice number.

Notes:
- An order can be on only one invoice. Editing an order after it is invoiced
  does NOT change the invoice; delete the invoice and create it again.
- Invoice items show units: kg lines as "₹180.00/kg" × "50 kg", pieces lines
  with the price as entered ("₹375.00 / 1,000 pcs" × "5,000 pcs"). Invoices
  made before piece orders existed show no units. Estimated weights never
  appear on invoices.
