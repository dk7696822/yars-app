import { newDraft, newLine } from "../orders/form/draft";
import { emptyCustomer } from "../customers/customerForm";

const text = (v) => (v === null || v === undefined ? "" : String(v));

/** An order card → the order form's draft, as if the person had typed it. Any other card → an empty form. */
export const orderDraftFromAction = (action) => {
  if (action?.name !== "create_order") return newDraft();
  const { payload, context } = action;
  const c = context?.customer;
  return {
    ...newDraft(c ? { id: c.id, name: c.name, phone: c.phone || null } : null),
    orderDate: payload.order_date,
    plateTypeId: payload.plate_type_id,
    customPlateCharge: text(payload.custom_plate_charge),
    roundOff: payload.round_off_amount ? text(payload.round_off_amount) : "",
    advance: payload.advance_received ? text(payload.advance_received) : "",
    status: payload.status || "PENDING",
    lines: payload.product_sizes.map((l) =>
      l.unit === "PIECES"
        ? { ...newLine(), product_size_id: l.product_size_id, unit: "PIECES", quantity_pieces: text(l.quantity_pieces), price_amount: text(l.price_amount), price_pieces_count: text(l.price_pieces_count) }
        : { ...newLine(), product_size_id: l.product_size_id, unit: "KG", quantity_kg: text(l.quantity_kg), rate_per_kg: text(l.rate_per_kg) }
    ),
  };
};

/** A customer card → the customer form. */
export const customerFormFromAction = (action) => {
  if (action?.name !== "create_customer") return emptyCustomer();
  const p = action.payload;
  return { ...emptyCustomer(), ...Object.fromEntries(["name", "phone", "city", "email", "address", "gstin"].map((k) => [k, text(p[k])])) };
};

/** A payment card → which sheet to open and its starting values. */
export const paymentFromAction = (action) => {
  const p = action.payload;
  return {
    mode: action.context?.refund ? "refund" : "payment",
    prefill: { amount: p.amount, method: p.payment_method || "CASH", date: p.payment_date, reference: p.reference_number || null, notes: p.notes || null },
  };
};
