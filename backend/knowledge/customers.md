---
area: customers
summary: Adding, finding and editing customers
keywords: customer, customers, shop, party, gstin, phone, mobile
tables: customers
---
# Customers

The shops and people you sell to: a name and, optionally, a mobile (for Call and WhatsApp reminders), a city, and under **More details** an email, address and GSTIN.

## Finding
[Customers](/customers) lists everyone A–Z with what they owe (red) or "Paid up". Search by name or 3+ digits of the phone. **Owe money** shows only customers who owe, oldest unpaid first (same as [Dues](/dues)).

## Customer page (`/customers/:id`)
**Owe**, **Total business**, **Received**, **Orders**, with **New order**, **Call**, **Remind** (WhatsApp listing unpaid orders). Tabs **Orders** (Unpaid / Paid / Cancelled), **Payments**, **Details**. Cancelled orders are listed but not counted.

## Adding
On [Customers](/customers) tap **New** (or **＋ New customer** in the order or invoice customer picker). Type **Shop / customer name** — similar existing names are listed as a warning. Optional **Mobile** (10 digits after +91), **City / area**, and in **More details**: email, address, **GSTIN** (15 characters, like 29ABCDE1234F1Z5). Tap **Save customer**.

## Editing or deleting
Customer page → **⋯ → Edit customer**. **⋯ → Delete customer** asks first; their orders stay and still count (soft delete).

## Table `customers`
`id` UUID, `name` TEXT, `metadata` JSONB `{phone, email, address, city, gstin}` (contact details live here, not in columns), `is_archived`, `created_at`, `updated_at`.
