/**
 * Header title, where Back goes, and whether the bottom bar hides. Forms have
 * no header Back: their own footer Back asks before discarding what was typed.
 * Most specific first.
 */
const ROUTES = [
  [/^\/$/, { title: "Dashboard" }],
  [/^\/orders\/new$/, { title: "New order", hideNav: true }],
  [/^\/orders\/edit\/[^/]+$/, { title: "Edit order", hideNav: true }],
  [/^\/orders\/[^/]+$/, { title: "Order", back: "/orders" }],
  [/^\/orders$/, { title: "Orders" }],
  [/^\/customers\/new$/, { title: "New customer", hideNav: true }],
  [/^\/customers\/edit\/[^/]+$/, { title: "Edit customer", hideNav: true }],
  [/^\/customers\/[^/]+$/, { title: "Customer", back: "/customers" }],
  [/^\/customers$/, { title: "Customers" }],
  [/^\/invoices\/new$/, { title: "New invoice", hideNav: true }],
  [/^\/invoices\/[^/]+$/, { title: "Invoice", back: "/invoices" }],
  [/^\/invoices$/, { title: "Invoices" }],
  [/^\/dues/, { title: "Dues" }],
  [/^\/assistant/, { title: "Jarvis" }],
  [/^\/plate-types\/new$/, { title: "New plate type", hideNav: true }],
  [/^\/plate-types\/edit\/[^/]+$/, { title: "Edit plate type", hideNav: true }],
  [/^\/plate-types/, { title: "Plate types" }],
  [/^\/product-sizes\/new$/, { title: "New size", hideNav: true }],
  [/^\/product-sizes\/edit\/[^/]+$/, { title: "Edit size", hideNav: true }],
  [/^\/product-sizes/, { title: "Sizes" }],
  // Not redesigned yet — titles as before.
  [/^\/expense-categories/, { title: "Expense Categories" }],
  [/^\/expenses\/new/, { title: "New Expense" }],
  [/^\/expenses\/edit/, { title: "Edit Expense" }],
  [/^\/expenses/, { title: "Expenses" }],
  [/^\/history/, { title: "History" }],
  [/^\/stock-issues\/new/, { title: "New Stock Issue" }],
  [/^\/stock-issues/, { title: "Stock Issues" }],
  [/^\/stock/, { title: "Stock" }],
  [/^\/inventory-items\/new/, { title: "New Inventory Item" }],
  [/^\/inventory-items\/edit/, { title: "Edit Inventory Item" }],
  [/^\/inventory-items/, { title: "Inventory Items" }],
  [/^\/purchase-orders\/new/, { title: "New Purchase Order" }],
  [/^\/purchase-orders/, { title: "Purchase Orders" }],
  [/^\/suppliers\/new/, { title: "New Supplier" }],
  [/^\/suppliers\/edit/, { title: "Edit Supplier" }],
  [/^\/suppliers/, { title: "Suppliers" }],
  [/^\/inventory-categories/, { title: "Inventory Categories" }],
  [/^\/item-attributes/, { title: "Item Attributes" }],
];

export const routeMeta = (pathname) => {
  for (const [re, meta] of ROUTES) {
    const m = pathname.match(re);
    if (m) return { title: meta.title, back: typeof meta.back === "function" ? meta.back(m) : meta.back || null, hideNav: Boolean(meta.hideNav) };
  }
  return { title: "YARS", back: null, hideNav: false };
};
