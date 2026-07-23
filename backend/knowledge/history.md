# History (audit log)

What it is: a read-only **Activity Log** of important changes — who-did-what for
payments, orders, and the inventory documents. Backed by the `audit_logs` table.
Entries record the action (CREATE / UPDATE / DELETE), old/new values, and useful
metadata (customer name; for payments, the order's total/received/outstanding
before and after).

What is logged:
- **Payment** — create, update, delete (with before/after order metrics).
- **Order** — create; updates only when the status changes or the order is
  archived (a soft delete is logged as DELETE).
- **Purchase Order**, **Goods Receipt**, **Stock Issue** — inventory documents.
Not logged: customers, expenses, invoices, master-data edits.

## Reviewing recent activity
1. Open [History](/history). The **Activity Log** lists entries newest first,
   20 per page ("Page N of M" pagination at the bottom).
2. To narrow it down, open the filter panel and set:
   - **Type**: Payment / Order / Purchase Order / Goods Receipt / Stock Issue
   - **Action**: Created / Updated / Deleted
   - **From Date** / **To Date**
   Filters apply automatically; active ones appear as removable chips.

## Answering "when/who changed this" questions
1. Filter by the relevant **Type** and date range on [History](/history), or
   query `audit_logs` directly — filter `entity_type`/`action`, order by
   `created_at DESC`; `metadata` and `old_values`/`new_values` (JSONB) carry
   the details. Note `entity_id` is polymorphic (no FK) — join manually to the
   right table based on `entity_type`.
