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

describe("refunds", () => {
  let order;
  beforeEach(async () => {
    const customer = await createCustomer("Refundee");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }] });
    await db.Payment.create({ order_id: order.id, customer_id: customer.id, amount: "600.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
  });

  test("a refund up to what was received is saved", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "600", payment_type: "REFUND", payment_date: "2026-09-03" } });
    expect(res.status).toBe(201);
  });

  test("editing a refund can't take it above what was received", async () => {
    const refund = await call(createPayment, { body: { order_id: order.id, amount: "100", payment_type: "REFUND", payment_date: "2026-09-03" } });
    const res = await call(updatePayment, { params: { id: refund.body.data.id }, body: { amount: "600.01" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A refund can't be more than received (₹600)");
    expect((await call(updatePayment, { params: { id: refund.body.data.id }, body: { amount: "600" } })).status).toBe(200);
  });

  test("turning a payment into a refund counts only the other payments as received", async () => {
    const partial = await db.Payment.findOne({ where: { order_id: order.id, payment_type: "PARTIAL" } });
    const res = await call(updatePayment, { params: { id: partial.id }, body: { payment_type: "REFUND" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A refund can't be more than received (₹0)");
    expect((await partial.reload()).payment_type).toBe("PARTIAL");
  });

  test("a refund above what was received is refused", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "600.01", payment_type: "REFUND", payment_date: "2026-09-03" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A refund can't be more than received (₹600)");
    expect(await db.Payment.count({ where: { payment_type: "REFUND" } })).toBe(0);
  });
});
