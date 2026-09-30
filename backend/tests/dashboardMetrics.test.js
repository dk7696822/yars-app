"use strict";

const m = require("../src/services/dashboard/metrics");

const TODAY = "2026-09-30";
const kgLine = (kg, rate) => ({ unit: "KG", quantity_kg: String(kg), rate_per_kg: String(rate), productSize: { rate_per_kg: String(rate), size_label: "14 x 18" } });
const order = (o) => ({
  customer_id: "c1", customerName: "Alpha", customerPhone: "09876543210", created_at: new Date("2026-01-01T00:00:00Z"),
  status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00", advance_received: "0.00",
  plateType: { charge: "0.00" }, payments: [], orderProductSizes: [kgLine(10, 100)], ...o,
});
const pay = (amount, payment_date, payment_type = "PARTIAL") => ({ amount: String(amount), payment_date, payment_type });
const ledger = (orders, extra = {}) => ({ orders, deletedOrderPayments: [], expenses: [], earliest: "2026-01-01", ...extra });

describe("computeOverview", () => {
  const base = ledger([
    order({ id: "o1", order_date: "2026-09-20", payments: [pay(400, "2026-09-21")] }),                                   // owes 600, 10 d
    order({ id: "o2", order_date: "2026-05-01", payments: [] }),                                                         // owes 1000, 152 d
    order({ id: "o3", customer_id: "c2", customerName: "Beta", customerPhone: null, order_date: "2026-08-15", payments: [pay(1000, "2026-08-20")] }), // settled
    order({ id: "o4", customer_id: "c2", customerName: "Beta", order_date: "2026-07-20", payments: [pay(1250, "2026-07-21")] }), // credit 250
    order({ id: "o5", order_date: "2026-09-25", status: "CANCELLED" }),                                                  // excluded
  ]);
  const out = m.computeOverview(base, TODAY);

  test("to collect, credit and counts", () => {
    expect(out.toCollect).toBe(1600);
    expect(out.credit).toBe(250);
    expect(out.ordersOwing).toBe(2);
    expect(out.customersOwing).toBe(1);
  });

  test("aging bands sum to to-collect", () => {
    expect(out.aging).toEqual([
      { band: "0-30", amount: 600, orders: 1 }, { band: "31-60", amount: 0, orders: 0 },
      { band: "61-90", amount: 0, orders: 0 }, { band: "90+", amount: 1000, orders: 1 },
    ]);
  });

  test("customer list: oldest first, with unpaid orders oldest first", () => {
    expect(out.customers).toEqual([{
      id: "c1", name: "Alpha", phone: "09876543210", amount: 1600, orders: 2, oldestOrderDate: "2026-05-01", oldestDays: 152,
      unpaidOrders: [{ id: "o2", orderDate: "2026-05-01", remaining: 1000 }, { id: "o1", orderDate: "2026-09-20", remaining: 600 }],
    }]);
  });

  test("cancelled orders excluded and reported; recent orders and in-progress", () => {
    expect(out.excluded.cancelled).toEqual({ count: 1, amount: 1000 });
    expect(out.recentOrders.map((r) => r.id)).toEqual(["o5", "o1", "o3", "o4", "o2"]);
    expect(out.inProgress).toBe(0);
  });

  test("checks pass", () => {
    expect(out.checks).toEqual({ ok: true, allTime: true, agingSum: true, customersSum: true });
  });

  test("float kg math stays paise-exact", () => {
    const o = m.computeOverview(ledger([order({ id: "f", order_date: "2026-09-01", orderProductSizes: [kgLine("12.35", "181.25")] })]), TODAY);
    expect(o.toCollect).toBe(2238.44);
    expect(o.checks.ok).toBe(true);
  });
});

describe("reconcile", () => {
  test("flags any disagreement", () => {
    const good = { salesPaise: 1000, receivedPaise: 400, toCollectPaise: 700, creditPaise: 100, agingPaise: [700], customersPaise: [700] };
    expect(m.reconcile(good).ok).toBe(true);
    expect(m.reconcile({ ...good, agingPaise: [699] })).toMatchObject({ ok: false, agingSum: false });
    expect(m.reconcile({ ...good, customersPaise: [701] })).toMatchObject({ ok: false, customersSum: false });
    expect(m.reconcile({ ...good, receivedPaise: 401 })).toMatchObject({ ok: false, allTime: false });
  });
});

describe("computePeriod", () => {
  const L = ledger([
    order({ id: "old", order_date: "2026-06-10", payments: [pay(300, "2026-09-05")] }),              // payment received in Sep on a June order
    order({ id: "sep", order_date: "2026-09-10", payments: [pay(200, "2026-09-12"), pay(100, "2026-08-30")] }),
    order({ id: "aug", order_date: "2026-08-10", orderProductSizes: [kgLine(5, 100), { unit: "PIECES", quantity_pieces: 1000, price_amount: "375", price_pieces_count: 1000, weight_kg: "10", weight_pieces_count: 1000, weight_source: "SIZE", productSize: { size_label: "10 x 12" } }] }),
    order({ id: "legacy", order_date: "2026-09-02", advance_received: "50.00", payments: [] }),       // column-only advance
    order({ id: "cx", order_date: "2026-09-03", status: "CANCELLED", payments: [pay(999, "2026-09-03")] }),
  ], {
    deletedOrderPayments: [{ amount: "70.00", payment_date: "2026-09-09" }, { amount: "5.00", payment_date: "2026-08-01" }],
    expenses: [{ bill_date: "2026-09-01", total_cost: "120.50", categoryName: "Ink" }, { bill_date: "2026-09-02", total_cost: "300.00", categoryName: "Raw Material" }, { bill_date: "2026-08-02", total_cost: "80.00", categoryName: "Ink" }],
  });
  const sep = { from: "2026-09-01", to: "2026-09-30" };
  const aug = { from: "2026-08-01", to: "2026-08-30" };
  const out = m.computePeriod(L, { ...sep, label: "This month" }, aug);

  test("sales by order date (cancelled excluded)", () => {
    expect(out.sales).toEqual({ value: 2000, previous: 875, orders: 2 });
  });

  test("payment on an old order counts in the month received; legacy advance at order date", () => {
    expect(out.collected.value).toBe(300 + 200 + 50);
    expect(out.collected.previous).toBe(100);
    expect(out.collected.payments).toBe(2);
  });

  test("volume, top sizes, expenses by category", () => {
    expect(out.volume).toMatchObject({ kgSold: 20, kgFromKgLines: 20, kgFromPieces: 0, previousKgSold: 15 });
    expect(out.topSizes).toEqual([{ size: "14 x 18", kg: 20, pieces: 0 }]);
    expect(out.expenses).toEqual({ value: 420.5, previous: 80, byCategory: [{ name: "Raw Material", amount: 300 }, { name: "Ink", amount: 120.5 }] });
  });

  test("payments not linked to any order are reported, never silently dropped", () => {
    const withUnlinked = { ...L, unlinkedPayments: [{ amount: "250.00", payment_date: "2026-09-15" }, { amount: "5.00", payment_date: "2026-08-01" }] };
    const p = m.computePeriod(withUnlinked, { ...sep, label: "This month" }, aug);
    expect(p.excluded.unlinkedPayments).toEqual({ count: 1, amount: 250 });
    expect(p.collected.value).toBe(550);
  });

  test("exclusions reported", () => {
    expect(out.excluded).toEqual({ cancelled: { count: 1, amount: 1000 }, deletedOrderPayments: { count: 1, amount: 70 }, unlinkedPayments: { count: 0, amount: 0 } });
    expect(out.checks.ok).toBe(true);
  });

  test("all time has no comparison", () => {
    const all = m.computePeriod(L, { from: "2026-01-01", to: TODAY, label: "All time" }, null);
    expect(all.sales.previous).toBeNull();
    expect(all.volume.previousKgSold).toBeNull();
  });
});

describe("computeTrends", () => {
  test("six calendar months, current one partial", () => {
    const t = m.computeTrends(ledger([order({ id: "a", order_date: "2026-09-02", payments: [pay(1000, "2026-09-03")] })]), TODAY, 6);
    expect(t.months).toHaveLength(6);
    expect(t.months[5]).toEqual({ month: "2026-09", sales: 1000, collected: 1000, kgSold: 10, partial: false });
    expect(m.computeTrends(ledger([]), "2026-09-15", 6).months[5].partial).toBe(true);
    expect(t.months[0]).toEqual({ month: "2026-04", sales: 0, collected: 0, kgSold: 0, partial: false });
  });
});
