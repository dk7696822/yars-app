# App routes (deep links)

All app screens. Use these paths when linking the user to a screen. `:id` /
`:itemId` are UUIDs — substitute a real id from a query when deep-linking to a
specific record.

| path | screen | purpose |
|---|---|---|
| `/login` | Login | Sign in (username + password, show/hide) |
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
| `/expenses` | Expenses | Expenses by bill date; chips This month · Last month · All · Unpaid and one per category; search; total card (total, count, unpaid); ⋯ Download Excel / Expense categories |
| `/expenses/new` | New expense | Bill date, category (＋ New category), what for, paid to, quantity × cost each (total worked out), paid/unpaid, pay-by date |
| `/expenses/edit/:id` | Edit expense | Same form, pre-filled; Delete expense at the end |
| `/expense-categories` | Expense categories | Add, rename, delete categories in place |
| `/invoices` | Invoices | Rows with Due or Paid ✓; chips All · Unpaid · Overdue |
| `/invoices/new` | New invoice | Three steps: customer → orders (+GST) → review |
| `/invoices/:id` | Invoice | Money card (total incl. tax, received, due), Share PDF, ＋ Payment, WhatsApp reminder; tabs Items · Payments · Details |
| `/history` | History | One-sentence timeline by India day; chips All · Payments · Orders · Stock and Any time · This month · Last month; tap an entry to open its order/invoice/PO |
| `/stock` | Stock | Summary card (value, low stock, received/used this month); items with quantity and value; All · Low stock; ⋯ Excel and links |
| `/stock/:itemId` | Item stock | Quantity, worth, reorder level, Issue stock / Order more; tabs Batches · Movements · Details |
| `/inventory-items` | Items | Raw materials with category, details and reorder level; ⋯ Item categories / Item details |
| `/inventory-items/new` | New item | Name, code, category, counted in, reorder at / order up to, details (GSM…), notes |
| `/inventory-items/edit/:id` | Edit item | Same form, pre-filled; Delete item at the end |
| `/purchase-orders` | Purchase orders | POs with supplier, items received, total and status; search PO number; status chips |
| `/purchase-orders/new` | New purchase order | Three steps: supplier → items → review |
| `/purchase-orders/:id` | Purchase order | Total and status, Receive material; tabs Items · Deliveries · Details; Cancel/Delete under ⋯ before anything is received |
| `/purchase-orders/:id/receive` | Receive material | Quantity and rate per line (pre-filled with what is still to come), date, bill number |
| `/stock-issues` | Stock issues | Issues, wastage and stock corrections by day; type chips; search |
| `/stock-issues/new` | Issue stock | Issue / Wastage / Add stock / Remove stock; items with stock on hand; for order; reason |
| `/suppliers` | Suppliers | Supplier directory; search name or phone |
| `/suppliers/new` | New supplier | Name, mobile, email, GSTIN, address |
| `/suppliers/edit/:id` | Edit supplier | Same form, pre-filled |
| `/suppliers/:id` | Supplier | Call / WhatsApp / New purchase order; tabs Purchase orders · Details; Edit/Delete under ⋯ |
| `/inventory-categories` | Item categories | Add, rename, delete raw-material categories |
| `/item-attributes` | Item details | Details like GSM, Color, Cut and their values (add, rename, delete) |
| `/assistant` | Jarvis | This AI assistant (chat) |

`/invoices/generate` redirects to `/invoices/new`; `/expense-categories/new` and `/expense-categories/edit/:id` redirect to `/expense-categories`.
