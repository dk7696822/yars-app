import { emptyLine, lineFromOrderItem, previewLine, toPayloadLine } from "../../../utils/orderFormLines";
import { parseNumber } from "../../../utils/numberInput";
import { isISODate, todayIST } from "../../../utils/istDate";

export const STEPS = ["Customer & date", "Items", "Plate & review"];

const text = (v) => (v === null || v === undefined ? "" : String(v));
const decimalText = (v) => (v === null || v === undefined || Number(v) === 0 ? "" : String(parseFloat(v)));
const lineKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Math.random()));

/** Form lines hold exactly what was typed (text); numbers are parsed when previewing or saving. */
export const newLine = () => ({ ...emptyLine(), key: lineKey(), quantity_kg: "", rate_per_kg: "" });

export const newDraft = (customer = null) => ({
  customer, orderDate: todayIST(), lines: [newLine()], plateTypeId: "", customPlateCharge: "", roundOff: "", advance: "", status: "PENDING",
});

export const draftFromOrder = (order) => ({
  customer: { id: order.customer_id, name: order.customer?.name || "Unknown customer", phone: order.customer?.metadata?.phone || null },
  orderDate: order.order_date,
  lines: (order.orderProductSizes || []).map((item) => {
    const l = lineFromOrderItem(item);
    return {
      ...l, key: item.id,
      quantity_kg: text(l.quantity_kg), rate_per_kg: text(l.rate_per_kg), quantity_pieces: text(l.quantity_pieces),
      price_amount: text(l.price_amount), price_pieces_count: text(l.price_pieces_count),
      weight_kg: text(l.weight_kg), weight_pieces_count: text(l.weight_pieces_count),
    };
  }),
  plateTypeId: order.plate_type_id,
  customPlateCharge: decimalText(order.custom_plate_charge),
  roundOff: decimalText(order.round_off_amount),
  advance: "",
  status: order.status,
});

const num = (t, opts) => parseNumber(t, opts).value;
const missing = (r, message) => r.error || (r.value === null ? message : null);

export const lineErrors = (line) => {
  const e = {};
  if (!line.product_size_id) e.size = "Choose a size";
  if (line.unit === "PIECES") {
    const q = missing(parseNumber(line.quantity_pieces, { whole: true }), "Enter the number of pieces");
    if (q) e.quantity = q;
    if (num(line.price_pieces_count, { whole: true }) === null || num(line.price_amount, { dp: 4 }) === null) e.price = "Enter the price, like 1000 pcs cost ₹375";
    if (text(line.weight_kg) !== "" || text(line.weight_pieces_count) !== "") {
      if (num(line.weight_pieces_count, { whole: true }) === null || num(line.weight_kg, { dp: 3 }) === null) e.weight = "Enter both the pieces and their weight in kg, or clear both";
    }
  } else {
    const q = missing(parseNumber(line.quantity_kg), "Enter the kg");
    if (q) e.quantity = q;
    const r = missing(parseNumber(line.rate_per_kg), "Enter the rate per kg");
    if (r) e.rate = r;
  }
  return e;
};

export const stepErrors = (draft, step) => {
  if (step === 0) {
    const e = {};
    if (!draft.customer) e.customer = "Choose a customer";
    if (!isISODate(draft.orderDate)) e.orderDate = "Choose the order date";
    return e;
  }
  if (step === 1) {
    const lines = draft.lines.map(lineErrors);
    return lines.some((l) => Object.keys(l).length) ? { lines } : {};
  }
  const e = {};
  if (!draft.plateTypeId) e.plate = "Choose a plate type";
  const custom = parseNumber(draft.customPlateCharge);
  if (custom.error) e.customPlateCharge = custom.error;
  const roundOff = parseNumber(draft.roundOff, { signed: true, allowZero: true });
  if (roundOff.error) e.roundOff = roundOff.error;
  const advance = parseNumber(draft.advance, { allowZero: true });
  if (advance.error) e.advance = advance.error;
  return e;
};

/** Typed text → the numbers orderMath and the API expect. Weight is "" when not given. */
export const numericLine = (line) =>
  line.unit === "PIECES"
    ? {
        ...line,
        quantity_pieces: num(line.quantity_pieces, { whole: true }),
        price_amount: num(line.price_amount, { dp: 4 }),
        price_pieces_count: num(line.price_pieces_count, { whole: true }),
        weight_kg: num(line.weight_kg, { dp: 3 }) ?? "",
        weight_pieces_count: num(line.weight_pieces_count, { whole: true }) ?? "",
      }
    : { ...line, quantity_kg: num(line.quantity_kg), rate_per_kg: num(line.rate_per_kg) };

/** Live amount + kg for one line; null while it is incomplete or has a typo. */
export const linePreview = (line, size) => {
  const e = lineErrors(line);
  if (e.size || e.quantity || e.price || e.rate) return { amount: null, kg: null };
  const numeric = numericLine(e.weight ? { ...line, weight_kg: "", weight_pieces_count: "" } : line);
  return previewLine(numeric, size);
};

export const draftTotals = (draft, sizes, plates) => {
  const products = draft.lines.reduce((sum, line) => {
    const { amount } = linePreview(line, sizes.find((s) => s.id === line.product_size_id));
    return amount === null ? sum : sum + amount;
  }, 0);
  const plate = plates.find((p) => p.id === draft.plateTypeId);
  const plateCharge = num(draft.customPlateCharge) ?? (plate ? parseFloat(plate.charge) : 0);
  const roundOff = num(draft.roundOff, { signed: true, allowZero: true }) ?? 0;
  return { products, plateCharge, roundOff, total: products + plateCharge - roundOff };
};

export const toPayload = (draft, { isEdit }) => ({
  customer_id: draft.customer.id,
  order_date: draft.orderDate,
  plate_type_id: draft.plateTypeId,
  status: draft.status,
  custom_plate_charge: num(draft.customPlateCharge), // null → the plate type's charge
  round_off_amount: num(draft.roundOff, { signed: true, allowZero: true }) ?? 0,
  product_sizes: draft.lines.map((line) => toPayloadLine(numericLine(line))),
  // The advance is only ever set when the order is created.
  ...(isEdit ? {} : { advance_received: num(draft.advance, { allowZero: true }) ?? 0 }),
});
