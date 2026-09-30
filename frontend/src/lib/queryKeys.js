export const keys = {
  orders: {
    all: ["orders"],
    list: (params) => ["orders", "list", params],
    detail: (id) => ["orders", "detail", id],
    unbilled: (customerId) => ["orders", "unbilled", customerId],
  },
  customers: {
    all: ["customers"],
    directory: (params) => ["customers", "directory", params],
    summary: (id) => ["customers", "summary", id],
    detail: (id) => ["customers", "detail", id],
    similar: (name, excludeId) => ["customers", "similar", name, excludeId || null],
  },
  invoices: { all: ["invoices"], list: (params) => ["invoices", "list", params], detail: (id) => ["invoices", "detail", id] },
  catalog: { sizes: ["catalog", "sizes"], plates: ["catalog", "plates"] },
  expenses: { all: ["expenses"], list: (p) => ["expenses", "list", p], detail: (id) => ["expenses", "detail", id], categories: ["expenses", "categories"] },
  history: { list: (p) => ["history", p] },
  stock: { all: ["stock"], list: (p) => ["stock", "list", p], summary: ["stock", "summary"], item: (id) => ["stock", "item", id], movements: (id, p) => ["stock", "movements", id, p] },
  items: { all: ["items"], list: (p) => ["items", "list", p], picker: ["items", "picker"], detail: (id) => ["items", "detail", id] },
  inventory: { categories: ["inventory", "categories"], attributes: ["inventory", "attributes"] },
  purchaseOrders: { all: ["purchase-orders"], list: (p) => ["purchase-orders", "list", p], detail: (id) => ["purchase-orders", "detail", id] },
  stockIssues: { all: ["stock-issues"], list: (p) => ["stock-issues", "list", p] },
  suppliers: { all: ["suppliers"], list: (p) => ["suppliers", "list", p], picker: ["suppliers", "picker"], detail: (id) => ["suppliers", "detail", id] },
  assistant: { conversations: ["assistant", "conversations"] },
};

/** After any change to an order, payment, customer or invoice, every screen showing money refreshes. */
export const invalidateMoney = (queryClient) =>
  Promise.all([keys.orders.all, keys.customers.all, keys.invoices.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
