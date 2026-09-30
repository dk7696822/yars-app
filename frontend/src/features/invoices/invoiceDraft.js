import { orderTotal } from "../../utils/orderMath";
import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";

export const INVOICE_STEPS = ["Customer", "Orders", "Review"];

export const billableOrders = (orders) =>
  orders.filter((o) => !o.invoice_id && o.status !== "CANCELLED").sort((a, b) => a.order_date.localeCompare(b.order_date));

export const billingPeriod = (orders) => {
  if (!orders.length) return null;
  const dates = orders.map((o) => o.order_date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
};

const twoDp = (x) => Number(x.toFixed(2)); // the server stores toFixed(2) of these same sums

/** Same arithmetic as the server's generateInvoice, so the preview is exactly what gets saved. */
export const invoiceTotals = (orders, gstOn, gstText) => {
  const subtotal = orders.reduce((s, o) => s + orderTotal(o), 0);
  const percent = gstOn ? parseNumber(gstText, { allowZero: true }).value ?? 0 : 0;
  const tax = (subtotal * percent) / 100;
  return { subtotal: twoDp(subtotal), percent, tax: twoDp(tax), final: twoDp(subtotal + tax) };
};

export const invoiceErrors = (d, step) => {
  if (step === 0) return d.customer ? {} : { customer: "Choose a customer" };
  if (step === 1) {
    const e = {};
    if (!d.selected.length) e.orders = "Tick at least one order";
    if (d.gstOn) {
      const p = parseNumber(d.gst);
      if (p.error || p.value === null) e.gst = p.error || "Enter the GST %";
      else if (p.value > 100) e.gst = "GST can't be more than 100%";
    }
    return e;
  }
  return isISODate(d.dueDate) ? {} : { dueDate: "Choose the payment due date" };
};

export const toInvoicePayload = (d, orders) => {
  const period = billingPeriod(orders);
  return {
    customer_id: d.customer.id,
    order_ids: orders.map((o) => o.id),
    billing_period_start: period.from,
    billing_period_end: period.to,
    payment_due_date: d.dueDate,
    tax_percent: d.gstOn ? parseNumber(d.gst).value : 0,
  };
};
