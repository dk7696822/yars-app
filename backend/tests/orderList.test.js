"use strict";

const db = require("../src/models");
const { buildOrderList, ListError } = require("../src/services/lists/orderList");
const { listOrders, getOrderById } = require("../src/controllers/orderController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const TODAY = "2026-09-30";
const kg = (size, qty, rate) => ({ unit: "KG", quantity_kg: String(qty), rate_per_kg: String(rate), productSize: { rate_per_kg: String(rate), size_label: size } });
const pcs = (size, n) => ({ unit: "PIECES", quantity_pieces: n, price_amount: "1.0000", price_pieces_count: 1, productSize: { size_label: size, rate_per_kg: null } });
const order = (o) => ({
  id: "x", customer_id: "c1", customerName: "Alpha Bags", customerPhone: null, order_date: "2026-09-20",
  created_at: "2026-09-20T10:00:00Z", status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00",
  advance_received: "0.00", invoice_id: null, plateType: { charge: "0.00" }, payments: [],
  orderProductSizes: [kg("14x18", 10, 100)], ...o,
});
const pay = (amount, payment_type = "PARTIAL") => ({ amount: String(amount), payment_type, payment_date: "2026-09-21" });

const ORDERS = [
  order({ id: "a", order_date: "2026-09-28", payments: [pay(400)] }),                                            // 1000, due 600
  order({ id: "b", order_date: "2026-09-28", created_at: "2026-09-28T12:00:00Z", customer_id: "c2", customerName: "Beta Stores",
          orderProductSizes: [pcs("16x20", 500)], payments: [pay(500, "FINAL")] }),                               // 500, paid
  order({ id: "c", order_date: "2026-08-15", status: "PENDING", payments: [pay(1200, "FINAL")] }),               // 1000, 200 extra
  order({ id: "d", order_date: "2026-09-02", status: "CANCELLED" }),                                             // cancelled
  order({ id: "e", order_date: "2026-07-01", status: "IN_PROGRESS" }),                                           // due 1000
];
const ids = (out) => out.rows.map((r) => r.id);

describe("buildOrderList", () => {
  test("newest first; same day by time created", () => {
    expect(ids(buildOrderList(ORDERS, {}, TODAY))).toEqual(["b", "a", "d", "c", "e"]);
  });

  test("summary leaves out cancelled orders and never nets extra received against dues", () => {
    expect(buildOrderList(ORDERS, {}, TODAY).summary).toEqual({ count: 4, total: 3500, due: 1600, cancelled: 1, matched: 5 });
  });

  test("row shape", () => {
    const rows = buildOrderList(ORDERS, {}, TODAY).rows;
    expect(rows[1]).toEqual({
      id: "a", orderDate: "2026-09-28", createdAt: "2026-09-20T10:00:00Z", status: "DELIVERED", cancelled: false,
      customer: { id: "c1", name: "Alpha Bags", phone: null }, items: [{ size: "14x18", unit: "KG", quantity: 10 }],
      invoiceId: null, total: 1000, received: 400, due: 600,
    });
    expect(rows[0].items).toEqual([{ size: "16x20", unit: "PIECES", quantity: 500 }]);
    expect(rows.find((r) => r.id === "c").due).toBe(-200);
    expect(rows.find((r) => r.id === "d").cancelled).toBe(true);
  });

  test("chips", () => {
    expect(ids(buildOrderList(ORDERS, { chip: "due" }, TODAY))).toEqual(["a", "e"]);
    expect(ids(buildOrderList(ORDERS, { chip: "in_progress" }, TODAY))).toEqual(["c", "e"]);
    const month = buildOrderList(ORDERS, { chip: "this_month" }, TODAY);
    expect(ids(month)).toEqual(["b", "a", "d"]);
    expect(month.summary.count).toBe(2);
  });

  test("search matches customer name or size, any case", () => {
    expect(ids(buildOrderList(ORDERS, { search: "beta" }, TODAY))).toEqual(["b"]);
    expect(ids(buildOrderList(ORDERS, { search: " 14X18 " }, TODAY))).toEqual(["a", "d", "c", "e"]);
  });

  test("pages of `limit`", () => {
    const p1 = buildOrderList(ORDERS, { limit: "2" }, TODAY);
    expect([ids(p1), p1.page, p1.hasMore]).toEqual([["b", "a"], 1, true]);
    const p3 = buildOrderList(ORDERS, { limit: "2", page: "3" }, TODAY);
    expect([ids(p3), p3.hasMore]).toEqual([["e"], false]);
  });

  test("a date range combines with the Due chip", () => {
    expect(ids(buildOrderList(ORDERS, { chip: "due", from: "2026-09-01", to: "2026-09-30" }, TODAY))).toEqual(["a"]);
    expect(ids(buildOrderList(ORDERS, { from: "2026-08-01", to: "2026-08-31" }, TODAY))).toEqual(["c"]);
  });

  test("a malformed or reversed range is refused with a clear message", () => {
    expect(() => buildOrderList(ORDERS, { from: "2026-13-01", to: "2026-08-31" }, TODAY)).toThrow("Dates must look like 2026-08-01");
    expect(() => buildOrderList(ORDERS, { from: "2026-08-31", to: "2026-08-01" }, TODAY)).toThrow("From date must be on or before To date");
  });

  test("unknown chip is refused", () => {
    expect(() => buildOrderList(ORDERS, { chip: "late" }, TODAY)).toThrow(ListError);
  });
});

describe("GET /orders/list", () => {
  const call = async (fn, req) => {
    const res = mockRes();
    await fn({ query: {}, params: {}, body: {}, ...req }, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };

  test("totals match the order page, archived sizes included", async () => {
    const customer = await createCustomer("Gamma");
    const plate = await createPlateType("250.00");
    const size = await createSize({ rate_per_kg: "120.00" });
    const o = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "12.25", rate_per_kg: "120.00" }] });
    await db.Payment.create({ order_id: o.id, customer_id: customer.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
    await size.update({ is_archived: true });

    const list = await call(listOrders, { query: {} });
    expect(list.status).toBe(200);
    const row = list.body.data.rows[0];
    const detail = (await call(getOrderById, { params: { id: o.id } })).body.data;
    expect(row.total).toBe(detail.total_amount);
    expect(row.due).toBe(detail.payment_summary.remaining_balance);
    expect(row.total).toBe(1720);
  });

  test("the order page's money block equals its list row", async () => {
    const customer = await createCustomer("Delta");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "181.25" });
    const o = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25" }] }); // 2238.4375
    await db.Payment.create({ order_id: o.id, customer_id: customer.id, amount: "1000.10", payment_type: "PARTIAL", payment_date: "2026-09-02" });
    const row = (await call(listOrders, { query: {} })).body.data.rows[0];
    const detail = (await call(getOrderById, { params: { id: o.id } })).body.data;
    expect(detail.money).toEqual({ total: row.total, received: row.received, due: row.due });
    expect(detail.money).toEqual({ total: 2238.44, received: 1000.1, due: 1238.34 });
  });

  test("unknown chip → 400", async () => {
    expect((await call(listOrders, { query: { chip: "late" } })).status).toBe(400);
  });
});
