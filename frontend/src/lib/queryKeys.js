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
};

/** After any change to an order, payment, customer or invoice, every screen showing money refreshes. */
export const invalidateMoney = (queryClient) =>
  Promise.all([keys.orders.all, keys.customers.all, keys.invoices.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
