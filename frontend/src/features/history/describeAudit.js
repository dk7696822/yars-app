import { inr } from "../../utils/dashboardFormat";
import { addDays, todayIST } from "../../utils/istDate";
import { ORDER_STATUS } from "../../utils/statusMeta";
import { ASSISTANT_NAME } from "../../app/assistant";

export const HISTORY_TYPES = [
  { value: "all", label: "All" },
  { value: "payments", label: "Payments" },
  { value: "orders", label: "Orders" },
  { value: "stock", label: "Stock" },
];
export const HISTORY_PERIODS = [
  { value: "all", label: "Any time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];
const TYPE_PARAM = { payments: "PAYMENT", orders: "ORDER", stock: "PURCHASE_ORDER,GOODS_RECEIPT,STOCK_ISSUE" };

const monthStart = (d) => `${d.slice(0, 7)}-01`;

export const historyParams = ({ type = "all", period = "all" }, today) => {
  const p = {};
  if (TYPE_PARAM[type]) p.entity_type = TYPE_PARAM[type];
  if (period === "this_month") Object.assign(p, { from_date: monthStart(today), to_date: today });
  if (period === "last_month") {
    const last = addDays(monthStart(today), -1);
    Object.assign(p, { from_date: monthStart(last), to_date: last });
  }
  return p;
};

export const dayOfIST = (ts) => todayIST(new Date(ts));
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
export const timeIST = (ts) => timeFmt.format(new Date(ts)).toLowerCase().replace(/\s+/g, " ");

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const money = (v) => (num(v) === null ? null : inr(num(v)));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const join = (...parts) => parts.filter(Boolean).join(" · ");
const statusLabel = (s) => ORDER_STATUS[s]?.label || s;
const PAYMENT_WORD = { REFUND: "Refund", ADVANCE: "Advance" };
const ISSUE_TITLE = { ISSUE: "Stock issued", WASTAGE: "Wastage recorded", ADJUSTMENT_IN: "Stock added (adjustment)", ADJUSTMENT_OUT: "Stock removed (adjustment)" };
const ENTITY_WORD = { PAYMENT: "Payment", ORDER: "Order", PURCHASE_ORDER: "Purchase order", GOODS_RECEIPT: "Goods receipt", STOCK_ISSUE: "Stock issue" };
const titleCase = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const impactOf = (m) => {
  const b = m?.before_metrics;
  const a = m?.after_metrics;
  if (!b || !a) return null;
  const vals = [b.total_received, a.total_received, b.outstanding, a.outstanding].map(num);
  if (vals.some((v) => v === null)) return null;
  return { received: [vals[0], vals[1]], due: [vals[2], vals[3]] };
};

const dueWord = (v) => (v < 0 ? `${inr(-v)} extra` : inr(v));

/** The order's figures as they were when it happened: "Received ₹a → ₹b · Due ₹c → ₹d". */
export const impactText = (impact) =>
  impact ? `Received ${inr(impact.received[0])} → ${inr(impact.received[1])} · Due ${dueWord(impact.due[0])} → ${dueWord(impact.due[1])}` : "";

const describePayment = (r) => {
  const m = r.metadata || {};
  const v = r.new_values || r.old_values || {};
  const word = PAYMENT_WORD[m.payment_type || v.payment_type] || "Payment";
  const orderId = m.order_id ?? v.order_id;
  const invoiceId = m.invoice_id ?? v.invoice_id;
  const link = orderId ? `/orders/${orderId}` : invoiceId ? `/invoices/${invoiceId}` : null;
  // A delete's "after" is estimated on the server as received − amount, not recalculated, so it isn't shown.
  const base = { kind: "payment", detail: m.customer_name || "", link, impact: r.action === "DELETE" ? null : impactOf(m) };
  if (r.action === "UPDATE") {
    const before = money(r.old_values?.amount);
    const after = money(r.new_values?.amount);
    return { ...base, tone: "info", title: before && after && before !== after ? `${word} edited ${before} → ${after}` : `${word} edited` };
  }
  const amount = money(m.amount ?? v.amount);
  const verb = r.action === "DELETE" ? "deleted" : "recorded";
  return { ...base, tone: r.action === "DELETE" ? "critical" : "good", title: amount ? `${word} ${amount} ${verb}` : `${word} ${verb}` };
};

const describeOrder = (r) => {
  const m = r.metadata || {};
  const base = { kind: "order", detail: m.customer_name || "", link: `/orders/${r.entity_id}`, impact: null, tone: "info" };
  if (r.action === "DELETE" || m.is_soft_delete) return { ...base, title: "Order deleted", link: null, tone: "critical" };
  if (r.action === "CREATE") return { ...base, title: "Order created", tone: "good" };
  if (m.previous_status && m.new_status && m.previous_status !== m.new_status)
    return { ...base, title: `Order status ${statusLabel(m.previous_status)} → ${statusLabel(m.new_status)}` };
  return { ...base, title: "Order edited" };
};

const counts = (m) => join(num(m.item_count) !== null ? plural(num(m.item_count), "item") : "", money(m.total_value));

const describeStock = (r) => {
  const m = r.metadata || {};
  const v = r.new_values || {};
  const base = { kind: "stock", impact: null, tone: "info" };
  if (r.entity_type === "PURCHASE_ORDER")
    return { ...base, title: `Purchase order ${v.po_number ? `${v.po_number} ` : ""}${r.action === "CREATE" ? "created" : String(r.action || "").toLowerCase()}`, detail: join(m.supplier_name, counts(m)), link: `/purchase-orders/${r.entity_id}` };
  if (r.entity_type === "GOODS_RECEIPT")
    return { ...base, tone: "good", title: join("Material received", v.receipt_number), detail: counts(m), link: v.purchase_order_id ? `/purchase-orders/${v.purchase_order_id}` : null };
  const type = m.issue_type || v.issue_type;
  return { ...base, title: join(ISSUE_TITLE[type] || "Stock issue", v.issue_number), detail: join(counts(m), m.reason), link: v.order_id ? `/orders/${v.order_id}` : null };
};

/** One audit row → one plain sentence. Unknown shapes still show ("<Entity> <action>"). */
const describeEntry = (r) => {
  if (r.entity_type === "PAYMENT") return describePayment(r);
  if (r.entity_type === "ORDER") return describeOrder(r);
  if (["PURCHASE_ORDER", "GOODS_RECEIPT", "STOCK_ISSUE"].includes(r.entity_type)) return describeStock(r);
  return { kind: "other", title: `${ENTITY_WORD[r.entity_type] || titleCase(r.entity_type)} ${String(r.action || "").toLowerCase()}`.trim(), detail: "", link: null, impact: null, tone: "muted" };
};

/** One History entry; a change confirmed on an assistant card says so. */
export const describeAudit = (r) => {
  const d = describeEntry(r);
  return r.metadata?.source === "assistant" ? { ...d, via: ASSISTANT_NAME } : d;
};
