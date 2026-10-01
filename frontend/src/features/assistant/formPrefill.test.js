import { describe, expect, test } from "vitest";
import { orderDraftFromAction, customerFormFromAction, paymentFromAction } from "./formPrefill";
import { toPayload } from "../orders/form/draft";
import { toCustomerPayload } from "../customers/customerForm";
import { validatePayment } from "../payments/paymentForm";

const orderAction = {
  name: "create_order",
  context: { customer: { id: "c1", name: "Bombay Saree Centre", phone: "9876500003" } },
  payload: {
    customer_id: "c1", plate_type_id: "p1", order_date: "2026-10-01", status: "PENDING", round_off_amount: 0,
    advance_received: 600, custom_plate_charge: null,
    product_sizes: [
      { product_size_id: "s1", unit: "KG", quantity_kg: 20, rate_per_kg: 180 },
      { product_size_id: "s2", unit: "PIECES", quantity_pieces: 4000, price_amount: 375, price_pieces_count: 1000 },
    ],
  },
};

describe("order card → order form", () => {
  test("fills customer, date, plate, advance and lines as typed text", () => {
    const d = orderDraftFromAction(orderAction);
    expect(d).toMatchObject({ customer: { id: "c1", name: "Bombay Saree Centre" }, orderDate: "2026-10-01", plateTypeId: "p1", advance: "600", customPlateCharge: "" });
    expect(d.lines.map((l) => [l.unit, l.quantity_kg || l.quantity_pieces])).toEqual([["KG", "20"], ["PIECES", "4000"]]);
  });

  test("saving it unchanged sends exactly what the card showed", () => {
    expect(toPayload(orderDraftFromAction(orderAction), { isEdit: false })).toEqual(orderAction.payload);
  });

  test("a card of another kind gives an empty form", () => {
    expect(orderDraftFromAction({ name: "create_customer", payload: { name: "X" } }).lines).toHaveLength(1);
  });
});

describe("customer card → customer form", () => {
  test("saving it unchanged sends the card's fields", () => {
    const action = { name: "create_customer", payload: { name: "Ganesh Textiles", phone: "9845012345", city: "Hubli" } };
    expect(toCustomerPayload(customerFormFromAction(action))).toEqual({ name: "Ganesh Textiles", phone: "9845012345", city: "Hubli", email: "", address: "", gstin: "" });
  });
});

describe("payment card → payment sheet", () => {
  test("a payment opens the payment sheet with the card's values", () => {
    const action = { name: "record_payment", context: { refund: false }, payload: { order_id: "o1", amount: 2000, payment_type: "PARTIAL", payment_method: "UPI", payment_date: "2026-10-01", reference_number: null, notes: null } };
    const { mode, prefill } = paymentFromAction(action);
    expect(mode).toBe("payment");
    const { payload } = validatePayment({ mode, form: { amount: String(prefill.amount), type: "PARTIAL", method: prefill.method, date: prefill.date, reference: "", notes: "" }, due: 2300, received: 1000 });
    expect(payload).toEqual({ amount: 2000, payment_type: "PARTIAL", payment_method: "UPI", payment_date: "2026-10-01", reference_number: null, notes: null });
  });

  test("a refund opens the refund sheet", () => {
    expect(paymentFromAction({ name: "record_payment", context: { refund: true }, payload: { amount: 500, payment_method: "CASH", payment_date: "2026-10-01" } }).mode).toBe("refund");
  });
});
