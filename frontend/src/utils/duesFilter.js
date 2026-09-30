const DAY = 86400000;
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export const ageBandOf = (orderDate, asOf) => {
  const d = Math.max(0, days(orderDate, asOf));
  return d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
};

/** Customers with unpaid orders in `band`, amounts re-summed in paise from those orders only. */
export const filterByBand = (customers, band, asOf) => {
  if (band === "all") return customers;
  return customers
    .map((c) => {
      const unpaidOrders = c.unpaidOrders.filter((o) => ageBandOf(o.orderDate, asOf) === band);
      const paise = unpaidOrders.reduce((s, o) => s + Math.round(o.remaining * 100), 0);
      return { ...c, amount: paise / 100, orders: unpaidOrders.length, unpaidOrders };
    })
    .filter((c) => c.orders > 0);
};
