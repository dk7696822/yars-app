"use strict";

const db = require("../src/models");
const { loadOrders } = require("../src/services/dashboard/ledger");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("who made a change", () => {
  let customer;
  let order;

  beforeEach(async () => {
    customer = await createCustomer("Actor Test");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({
      customer, plateType: plate,
      lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }],
    });
  });

  const payment = () => ({ order_id: order.id, customer_id: customer.id, amount: "100.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
  const log = (entity_type, action) => db.AuditLog.findOne({ where: { entity_type, action } });

  test("a change from a screen is marked source app", async () => {
    await db.Payment.create(payment());
    expect((await log("PAYMENT", "CREATE")).metadata).toMatchObject({ source: "app" });
  });

  test("a change Sage made carries its action id", async () => {
    await db.Payment.create(payment(), { actor: { source: "assistant", actionId: "act-1" } });
    expect((await log("PAYMENT", "CREATE")).metadata).toMatchObject({ source: "assistant", assistant_action_id: "act-1" });
  });

  test("order status changes carry the actor too", async () => {
    await order.update({ status: "DELIVERED" }, { actor: { source: "assistant", actionId: "act-2" } });
    expect((await log("ORDER", "UPDATE")).metadata).toMatchObject({ source: "assistant", assistant_action_id: "act-2", new_status: "DELIVERED" });
  });
});

describe("loadOrders inside a transaction", () => {
  test("sees rows written in that transaction, and only there", async () => {
    const customer = await createCustomer("Tx");
    const plate = await createPlateType("0.00");
    const t = await db.sequelize.transaction();
    try {
      await db.Order.create({ customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-01" }, { transaction: t });
      expect(await loadOrders(db, { is_archived: false }, { transaction: t })).toHaveLength(1);
      expect(await loadOrders(db, { is_archived: false })).toHaveLength(0);
    } finally {
      await t.rollback();
    }
  });
});
