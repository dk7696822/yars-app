"use strict";

const db = require("../src/models");
const { runQuery, closePool } = require("../src/assistant/db/assistantDb");
const { orderTotal, paymentPosition, volumeSummary } = require("../src/services/orderMath");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const { loadGuides } = require("../src/assistant/guides");

const guidesText = loadGuides().map((g) => g.body).join("\n");
const canonical = (name) => {
  const m = guidesText.match(new RegExp(`<!-- canonical:${name} -->([\\s\\S]*?)<!-- /canonical:${name} -->`));
  if (!m) throw new Error(`canonical:${name} block missing from the guides`);
  return m[1].trim();
};

afterAll(async () => {
  await closePool();
});

describe("the guides' tested SQL matches the app", () => {
  let customerA;
  let customerB;

  beforeEach(async () => {
    customerA = await createCustomer("Alpha");
    customerB = await createCustomer("Beta");
    const plate = await createPlateType("500.00");
    const kgSize = await createSize({ rate_per_kg: "150.00" });
    const pcsSize = await createSize({ rate_per_kg: null, piece_price_amount: "375", piece_price_count: 1000 });

    const a = await createOrderWithLines({
      customer: customerA, plateType: plate, advance_received: "1000.00", round_off_amount: "5.00",
      lines: [
        { product_size_id: kgSize.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "150.00" },
        { product_size_id: pcsSize.id, unit: "PIECES", quantity_pieces: 5000, price_amount: "375", price_pieces_count: 1000, weight_kg: "100", weight_pieces_count: 10000, weight_source: "SIZE" },
      ],
    });
    await db.Payment.create({ order_id: a.id, customer_id: customerA.id, amount: "1000.00", payment_type: "ADVANCE", payment_date: "2026-09-01" });
    await db.Payment.create({ order_id: a.id, customer_id: customerA.id, amount: "700.00", payment_type: "PARTIAL", payment_date: "2026-09-05" });

    await createOrderWithLines({
      customer: customerB, plateType: plate,
      lines: [{ product_size_id: pcsSize.id, unit: "PIECES", quantity_pieces: 1001, price_amount: "1.005", price_pieces_count: 1 }],
    });

    const betaPaid = await createOrderWithLines({
      customer: customerB, plateType: plate,
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "2.00", rate_per_kg: "150.00" }],
    }); // 300 + 500 plate = 800
    await db.Payment.create({ order_id: betaPaid.id, customer_id: customerB.id, amount: "800.00", payment_type: "FINAL", payment_date: "2026-09-06" });
    await db.Payment.create({ order_id: betaPaid.id, customer_id: customerB.id, amount: "100.00", payment_type: "REFUND", payment_date: "2026-09-07" });

    await createOrderWithLines({
      customer: customerB, plateType: plate, status: "CANCELLED",
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "4.00", rate_per_kg: "150.00" }],
    }); // 1100, cancelled — never owed

    // Gamma: one order overpaid by 200, one owing 800 — pending is 800, not 600.
    const customerC = await createCustomer("Gamma");
    const over = await createOrderWithLines({
      customer: customerC, plateType: plate,
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "2.00", rate_per_kg: "150.00" }],
    }); // 800
    await db.Payment.create({ order_id: over.id, customer_id: customerC.id, amount: "1000.00", payment_type: "FINAL", payment_date: "2026-09-08" });
    await createOrderWithLines({
      customer: customerC, plateType: plate,
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "2.00", rate_per_kg: "150.00" }],
    }); // 800 owing
  });

  const appOrders = () =>
    db.Order.findAll({
      where: { is_archived: false },
      include: [
        { model: db.Customer, as: "customer" },
        { model: db.PlateType, as: "plateType" },
        { model: db.OrderProductSize, as: "orderProductSizes", include: [{ model: db.ProductSize, as: "productSize" }] },
        { model: db.Payment, as: "payments" },
      ],
    }).then((rows) => rows.map((r) => r.toJSON()));

  test("pending query (via the assistant's own guarded path) = app receivable per customer", async () => {
    const out = JSON.parse(await runQuery(canonical("pending")));
    const sqlPending = Object.fromEntries(out.rows.map((r) => [r.name, Number(r.pending)]));

    const expected = {};
    for (const order of await appOrders()) {
      if (order.status === "CANCELLED") continue;
      const remaining = paymentPosition(order, orderTotal(order)).remaining;
      // Like the app: only what is owed adds up; money received above an order's total is not netted.
      expected[order.customer.name] = (expected[order.customer.name] || 0) + Math.max(0, remaining);
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(sqlPending[name]).toBeCloseTo(value, 2);
    }
    // Alpha: 1500 + 1875 + 500 − 5 − 700 − 1000 = 2170; Beta: 1006.01 + 500 + (800 − 800 + 100 refunded)
    expect(sqlPending.Alpha).toBeCloseTo(2170, 2);
    expect(sqlPending.Beta).toBeCloseTo(1606.01, 2);
    expect(sqlPending.Gamma).toBeCloseTo(800, 2);
  });

  test("volume query = app volume summary", async () => {
    const out = JSON.parse(await runQuery(canonical("volume")));
    const row = out.rows[0];
    const app = volumeSummary(await appOrders());
    expect(Number(row.kg_from_kg_lines)).toBeCloseTo(app.kgFromKgLines, 3);
    expect(Number(row.kg_from_pieces)).toBeCloseTo(app.kgFromPieces, 3);
    expect(Number(row.kg_sold)).toBeCloseTo(app.kgSold, 3);
    expect(Number(row.pieces_total)).toBe(app.piecesTotal);
    expect(Number(row.pieces_without_weight)).toBe(app.piecesWithoutWeight);
  });
});
