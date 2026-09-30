"use strict";

const db = require("../src/models");
const { takeSnapshot, compareSnapshots } = require("../scripts/piece-orders-snapshot");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("piece-orders snapshot", () => {
  beforeEach(async () => {
    const customer = await createCustomer();
    const plateType = await createPlateType("1500.00");
    const size = await createSize({ rate_per_kg: "181.25" });
    const order = await createOrderWithLines({
      customer, plateType, advance_received: "2000.00", round_off_amount: "5.00",
      lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25" }],
    });
    await db.Payment.create({ order_id: order.id, customer_id: customer.id, amount: "2000.00", payment_type: "ADVANCE", payment_date: "2026-09-01" });
    await db.Payment.create({ order_id: order.id, customer_id: customer.id, amount: "500.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
  });

  test("legacy formula and shared math agree on kg-only data", async () => {
    const before = await takeSnapshot(db.sequelize, "before");
    const after = await takeSnapshot(db.sequelize, "after");
    expect(compareSnapshots(before, after)).toEqual([]);
    expect(before.orders[0].total).toBe((12.35 * 181.25 + 1500 - 5).toFixed(2));
  });

  test("any change is reported", async () => {
    const before = await takeSnapshot(db.sequelize, "before");
    await db.sequelize.query(`UPDATE order_product_sizes SET rate_per_kg = 181.26`);
    const after = await takeSnapshot(db.sequelize, "after");
    const diffs = compareSnapshots(before, after);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.join("\n")).toMatch(/total|rate_per_kg/);
  });

  test("after mode refuses to certify when pieces lines already exist", async () => {
    const [line] = await db.OrderProductSize.findAll();
    const size = await createSize({ rate_per_kg: null, piece_price_amount: "1", piece_price_count: 1 });
    await db.OrderProductSize.create({ order_id: line.order_id, product_size_id: size.id, unit: "PIECES", quantity_pieces: 1, price_amount: "1", price_pieces_count: 1 });
    await expect(takeSnapshot(db.sequelize, "after")).rejects.toThrow(/pieces lines/i);
  });
});
