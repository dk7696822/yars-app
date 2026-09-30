import { inr, shortDate } from "./dashboardFormat";

const MAX_ORDERS = 10;

export const buildReminder = ({ name, amount, unpaidOrders }) => {
  const lines = [`Namaste ${name}, this is a gentle reminder from YARS Industries.`, `Pending balance: ${inr(amount)}`];
  for (const o of unpaidOrders.slice(0, MAX_ORDERS)) lines.push(`• Order of ${shortDate(o.orderDate)} — ${inr(o.remaining)}`);
  if (unpaidOrders.length > MAX_ORDERS) lines.push(`…and ${unpaidOrders.length - MAX_ORDERS} more orders`);
  lines.push("Kindly arrange the payment at your convenience. Thank you!");
  return lines.join("\n");
};

export const buildInvoiceReminder = ({ name, number, invoiceDate, amountDue }) =>
  [
    `Namaste ${name}, this is a gentle reminder from YARS Industries.`,
    `Invoice #${number} dated ${shortDate(invoiceDate)} — balance due: ${inr(amountDue)}`,
    "Kindly arrange the payment at your convenience. Thank you!",
  ].join("\n");
