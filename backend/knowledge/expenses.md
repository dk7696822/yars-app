# Expenses

What it is: business spending records (bills), each in a user-managed category,
with vendor, quantity × unit cost, optional due date, and a PAID/UNPAID status.
This is separate from the inventory module — raw-material purchases tracked via
purchase orders/goods receipts do not appear here unless entered manually.

## Adding an expense
1. Open [Expenses](/expenses) and tap **New Expense** (top right; **New** on
   phones).
2. Fill the form:
   - **Bill Date** (required, defaults to today)
   - **Category** (required dropdown; if no categories exist yet the page shows
     "You need to create at least one expense category before adding expenses."
     with a **Create Category** button)
   - **Description** (required)
   - **Vendor/Supplier** (required)
   - **Quantity** (default 1) and **Unit Cost** (required) — **Total Cost** is
     calculated automatically and read-only
   - **Due Date** "(Optional)" and **Payment Status** (Unpaid / Paid,
     default Unpaid)
3. Tap **Save Expense**.

## Finding and filtering expenses
1. Open [Expenses](/expenses). The **Total Expense** card at the top shows the
   sum for the current filters ("Based on applied filters").
2. Use the search box (**Search expenses…**) or the filter panel: **Category**,
   **Payment Status** (Paid/Unpaid), **Vendor** (text), **From Date**,
   **To Date**. Filters apply automatically.
3. **Download** exports the filtered list to Excel.

## Editing / deleting an expense
1. Use the edit action on an expense row → same form, tap **Save Expense**.
2. Delete via the row's delete action → confirm **Delete** in the
   "Delete expense" modal. Soft delete.

## Managing expense categories
1. Open [Expense Categories](/expense-categories) (also reachable from the
   **Categories** button on the Expenses page).
2. **New Category** → fill **Category Name** (required) → **Save Category**.
3. Edit via a row's edit action (`/expense-categories/edit/:id`), same form.
4. Delete via the row's delete action. The server refuses ("Cannot delete this
   category as it is being used by expenses") while any expense uses it.
5. Search box: **Search categories...**.

Rules the UI enforces:
- Total Cost is always quantity × unit cost; you cannot type it directly.
- Category names are unique.
