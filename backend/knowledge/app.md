---
area: app
summary: Every screen's path, for links
keywords:
tables:
---
# Screens and their paths

Link with these paths; `:id` is a record's id from a tool.

- `/` Dashboard · `/dues` Dues (`?age=0-30`, `31-60`, `61-90`, `90+`)
- `/orders` Orders · `/orders/new` New order · `/orders/:id` Order (Record payment, status, Edit / Invoice / Advance / Refund / Cancel / Delete under ⋯) · `/orders/edit/:id` Edit order
- `/customers` Customers · `/customers/new` New customer · `/customers/:id` Customer · `/customers/edit/:id` Edit customer
- `/invoices` Invoices · `/invoices/new` New invoice · `/invoices/:id` Invoice (＋ Payment, Share PDF)
- `/plate-types` Plate types · `/plate-types/new` · `/plate-types/edit/:id`
- `/product-sizes` Sizes · `/product-sizes/new` · `/product-sizes/edit/:id`
- `/expenses` Expenses · `/expenses/new` New expense · `/expenses/edit/:id` · `/expense-categories` Expense categories
- `/history` History
- `/stock` Stock · `/stock/:itemId` Item stock · `/stock-issues` Stock issues · `/stock-issues/new` Issue stock
- `/inventory-items` Items · `/inventory-items/new` · `/inventory-items/edit/:id` · `/inventory-categories` Item categories · `/item-attributes` Item details
- `/purchase-orders` Purchase orders · `/purchase-orders/new` · `/purchase-orders/:id` · `/purchase-orders/:id/receive` Receive material
- `/suppliers` Suppliers · `/suppliers/new` · `/suppliers/:id` · `/suppliers/edit/:id`
- `/assistant` this assistant (chat)

Payments have no screen of their own: they are on the order (`/orders/:id`) or invoice (`/invoices/:id`).
