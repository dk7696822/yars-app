# Invoices

What it is: tax invoices built from a customer's **unbilled** orders (orders with
no `invoice_id` yet). Generating an invoice stamps those orders with the invoice
id, copies their lines into `invoice_items` (advances appear as negative
"Advance Payment" lines), applies optional tax, and assigns the next 8-digit
invoice number (e.g. 00000042). Status: PENDING → PAID or CANCELLED.

## Generating an invoice
1. Open [Invoices](/invoices) and tap **Generate Invoice** (top right).
   (Or from an unbilled order's detail page, tap **Generate Invoice** — it opens
   this form with the order preselected via the URL.)
2. Pick the **Customer** (dropdown, required). The form then loads that
   customer's unbilled orders under **Select Orders to Include**.
3. Tap order cards to select/deselect them (each shows Order Date, item count
   and its receivable amount). At least one is required.
4. Optionally set **Tax Percentage (%)** (default 0), **Billing Period Start**,
   **Billing Period End** (required dates), and **Payment Due Date**
   (defaults to 30 days out).
5. Tap **Generate Invoice**. You land on the new invoice's detail page.

## Viewing an invoice / downloading the PDF
1. Open [Invoices](/invoices). Search, or filter (funnel) by **Customer**,
   **Status** (Pending / Paid / Cancelled), **Date From**, **Date To**.
2. Tap **View** on an invoice (or its number) to open `/invoices/:id`:
   Invoice Information (Invoice Date, Due Date, Billing Period, Status),
   Customer Information, **Invoice Items** table (Description, Quantity,
   Rate, Amount), totals (**Subtotal**, **Advance Paid** if any,
   **Tax (…%)**, **Total Payable**), and **Payment Information**.
3. **Download PDF** opens the printable invoice in a new tab. Also available
   from the list via the **PDF** button / row actions.

## Marking paid / cancelling
1. On the invoice detail page (while status is PENDING): tap **Mark as Paid**
   or **Cancel Invoice**, then confirm ("Yes, Update Status"). The same actions
   exist in each row's action menu on the list.

## Recording a payment against an invoice
1. On `/invoices/:id`, in **Payment Information**, tap **Record Payment**
   (shown only while not fully paid). See payments.md for the form fields.

## Deleting an invoice
1. On [Invoices](/invoices), use **Delete** in the row's action menu and confirm
   in the "Delete Invoice" modal. Soft delete.

Notes:
- "Advance Paid" and **Total Payable** on the detail page are derived from
  invoice items whose description contains "Advance Payment" plus non-advance
  payments.
- An order can be on at most one invoice; once billed, the order's
  **Generate Invoice** button disappears and a **View Invoice →** link appears.
- Invoice items show units: kg lines as "Rs. 180.00 / kg" × "50 kg", pieces
  lines with the price as entered ("Rs. 375.00 / 1,000 pcs" × "5,000 pcs").
  Invoices made before piece orders existed show no units. Estimated weights
  never appear on invoices.
- Editing an order after it is invoiced does NOT change the invoice; delete the
  invoice and generate it again to pick up the changes.
