import { describe, expect, test } from "vitest";
import { invoicePaymentChoices, defaultInvoiceChoice, INVOICE_ONLY } from "./paymentChoices";

const o = (id, orderDate, due, extra = {}) => ({ id, orderDate, due, received: 0, total: 100, status: "DELIVERED", deleted: false, ...extra });

describe("which order an invoice payment is saved on", () => {
  test("orders still owing first (oldest first), then paid ones — so GST due on a paid order can still be recorded", () => {
    const list = [o("paid-old", "2026-09-01", 0), o("owing-new", "2026-09-20", 500), o("owing-old", "2026-09-10", 200), o("paid-new", "2026-09-25", -50)];
    expect(invoicePaymentChoices(list).map((x) => x.id)).toEqual(["owing-old", "owing-new", "paid-old", "paid-new"]);
  });
  test("deleted or cancelled orders are never offered", () => {
    expect(invoicePaymentChoices([o("gone", "2026-09-01", 100, { deleted: true }), o("x", "2026-09-02", 100, { status: "CANCELLED" }), o("ok", "2026-09-03", 0)]).map((x) => x.id)).toEqual(["ok"]);
  });
});

describe("the preselected choice", () => {
  test("the oldest order still owing", () => {
    expect(defaultInvoiceChoice(invoicePaymentChoices([o("a", "2026-09-01", 0), o("b", "2026-09-05", 300)]))).toBe("b");
  });
  test("the invoice itself when every order is paid (the GST is what's left)", () => {
    expect(defaultInvoiceChoice(invoicePaymentChoices([o("a", "2026-09-01", 0)]))).toBe(INVOICE_ONLY);
    expect(defaultInvoiceChoice([])).toBe(INVOICE_ONLY);
  });
});
