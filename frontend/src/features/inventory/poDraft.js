import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";
import { QTY_DP } from "./labels";

export const PO_STEPS = ["Supplier", "Items", "Review"];

let seq = 0;
export const newPoLine = (item) => ({ key: `l${Date.now()}-${(seq += 1)}`, item_id: item?.id || "", item_name: item?.name || "", unit: item?.unit || "", quantity: "", rate: "" });
export const emptyPo = (today, item) => ({ supplier: null, order_date: today, expected_date: "", notes: "", lines: [newPoLine(item)] });

const q = (t) => parseNumber(t, { dp: QTY_DP });
const r = (t) => parseNumber(t);
const blank = (l) => !l.item_id && !String(l.quantity).trim() && !String(l.rate).trim();
const used = (d) => d.lines.filter((l) => !blank(l));

export const lineAmount = (l) => {
  const qty = q(l.quantity).value;
  const rate = r(l.rate).value;
  return qty === null || rate === null ? null : Math.round(qty * rate * 100) / 100;
};
export const poTotal = (d) => used(d).reduce((sum, l) => sum + Math.round((lineAmount(l) || 0) * 100), 0) / 100;

export const poErrors = (d, step) => {
  const e = {};
  if (step === 0) {
    if (!d.supplier) e.supplier = "Choose a supplier";
    if (!isISODate(d.order_date)) e.order_date = "Choose the order date";
    if (d.expected_date && d.expected_date < d.order_date) e.expected_date = "Can't be before the order date";
  }
  if (step === 1) {
    const lines = used(d);
    if (!lines.length) e.lines = "Add at least one item";
    for (const l of lines) {
      if (!l.item_id) e[`item:${l.key}`] = "Choose an item";
      const qty = q(l.quantity);
      if (qty.error || qty.value === null) e[`qty:${l.key}`] = qty.error || "Enter the quantity";
      const rate = r(l.rate);
      if (rate.error || rate.value === null) e[`rate:${l.key}`] = rate.error || "Enter the rate";
    }
  }
  return e;
};

export const toPoPayload = (d) => ({
  supplier_id: d.supplier.id,
  order_date: d.order_date,
  expected_date: d.expected_date || null,
  notes: d.notes.trim() || null,
  items: used(d).map((l) => ({ item_id: l.item_id, quantity_ordered: q(l.quantity).value, rate: r(l.rate).value })),
});
