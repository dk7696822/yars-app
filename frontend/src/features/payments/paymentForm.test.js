import { describe, expect, test } from "vitest";
import { validatePayment, initialPaymentForm, toPaymentRow } from "./paymentForm";

const form = (o) => ({ amount: "", method: "UPI", date: "2026-09-30", reference: "", notes: "", type: "PARTIAL", ...o });

describe("validatePayment", () => {
  test("the whole due is a final payment; less is a part payment", () => {
    expect(validatePayment({ mode: "payment", form: form({ amount: "1000" }), due: 1000, received: 0 }).payload)
      .toEqual({ amount: 1000, payment_type: "FINAL", payment_date: "2026-09-30", payment_method: "UPI", reference_number: null, notes: null });
    expect(validatePayment({ mode: "payment", form: form({ amount: "400" }), due: 1000, received: 0 }).payload.payment_type).toBe("PARTIAL");
  });
  test("more than the due is flagged (the sheet asks before saving)", () => {
    const r = validatePayment({ mode: "payment", form: form({ amount: "1,200" }), due: 1000, received: 0 });
    expect([r.overpay, r.payload.payment_type]).toEqual([200, "FINAL"]);
  });
  test("amount problems are shown, nothing is sent", () => {
    expect(validatePayment({ mode: "payment", form: form(), due: 1000, received: 0 })).toEqual({ errors: { amount: "Enter the amount" }, overpay: 0, payload: null });
    expect(validatePayment({ mode: "payment", form: form({ amount: "12.345" }), due: 1000, received: 0 }).errors.amount).toBe("Use at most 2 decimals");
  });
  test("a refund can't exceed what was received", () => {
    expect(validatePayment({ mode: "refund", form: form({ amount: "600.01" }), due: 400, received: 600 }).errors.amount).toBe("A refund can't be more than received (₹600)");
    expect(validatePayment({ mode: "refund", form: form({ amount: "600" }), due: 400, received: 600 }).payload.payment_type).toBe("REFUND");
  });
  test("editing a payment into a refund is capped by what the other payments received", () => {
    expect(validatePayment({ mode: "edit", form: form({ amount: "700", type: "REFUND" }), due: 400, received: 600 }).errors.amount).toBe("A refund can't be more than received (₹600)");
    expect(validatePayment({ mode: "edit", form: form({ amount: "600", type: "REFUND" }), due: 400, received: 600 }).payload.payment_type).toBe("REFUND");
  });
  test("advance and edit keep their type; reference and note are trimmed", () => {
    expect(validatePayment({ mode: "advance", form: form({ amount: "500" }), due: 1000, received: 0 }).payload.payment_type).toBe("ADVANCE");
    const edit = validatePayment({ mode: "edit", form: form({ amount: "500", type: "FINAL", reference: " UTR9 ", notes: "  " }), due: 1000, received: 0 });
    expect([edit.payload.payment_type, edit.payload.reference_number, edit.payload.notes]).toEqual(["FINAL", "UTR9", null]);
  });
});

describe("rows and defaults", () => {
  test("API payment → row", () => {
    expect(toPaymentRow({ id: "p1", amount: "250.50", payment_type: "REFUND", payment_method: "UPI", payment_date: "2026-09-02", reference_number: null, notes: "" }))
      .toEqual({ id: "p1", amount: 250.5, type: "REFUND", method: "UPI", date: "2026-09-02", reference: null, notes: null });
  });
  test("editing starts from the saved values", () => {
    expect(initialPaymentForm({ amount: 250.5, type: "FINAL", method: "BANK_TRANSFER", date: "2026-09-02", reference: "R1", notes: null }))
      .toEqual({ amount: "250.5", type: "FINAL", method: "BANK_TRANSFER", date: "2026-09-02", reference: "R1", notes: "" });
  });
});
