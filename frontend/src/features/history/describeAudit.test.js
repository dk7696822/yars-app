import { describe, expect, test } from "vitest";
import { describeAudit, impactText, historyParams, dayOfIST, timeIST } from "./describeAudit";

const row = (o) => ({ id: "a1", entity_id: "e1", old_values: null, new_values: null, metadata: null, created_at: "2026-09-30T06:00:00.000Z", ...o });

describe("describeAudit — payments", () => {
  test("recorded, with the order figures before → after", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: {
      customer_name: "Bombay Saree Centre", order_id: "o1", amount: 5000, payment_type: "PARTIAL",
      before_metrics: { total_amount: 12000, total_received: 2000, outstanding: 10000 },
      after_metrics: { total_amount: 12000, total_received: 7000, outstanding: 5000 } } }));
    expect(d).toMatchObject({ kind: "payment", title: "Payment ₹5,000 recorded", detail: "Bombay Saree Centre", link: "/orders/o1", tone: "good" });
    expect(impactText(d.impact)).toBe("Received ₹2,000 → ₹7,000 · Due ₹10,000 → ₹5,000");
  });
  test("refund and advance say so", () => {
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: { amount: 300, payment_type: "REFUND", order_id: "o1" } })).title).toBe("Refund ₹300 recorded");
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: { amount: 300, payment_type: "ADVANCE", order_id: "o1" } })).title).toBe("Advance ₹300 recorded");
  });
  test("edited shows old → new amount from the saved values", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "UPDATE", old_values: { amount: 400, payment_type: "PARTIAL", order_id: "o1" }, new_values: { amount: 500, payment_type: "PARTIAL", order_id: "o1" }, metadata: { customer_name: "A" } }));
    expect(d).toMatchObject({ title: "Payment edited ₹400 → ₹500", link: "/orders/o1", tone: "info" });
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "UPDATE", old_values: { amount: 400 }, new_values: { amount: 400 } })).title).toBe("Payment edited");
  });
  test("deleted; an invoice-only payment links to the invoice", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "DELETE", metadata: { amount: "250.50", invoice_id: "i1", order_id: null } }));
    expect(d).toMatchObject({ title: "Payment ₹250.5 deleted", link: "/invoices/i1", tone: "critical" });
  });
  test("a deleted payment shows no before → after: the server only estimated it (received − amount)", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "DELETE", metadata: { amount: 50, order_id: "o1",
      before_metrics: { total_received: 0, outstanding: 0 }, after_metrics: { total_received: -50, outstanding: 50 } } }));
    expect(d.impact).toBeNull();
  });
  test("a missing amount is left out, never ₹NaN", () => {
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: {} })).title).toBe("Payment recorded");
  });
  test("overpaid due reads as extra", () => {
    expect(impactText({ received: [100, 600], due: [0, -500] })).toBe("Received ₹100 → ₹600 · Due ₹0 → ₹500 extra");
    expect(impactText(null)).toBe("");
  });
});

describe("describeAudit — orders", () => {
  test("created / status change / edited / deleted", () => {
    expect(describeAudit(row({ entity_type: "ORDER", action: "CREATE", metadata: { customer_name: "B", status: "PENDING" } })))
      .toMatchObject({ kind: "order", title: "Order created", detail: "B", link: "/orders/e1" });
    expect(describeAudit(row({ entity_type: "ORDER", action: "UPDATE", metadata: { previous_status: "PENDING", new_status: "DELIVERED", is_soft_delete: false } })).title)
      .toBe("Order status Pending → Delivered");
    expect(describeAudit(row({ entity_type: "ORDER", action: "UPDATE", metadata: { previous_status: "PENDING", new_status: "PENDING" } })).title).toBe("Order edited");
    expect(describeAudit(row({ entity_type: "ORDER", action: "DELETE", metadata: { is_soft_delete: true, customer_name: "B" } })))
      .toMatchObject({ title: "Order deleted", link: null, tone: "critical" });
  });
});

describe("describeAudit — stock", () => {
  test("purchase order, receipt, issues", () => {
    expect(describeAudit(row({ entity_type: "PURCHASE_ORDER", action: "CREATE", new_values: { po_number: "PO-0001" }, metadata: { supplier_name: "Raj Traders", item_count: 3, total_value: 15000 } })))
      .toMatchObject({ kind: "stock", title: "Purchase order PO-0001 created", detail: "Raj Traders · 3 items · ₹15,000", link: "/purchase-orders/e1" });
    expect(describeAudit(row({ entity_type: "GOODS_RECEIPT", action: "CREATE", new_values: { receipt_number: "GR-0002", purchase_order_id: "p9" }, metadata: { item_count: 1, total_value: 800 } })))
      .toMatchObject({ title: "Material received · GR-0002", detail: "1 item · ₹800", link: "/purchase-orders/p9" });
    expect(describeAudit(row({ entity_type: "STOCK_ISSUE", action: "CREATE", new_values: { issue_number: "SI-0003", issue_type: "WASTAGE", order_id: null }, metadata: { issue_type: "WASTAGE", item_count: 2 } })))
      .toMatchObject({ title: "Wastage recorded · SI-0003", detail: "2 items", link: null });
    expect(describeAudit(row({ entity_type: "STOCK_ISSUE", action: "CREATE", new_values: { issue_number: "SI-0004", issue_type: "ADJUSTMENT_OUT", order_id: "o5" }, metadata: { issue_type: "ADJUSTMENT_OUT", item_count: 1, reason: "Count correction" } })))
      .toMatchObject({ title: "Stock removed (adjustment) · SI-0004", detail: "1 item · Count correction", link: "/orders/o5" });
  });
  test("anything unknown still shows", () => {
    expect(describeAudit(row({ entity_type: "SUPPLIER", action: "ARCHIVE" }))).toMatchObject({ kind: "other", title: "Supplier archive", link: null });
  });
});

describe("filters and times", () => {
  test("type and period → query", () => {
    expect(historyParams({ type: "all", period: "all" }, "2026-09-30")).toEqual({});
    expect(historyParams({ type: "stock", period: "this_month" }, "2026-09-30"))
      .toEqual({ entity_type: "PURCHASE_ORDER,GOODS_RECEIPT,STOCK_ISSUE", from_date: "2026-09-01", to_date: "2026-09-30" });
    expect(historyParams({ type: "payments", period: "last_month" }, "2026-03-10")).toEqual({ entity_type: "PAYMENT", from_date: "2026-02-01", to_date: "2026-02-28" });
  });
  test("India day and time", () => {
    expect(dayOfIST("2026-09-30T19:00:00.000Z")).toBe("2026-10-01");
    expect(timeIST("2026-09-30T09:35:00.000Z")).toBe("3:05 pm");
  });
});
