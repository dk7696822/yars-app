# App routes (deep links)

All app screens. Use these paths when linking the user to a screen. `:id` /
`:itemId` are UUIDs — substitute a real id from a query when deep-linking to a
specific record.

| path | screen | purpose |
|---|---|---|
| `/login` | Login | Sign in (username + password) |
| `/` | Dashboard | To collect (dues by age, customers to chase with call/WhatsApp), period figures (sales, collected, kg/pcs, expenses) with charts, recent orders |
| `/dues` | Dues | Every customer who owes, oldest dues first; filter by age (`/dues?age=90+`, `61-90`, `31-60`, `0-30`); call/WhatsApp reminder |
| `/orders` | Orders | List, search, filter, delete orders; Excel download |
| `/orders/new` | Create Order | New bag-manufacturing order |
| `/orders/edit/:id` | Edit Order | Change an existing order |
| `/orders/:id` | Order Details | Full order view: items, totals, payments (record/edit/delete payments here) |
| `/customers` | Customers | Customer list with search |
| `/customers/new` | Create Customer | Add a customer |
| `/customers/edit/:id` | Edit Customer | Update a customer |
| `/customers/:id` | Customer Details | Contact info + that customer's orders |
| `/plate-types` | Plate Types | Master list of printing plate types (name + charge) |
| `/plate-types/new` | Create Plate Type | Add a plate type |
| `/plate-types/edit/:id` | Edit Plate Type | Update a plate type |
| `/product-sizes` | Product Sizes | Master list of bag sizes (label, rate per kg and/or piece price, optional weight) |
| `/product-sizes/new` | Create Product Size | Add a product size |
| `/product-sizes/edit/:id` | Edit Product Size | Update a product size |
| `/expenses` | Expenses | Expense list, filters, total card, Excel download |
| `/expenses/new` | Create Expense | Add an expense |
| `/expenses/edit/:id` | Edit Expense | Update an expense |
| `/expense-categories` | Expense Categories | Manage expense categories |
| `/expense-categories/new` | Create Category | Add an expense category |
| `/expense-categories/edit/:id` | Edit Category | Rename an expense category |
| `/invoices` | Invoices | Invoice list, filters, PDF download, mark paid/cancel |
| `/invoices/generate` | Generate Invoice | Build an invoice from a customer's unbilled orders |
| `/invoices/:id` | Invoice Details | Invoice view: items, totals, payments, PDF |
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
