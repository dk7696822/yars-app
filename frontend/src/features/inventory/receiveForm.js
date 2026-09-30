import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";
import { QTY_DP } from "./labels";

const q = (t) => parseNumber(t, { dp: QTY_DP, allowZero: true });
const r = (t) => parseNumber(t);
const n = (v) => Number(v) || 0;

export const receiveLinesFromPo = (po) => po.items.map((l) => ({
  id: l.id,
  name: l.item?.name || "Item",
  unit: l.item?.unit || "",
  ordered: n(l.quantity_ordered),
  received: n(l.quantity_received),
  pending: n(l.quantity_pending),
  quantity: n(l.quantity_pending) > 0 ? String(n(l.quantity_pending)) : "",
  rate: String(n(l.rate)),
}));

const receiving = (form) => form.lines.filter((l) => (q(l.quantity).value || 0) > 0);

export const receiveErrors = (form) => {
  const e = {};
  if (!isISODate(form.receipt_date)) e.receipt_date = "Choose the date it arrived";
  for (const l of form.lines) {
    const qty = q(l.quantity);
    if (qty.error) e[`qty:${l.id}`] = qty.error;
    else if ((qty.value || 0) > 0) {
      const rate = r(l.rate);
      if (rate.error || rate.value === null) e[`rate:${l.id}`] = rate.error || "Enter the rate";
    }
  }
  if (!Object.keys(e).length && !receiving(form).length) e.lines = "Enter a quantity on at least one line";
  return e;
};

/** Receiving more than is open is allowed (the supplier sent extra) but shown. */
export const isOverReceipt = (l) => (q(l.quantity).value || 0) > l.pending + 0.0005;

export const receiveTotal = (form) =>
  receiving(form).reduce((sum, l) => sum + Math.round(q(l.quantity).value * (r(l.rate).value || 0) * 100), 0) / 100;

export const toReceivePayload = (form) => ({
  receipt_date: form.receipt_date,
  supplier_bill_ref: form.supplier_bill_ref.trim() || null,
  notes: form.notes.trim() || null,
  items: receiving(form).map((l) => ({ purchase_order_item_id: l.id, quantity_received: q(l.quantity).value, rate: r(l.rate).value })),
});
