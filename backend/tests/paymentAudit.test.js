"use strict";

const db = require("../src/models");
const { createPayment, updatePayment } = require("../src/controllers/paymentController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("payment history entries", () => {
  let order;
  beforeEach(async () => {
    const customer = await createCustomer("History Co");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }] });
  });

  test("a new payment's entry shows the order after the payment", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "400", payment_type: "PARTIAL", payment_date: "2026-09-10" } });
    expect(res.status).toBe(201);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", action: "CREATE" } });
    expect(log.metadata.before_metrics).toMatchObject({ total_received: 0, outstanding: 1000 });
    expect(log.metadata.after_metrics).toMatchObject({ total_received: 400, outstanding: 600 });
  });

  test("an edited payment's entry shows the order after the edit", async () => {
    const created = await call(createPayment, { body: { order_id: order.id, amount: "400", payment_type: "PARTIAL", payment_date: "2026-09-10" } });
    const res = await call(updatePayment, { params: { id: created.body.data.id }, body: { amount: "500" } });
    expect(res.status).toBe(200);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", action: "UPDATE" } });
    expect(log.metadata.before_metrics).toMatchObject({ total_received: 400 });
    expect(log.metadata.after_metrics).toMatchObject({ total_received: 500, outstanding: 500 });
  });
});
