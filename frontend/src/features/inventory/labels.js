export const QTY_DP = 3; // quantities are DECIMAL(12,3)

export const UNITS = [
  { value: "KG", label: "Kg" },
  { value: "PCS", label: "Pcs" },
  { value: "METRE", label: "Metre" },
  { value: "ROLL", label: "Roll" },
  { value: "LITRE", label: "Litre" },
];
export const UNIT_LABEL = { KG: ["kg", "kg"], PCS: ["pc", "pcs"], METRE: ["m", "m"], ROLL: ["roll", "rolls"], LITRE: ["L", "L"] };

const qfmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: QTY_DP });
export const qtyText = (n) => qfmt.format(Number(n) || 0);
export const qty = (n, unit) => {
  const words = UNIT_LABEL[unit];
  const v = Number(n) || 0;
  return `${qtyText(v)} ${words ? words[v === 1 ? 0 : 1] : String(unit || "").toLowerCase()}`.trim();
};

export const attributesText = (item) => (item?.attributes || []).map((a) => `${a.attribute_name} ${a.value}`).join(" · ");

export const PO_STATUS = {
  PENDING: { label: "Ordered", tone: "info" },
  PARTIALLY_RECEIVED: { label: "Part received", tone: "warn" },
  RECEIVED: { label: "Received", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export const ISSUE_TYPES = {
  ISSUE: { label: "Issue", tone: "info", hint: "Material used for production" },
  WASTAGE: { label: "Wastage", tone: "critical", hint: "Material spoiled or thrown away" },
  ADJUSTMENT_IN: { label: "Add stock", tone: "good", hint: "Stock count found more than the app shows" },
  ADJUSTMENT_OUT: { label: "Remove stock", tone: "warn", hint: "Stock count found less than the app shows" },
};
export const ISSUE_TYPE_OPTIONS = Object.entries(ISSUE_TYPES).map(([value, t]) => ({ value, label: t.label }));

export const MOVEMENT = {
  RECEIPT: { label: "Received", sign: "+" },
  ISSUE: { label: "Issued", sign: "−" },
  WASTAGE: { label: "Wastage", sign: "−" },
  ADJUSTMENT_IN: { label: "Added (count)", sign: "+" },
  ADJUSTMENT_OUT: { label: "Removed (count)", sign: "−" },
};

/** The server allows cancel/delete only while nothing has been received, and receiving only on open orders. */
export const poActions = (po) => {
  const received = (po.items || []).some((l) => Number(l.quantity_received) > 0);
  const open = po.status === "PENDING" || po.status === "PARTIALLY_RECEIVED";
  return { canReceive: open, canCancel: po.status !== "CANCELLED" && !received, canDelete: !received };
};
