---
area: expenses
summary: Adding and finding expenses and their categories
keywords: expense, expenses, spent, spend, vendor
tables: expenses, expense_categories
---
# Expenses

Money spent running the factory: bill date, category, what it was for, who was paid, quantity × cost each (the total is always quantity × cost), paid or unpaid, and an optional pay-by date.

## Seeing expenses
[Expenses](/expenses): grouped by bill date, newest first. Chips **This month** (default) · **Last month** · **All** · **Unpaid**, and one per category; search matches what it was for or who was paid. The top card shows the total, how many and how much is unpaid. **⋯ → Download Excel of this list**.

## Adding or editing
Tap **New** (or tap an expense). Fill **Bill date**, **Category** (search; **＋ New category**), **What was it for**, **Paid to**, **Quantity**, **Cost each** (total worked out), **Paid** or **Unpaid**, optional **Pay by**. Tap **Save expense**. **Delete expense** (on an existing one) asks first.

## Categories
[Expense categories](/expense-categories) (or **⋯ → Expense categories**): add, rename, delete. A category used by expenses can't be deleted.

## Tables
`expenses`: `id`, `bill_date`, `category_id`, `description`, `vendor`, `quantity`, `unit_cost`, `total_cost`, `due_date`, `payment_status` PAID|UNPAID, `is_archived`.
`expense_categories`: `id`, `name`, `is_archived`.
For a period's total and categories, prefer period_summary.
