# Customers

What it is: the shops and people you sell to. A customer has a name and,
optionally, a mobile number (used for Call and WhatsApp reminders), a city or
area, and under "More details" an email, full address and GSTIN.

## Finding a customer
1. Open [Customers](/customers). Everyone is listed A–Z with a letter index on
   the right; each row shows the last order and number of orders, and what the
   customer owes in red (or "Paid up"). The phone button calls them.
2. Search by name, or by any 3+ digits of the phone number.
3. Tap **Owe money** to see only customers who owe, oldest unpaid first (the
   same list as [Dues](/dues)).

## The customer page
`/customers/:id` shows what they **Owe** (and how old their oldest unpaid
order is), **Total business**, **Received** and number of **Orders**, with
**New order**, **Call** and **Remind** (a WhatsApp message listing the unpaid
orders). Tabs: **Orders** (Unpaid / Paid / Cancelled), **Payments**,
**Details**. Only this customer's own orders are shown; cancelled orders are
listed but not counted.

## Adding a customer
1. On [Customers](/customers) tap **New**. (While making an order or invoice,
   the customer picker's **＋ New customer** opens a quick name + mobile form
   and returns straight to the order.)
2. Type the **Shop / customer name**. If similar names already exist, a warning
   lists them with what they owe, so the same shop isn't added twice.
3. **Mobile** (optional, recommended): the 10-digit number after +91; a tick
   confirms Call and WhatsApp will work.
4. **City / area** (optional). **More details**: email, full address, GSTIN
   (15 characters, e.g. 29ABCDE1234F1Z5).
5. Tap **Save customer**.

## Editing or deleting
- Customer page → **⋯ → Edit customer** (same form), or **Details → Edit details**.
- **⋯ → Delete customer** asks first. Their orders stay and still count in
  totals and dues. Soft delete.
