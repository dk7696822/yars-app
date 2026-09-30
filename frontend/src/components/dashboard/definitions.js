import { inr, rangeText } from "../../utils/dashboardFormat";

export const DEFINITIONS = {
  toCollect: { title: "To collect", body: ["Everything customers still owe today, across all orders: each order's total minus what has been received (the advance is counted once).", "The age bands group the same amounts by how old the order is, and always add up to this total.", "Orders marked Cancelled and deleted orders are not included."] },
  sales: { title: "Sales", body: ["Total value of orders dated in the selected period — the same order totals as the Orders screen.", "Cancelled and deleted orders are not included."] },
  collected: { title: "Collected", body: ["Money received in the selected period (by payment date), including payments on older orders.", "Payments on deleted orders are not included."] },
  kg: { title: "Kg sold", body: ["Kg from orders taken in kg, plus estimated kg (≈) for orders taken in pieces whose size has a weight. Each order line is counted once.", "Pieces without a weight are listed separately and are not in the kg."] },
  expenses: { title: "Expenses", body: ["Bills dated in the selected period, from the Expenses screen.", "Shown on its own, not as profit: large raw-material purchases are used over many months."] },
};

/** Extra ⓘ lines built from the server's response — dates covered and anything excluded. */
export const infoExtras = (key, period) => {
  if (!period || key === "toCollect") return [];
  const lines = [`Period: ${rangeText(period.range)}${period.compare ? `, compared with ${rangeText(period.compare)}` : ""}.`];
  const ex = period.excluded || {};
  if (key === "sales" && ex.cancelled?.count > 0) {
    lines.push(`Excludes ${ex.cancelled.count} cancelled order(s) worth ${inr(ex.cancelled.amount)}.`);
  }
  if (key === "collected") {
    if (ex.deletedOrderPayments?.count > 0) lines.push(`Excludes ${inr(ex.deletedOrderPayments.amount)} from ${ex.deletedOrderPayments.count} payment(s) on deleted orders.`);
    if (ex.unlinkedPayments?.count > 0) lines.push(`Excludes ${inr(ex.unlinkedPayments.amount)} from ${ex.unlinkedPayments.count} payment(s) made on an invoice as a whole (such as GST), not on an order.`);
  }
  return lines;
};
