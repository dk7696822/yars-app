---
area: invoices
summary: Making invoices, GST, invoice status and what is due on them
keywords: invoice, invoices, gst, billed
tables: invoices, invoice_items
---
# Invoices

An invoice is built from a customer's orders that aren't on an invoice yet (and not cancelled). It copies their lines, adds optional GST and gets the next 8-digit number (e.g. 00000042). An order can be on only one invoice.

**Due = invoice total (with GST) − everything received on its orders** (payments and advances, refunds subtracted). Status: **Paid** when nothing is due, **Overdue** after the due date with money due, otherwise **Unpaid**; only **Cancelled** is set by hand.

## Making one
[Invoices](/invoices) → **New** (or an order's **⋯ → Create invoice**). Three steps: **Customer**; **Orders** (all un-invoiced orders ticked; untick to leave out; **Add GST**, 18% by default); **Review** (set **Payment due**, 30 days by default) → **Create invoice**.

## Invoice page (`/invoices/:id`)
Money card **Orders total, GST, Received on these orders, Due**, with **Share PDF**, **＋ Payment** (choose the order, or the invoice itself for GST) and **Remind** (WhatsApp). Tabs **Items, Payments, Details**. **⋯**: Cancel invoice (Restore afterwards), Delete invoice (its orders become un-invoiced; payments stay).

## Finding
[Invoices](/invoices): newest first with **Due ₹…** or **Paid ✓**; chips **All · Unpaid · Overdue**; search customer or number.

Editing an order after it is invoiced does not change the invoice — delete the invoice and create it again.

## Tables
`invoices`: `id`, `customer_id`, `invoice_number`, `invoice_date`, `billing_period_start/end`, `payment_due_date`, `total_amount` (pre-tax), `tax_percent`, `tax_amount`, `final_amount`, `status`, `is_archived`. Use the app's Due rule above, not `status`.
`invoice_items`: `invoice_id`, `order_id`, `description`, `quantity`, `unit_price` (negative for advance lines), `total_price`, `unit` KG|PIECES|NULL.
