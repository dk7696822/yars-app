"use strict";

const fs = require("fs");
const path = require("path");
const db = require("../src/models");
const { overview, period, trends } = require("../src/controllers/dashboardController");
const { getAllOrders } = require("../src/controllers/orderController");
const { todayIST, addDays, monthStart } = require("../src/services/dashboard/dateRanges");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req = {}) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

const canonicalPending = () => {
  const md = fs.readFileSync(path.join(__dirname, "../knowledge/money-sql.md"), "utf8");
  return md.match(/<!-- canonical:pending -->([\s\S]*?)<!-- \/canonical:pending -->/)[1].trim();
};

describe("dashboard endpoints", () => {
  const today = todayIST();
  let alpha;
  let beta;

  beforeEach(async () => {
    alpha = await createCustomer("Alpha");
    beta = await createCustomer("Beta");
    const plate = await createPlateType("500.00");
    const size = await createSize({ rate_per_kg: "150.00" });
    const line = (kg) => ({ product_size_id: size.id, unit: "KG", quantity_kg: String(kg), rate_per_kg: "150.00" });

    const old = await createOrderWithLines({ customer: alpha, plateType: plate, order_date: addDays(today, -120), lines: [line(10)] }); // 2000
    const recent = await createOrderWithLines({ customer: alpha, plateType: plate, order_date: monthStart(today), lines: [line(4)] }); // 1100
    const paid = await createOrderWithLines({ customer: beta, plateType: plate, order_date: addDays(today, -40), lines: [line(2)] }); // 800
    await db.Payment.create({ order_id: old.id, customer_id: alpha.id, amount: "500.00", payment_type: "PARTIAL", payment_date: today });
    await db.Payment.create({ order_id: paid.id, customer_id: beta.id, amount: "800.00", payment_type: "FINAL", payment_date: addDays(today, -39) });
    void recent;

    const gone = await createOrderWithLines({ customer: beta, plateType: plate, order_date: today, lines: [line(1)] });
    await db.Payment.create({ order_id: gone.id, customer_id: beta.id, amount: "650.00", payment_type: "FINAL", payment_date: today });
    await gone.update({ is_archived: true });
  });

  test("overview reconciles with the Orders screen and the guides' pending query", async () => {
    const { status, body } = await call(overview);
    expect(status).toBe(200);
    const o = body.data;
    expect(o.checks.ok).toBe(true);

    const orders = (await call(getAllOrders)).body.data;
    const positive = orders.reduce((s, x) => s + Math.max(0, x.payment_summary.remaining_balance), 0);
    expect(o.toCollect).toBeCloseTo(positive, 2);
    expect(o.toCollect).toBe(1500 + 1100);

    const [rows] = await db.sequelize.query(canonicalPending());
    const sqlByName = Object.fromEntries(rows.map((r) => [r.name, Number(r.pending)]));
    for (const c of o.customers) expect(sqlByName[c.name]).toBeCloseTo(c.amount, 2);

    expect(o.customers[0]).toMatchObject({ name: "Alpha", orders: 2, oldestDays: 120 });
    expect(o.aging.find((b) => b.band === "90+").amount).toBe(1500);
  });

  test("period: this month counts the payment received today on an old order; deleted-order payment reported", async () => {
    const { status, body } = await call(period, { query: { preset: "this_month" } });
    expect(status).toBe(200);
    const p = body.data;
    expect(p.range).toEqual({ from: monthStart(today), to: today, label: "This month" });
    expect(p.collected.value).toBe(500 + (addDays(today, -39) >= monthStart(today) ? 800 : 0));
    expect(p.excluded.deletedOrderPayments).toEqual({ count: 1, amount: 650 });
    expect(p.sales.value).toBeGreaterThanOrEqual(1100);
  });

  test("period: bad input is a 400 with a clear message", async () => {
    const { status, body } = await call(period, { query: { preset: "custom", from: "2026-09-20", to: "2026-09-01" } });
    expect(status).toBe(400);
    expect(body.message).toMatch(/on or before/);
  });

  test("trends: six months ending this month", async () => {
    const { body } = await call(trends);
    expect(body.data.months).toHaveLength(6);
    expect(body.data.months[5].month).toBe(today.slice(0, 7));
  });

  test("a future-dated order still reconciles in All time; unlinked payments are disclosed", async () => {
    const c = await createCustomer("Delta");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, 2), lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "1.00", rate_per_kg: "100.00" }] });
    await db.Payment.create({ order_id: null, customer_id: c.id, amount: "40.00", payment_type: "PARTIAL", payment_date: today });
    const o = (await call(overview)).body.data;
    const p = (await call(period, { query: { preset: "all" } })).body.data;
    expect(Math.round((p.sales.value - p.collected.value) * 100)).toBe(Math.round((o.toCollect - o.credit) * 100));
    expect(p.excluded.unlinkedPayments).toEqual({ count: 1, amount: 40 });
  });

  test("all-time period matches overview (sales − collected = to collect − credit)", async () => {
    const o = (await call(overview)).body.data;
    const p = (await call(period, { query: { preset: "all" } })).body.data;
    expect(Math.round((p.sales.value - p.collected.value) * 100)).toBe(Math.round((o.toCollect - o.credit) * 100));
  });
});
