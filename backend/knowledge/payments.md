---
area: payments
summary: Recording, editing and refunding payments; received and due
keywords: paid, pay, pays, payment, payments, refund, upi, cash, cheque, received, advance
tables: payments
---
# Payments

Money received from customers. Recorded on an **order's page** (`/orders/:id`) or an **invoice's page** (`/invoices/:id`) — there is no separate payments screen. Methods: **Cash, UPI, Bank, Cheque, Other**. Types: Advance, Part payment, Final payment, Refund.

## On an order
Open the order (from [Orders](/orders)) → **＋ Record payment**: **Amount** (or **Full due ₹…**), method, **Date** (today by default), optional reference or note. The whole due or more is saved as a **Final payment**, less as a **Part payment**. Paying more than the due asks once ("Save anyway") and shows as extra received. **⋯ → Record advance** and **⋯ → Record refund** are separate; a refund can't be more than what was received, and it raises the due again. A cancelled order takes no payments.

## On an invoice
Invoice page → **＋ Payment** → under **Money is for** choose one of its orders or **The invoice itself** (e.g. its GST). Money on the invoice itself counts toward the invoice's due, not any order's or the dashboard's Collected.

## Editing or deleting
Order page → **Payments** tab → **⋯** on a payment: **Edit payment** or **Delete payment** (asks first). Every change shows on [History](/history) with the order's received and due before and after.

## Table `payments`
`id`, `order_id` (NULL for invoice-only money), `invoice_id`, `customer_id` (always set), `payment_type` ADVANCE|PARTIAL|FINAL|REFUND, `amount`, `payment_date`, `payment_method` CASH|BANK_TRANSFER|UPI|CHECK|OTHER, `reference_number`, `notes`. Hard-deleted (no is_archived). Refunds are money given back: subtract them.
