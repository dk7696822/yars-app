import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";
import { QTY_DP } from "./labels";

export const isAdjustment = (t) => t === "ADJUSTMENT_IN" || t === "ADJUSTMENT_OUT";
export const takesOrder = (t) => t === "ISSUE" || t === "WASTAGE";

let seq = 0;
export const newIssueLine = (item) => ({
  key: `s${Date.now()}-${(seq += 1)}`, item_id: item?.id || "", item_name: item?.name || "", unit: item?.unit || "", in_stock: item?.in_stock, quantity: "", wastage: "",
});
export const emptyIssue = (today, item) => ({ issue_type: "ISSUE", issue_date: today, order: null, reason: "", notes: "", lines: [newIssueLine(item)] });

const q = (t) => parseNumber(t, { dp: QTY_DP });
const w = (t) => parseNumber(t, { dp: QTY_DP, allowZero: true });
const used = (f) => f.lines.filter((l) => l.item_id || String(l.quantity).trim() || String(l.wastage).trim());

export const issueErrors = (f) => {
  const e = {};
  if (!isISODate(f.issue_date)) e.issue_date = "Choose the date";
  if (isAdjustment(f.issue_type) && !f.reason.trim()) e.reason = "Say why the count changed";
  const lines = used(f);
  if (!lines.length) e.lines = "Add at least one item";
  for (const l of lines) {
    if (!l.item_id) e[`item:${l.key}`] = "Choose an item";
    const qty = q(l.quantity);
    if (qty.error || qty.value === null) e[`qty:${l.key}`] = qty.error || "Enter the quantity";
    if (f.issue_type === "ISSUE" && w(l.wastage).error) e[`waste:${l.key}`] = w(l.wastage).error;
  }
  return e;
};

/** How much each line is short by, counting earlier lines of the same item. Adding stock is never short. */
export const shortfalls = (f) => {
  if (f.issue_type === "ADJUSTMENT_IN") return {};
  const drawn = {};
  const out = {};
  for (const l of used(f)) {
    if (!l.item_id || l.in_stock === undefined || l.in_stock === null) continue;
    const need = (q(l.quantity).value || 0) + (f.issue_type === "ISSUE" ? w(l.wastage).value || 0 : 0);
    drawn[l.item_id] = Math.round(((drawn[l.item_id] || 0) + need) * 1000) / 1000;
    const short = Math.round((drawn[l.item_id] - Number(l.in_stock)) * 1000) / 1000;
    if (short > 0) out[l.key] = short;
  }
  return out;
};

export const toIssuePayload = (f) => ({
  issue_date: f.issue_date,
  issue_type: f.issue_type,
  order_id: takesOrder(f.issue_type) && f.order ? f.order.id : null,
  reason: f.reason.trim() || null,
  notes: f.notes.trim() || null,
  items: used(f).map((l) => ({ item_id: l.item_id, quantity: q(l.quantity).value, wastage_quantity: f.issue_type === "ISSUE" ? w(l.wastage).value || 0 : 0 })),
});
