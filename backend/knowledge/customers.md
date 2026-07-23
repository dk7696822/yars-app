# Customers

What it is: the customer master. Every order, invoice and payment hangs off a
customer. Contact details (phone/email/address) are optional and stored in the
customer's `metadata` JSON.

## Adding a customer
1. Open [Customers](/customers) and tap **New Customer** (top right).
2. Fill **Customer Name** (required, marked *).
3. Optionally fill **Email**, **Phone**, **Address** (all marked "(Optional)").
4. Tap **Save Customer**. (**Cancel** discards.)
5. You return to the list with "Customer created successfully".

## Finding / viewing a customer
1. Open [Customers](/customers).
2. Type in the **Search customers...** box (matches name only).
3. Tap the customer's name to open their detail page (`/customers/:id`), which
   shows **Contact Information** (Phone / Email / Address — "Not provided" when
   empty) and an **Orders** section listing all their orders.
4. From the detail page: **Edit** opens the edit form; **New Order** starts an
   order (note: the customer is NOT pre-selected in the order form — pick them
   in the Customer dropdown).

## Editing a customer
1. Open [Customers](/customers), find the customer, use the edit action (or open
   their detail page and tap **Edit**).
2. Same form as create (Customer Name / Email / Phone / Address).
3. Tap **Save Customer**.

## Deleting a customer
1. On [Customers](/customers), use the delete action on the customer's row.
2. Confirm in the "Delete Customer" modal (**Delete**).
3. This is a soft delete (`is_archived = true`); their orders and history remain
   in the database.

Rules the UI enforces:
- Name is the only required field.
- The list is paginated 10 per page (client-side).
