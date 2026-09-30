import { describe, expect, test } from "vitest";
import { billableOrders, billingPeriod, invoiceTotals, invoiceErrors, toInvoicePayload } from "./invoiceDraft";

const kgOrder = (o) => ({
  id: "o", order_date: "2026-09-10", status: "DELIVERED", invoice_id: null, custom_plate_charge: null, round_off_amount: "0.00",
  plateType: { charge: "0.00" }, orderProductSizes: [{ unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25", productSize: { rate_per_kg: "181.25" } }], ...o,
}); // 2238.4375
const A = kgOrder({ id: "a", order_date: "2026-09-12" });
const B = kgOrder({ id: "b", order_date: "2026-09-02", plateType: { charge: "500.00" }, orderProductSizes: [{ unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00", productSize: { rate_per_kg: "100.00" } }] }); // 1500

describe("invoice draft", () => {
  test("only orders not invoiced and not cancelled, oldest first", () => {
    expect(billableOrders([A, B, kgOrder({ id: "c", invoice_id: "i1" }), kgOrder({ id: "d", status: "CANCELLED" })]).map((o) => o.id)).toEqual(["b", "a"]);
  });
  test("billing period from the ticked orders", () => {
    expect(billingPeriod([A, B])).toEqual({ from: "2026-09-02", to: "2026-09-12" });
    expect(billingPeriod([])).toBeNull();
  });
  test("totals use the server's arithmetic (unrounded order totals, then 2 decimals)", () => {
    expect(invoiceTotals([A, B], false, "18")).toEqual({ subtotal: 3738.44, percent: 0, tax: 0, final: 3738.44 });
    expect(invoiceTotals([A, B], true, "5")).toEqual({ subtotal: 3738.44, percent: 5, tax: 186.92, final: 3925.36 });
  });
  test("step checks", () => {
    expect(invoiceErrors({ customer: null }, 0)).toEqual({ customer: "Choose a customer" });
    expect(invoiceErrors({ customer: { id: "c" }, selected: [], gstOn: true, gst: "abc" }, 1)).toEqual({ orders: "Tick at least one order", gst: "Enter a number" });
    expect(invoiceErrors({ customer: { id: "c" }, selected: ["a"], gstOn: true, gst: "120" }, 1)).toEqual({ gst: "GST can't be more than 100%" });
    expect(invoiceErrors({ dueDate: "2026-02-30" }, 2)).toEqual({ dueDate: "Choose the payment due date" });
  });
  test("payload", () => {
    expect(toInvoicePayload({ customer: { id: "c1" }, gstOn: true, gst: "18", dueDate: "2026-10-30" }, [B, A])).toEqual({
      customer_id: "c1", order_ids: ["b", "a"], billing_period_start: "2026-09-02", billing_period_end: "2026-09-12", payment_due_date: "2026-10-30", tax_percent: 18,
    });
  });
});
