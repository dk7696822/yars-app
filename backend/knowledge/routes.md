# App routes (deep links)

All app screens. Use these paths when linking the user to a screen. `:id` /
`:itemId` are UUIDs — substitute a real id from a query when deep-linking to a
specific record.

| path | screen | purpose |
|---|---|---|
| `/login` | Login | Sign in (username + password) |
| `/` | Dashboard | To collect (dues by age, customers to chase with call/WhatsApp), period figures (sales, collected, kg/pcs, expenses) with charts, recent orders |
| `/dues` | Dues | Every customer who owes, oldest dues first; filter by age (`/dues?age=90+`, `61-90`, `31-60`, `0-30`); call/WhatsApp reminder |
| `/orders` | Orders | Orders by day with Due/Paid on each row; search customer or size; chips All · Due · In progress · This month; Excel download under ⋯ |
| `/orders/new` | New order | Three steps: customer & date → items → plate, extras & review |
| `/orders/edit/:id` | Edit order | Same three steps, pre-filled |
| `/orders/:id` | Order | Money card (total, received, due, ＋ Record payment); tabs Items · Payments · Details; Edit/Invoice/Advance/Refund/Delete under ⋯ |
| `/customers` | Customers | A–Z directory with dues; chip "Owe money"; search by name or phone |
| `/customers/new` | New customer | Name (with similar-name check), mobile, city; more details: email, address, GSTIN |
| `/customers/edit/:id` | Edit customer | Same form, pre-filled |
| `/customers/:id` | Customer | What they owe, total business, New order / Call / WhatsApp; tabs Orders · Payments · Details |
| `/plate-types` | Plate types | Printing plate types with their charge; tap one to edit |
| `/plate-types/new` | New plate type | Name + charge |
| `/plate-types/edit/:id` | Edit plate type | Change name/charge, or delete |
| `/product-sizes` | Sizes | Bag sizes with how each is priced (per kg / per pieces / weight); tap one to edit |
| `/product-sizes/new` | New size | Size, rate per kg, piece price, weight |
| `/product-sizes/edit/:id` | Edit size | Change prices/weight, or delete |
| `/expenses` | Expenses | Expense list, filters, total card, Excel download |
| `/expenses/new` | Create Expense | Add an expense |
| `/expenses/edit/:id` | Edit Expense | Update an expense |
| `/expense-categories` | Expense Categories | Manage expense categories |
| `/expense-categories/new` | Create Category | Add an expense category |
| `/expense-categories/edit/:id` | Edit Category | Rename an expense category |
| `/invoices` | Invoices | Rows with Due or Paid ✓; chips All · Unpaid · Overdue |
| `/invoices/new` | New invoice | Three steps: customer → orders (+GST) → review |
| `/invoices/:id` | Invoice | Money card (total incl. tax, received, due), Share PDF, ＋ Payment, WhatsApp reminder; tabs Items · Payments · Details |
| `/history` | History | Audit log of payment/order/inventory document changes |
| `/stock` | Stock | Stock on hand per raw material: value, low-stock, filters, export |
| `/stock/:itemId` | Stock Item Detail | One item: open FIFO batches + movement history |
| `/inventory-items` | Inventory Items | Raw material master list |
| `/inventory-items/new` | New Inventory Item | Add a raw material |
| `/inventory-items/edit/:id` | Edit Inventory Item | Update a raw material |
| `/purchase-orders` | Purchase Orders | POs to suppliers, status tracking |
| `/purchase-orders/new` | New Purchase Order | Create a PO |
| `/purchase-orders/:id` | Purchase Order Detail | Ordered vs received per line, goods receipts |
| `/purchase-orders/:id/receive` | Receive Material | Record a goods receipt against a PO |
| `/stock-issues` | Stock Issues | Issues, wastage and adjustments list |
| `/stock-issues/new` | Record Stock Issue | Consume/waste/adjust stock |
| `/suppliers` | Suppliers | Supplier list |
| `/suppliers/new` | New Supplier | Add a supplier |
| `/suppliers/edit/:id` | Edit Supplier | Update a supplier |
| `/suppliers/:id` | Supplier Detail | Contact info + that supplier's POs |
| `/inventory-categories` | Inventory Categories | Manage raw-material categories (inline add/rename/delete) |
| `/item-attributes` | Item Attributes | Manage attributes (GSM, Color, Cut…) and their values |
| `/assistant` | Assistant | This AI assistant (chat) |

`/invoices/generate` redirects to `/invoices/new`.
