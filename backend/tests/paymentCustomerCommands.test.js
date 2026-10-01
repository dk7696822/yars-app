"use strict";

const db = require("../src/models");
const { createPayment } = require("../src/controllers/paymentController");
const { createCustomer } = require("../src/controllers/customerController");
const { mockRes } = require("./helpers/http");
const { createCustomer: makeCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("payments.create through the route", () => {
  let order;
  beforeEach(async () => {
    const customer = await makeCustomer("Payer");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }] });
  });

  test("no order or invoice keeps the app's message", async () => {
    const res = await call(createPayment, { body: { amount: 100 } });
    expect(res).toMatchObject({ status: 400, body: { message: "Missing required fields. Either invoice_id or order_id is required, and amount is required." } });
  });

  test("an unknown method is a 400, not a database error", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: 100, payment_method: "BITCOIN" } });
    expect(res).toMatchObject({ status: 400, body: { message: "Payment method must be one of CASH, BANK_TRANSFER, UPI, CHECK, OTHER" } });
  });

  test("an amount that isn't a number above 0 is refused", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "abc" } });
    expect(res).toMatchObject({ status: 400, body: { message: "Amount must be a number above 0" } });
  });

  test("an unknown order is a 404", async () => {
    const res = await call(createPayment, { body: { order_id: "00000000-0000-4000-8000-000000000000", amount: 100 } });
    expect(res).toMatchObject({ status: 404, body: { message: "Order not found" } });
  });

  test("saves, responds as before, and logs source app", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "250", payment_method: "UPI" }, user: { sub: "u1" } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: "Payment recorded successfully", data: { order_id: order.id, payment_method: "UPI", payment_type: "PARTIAL" } });
    expect(res.body.data.order.id).toBe(order.id);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", action: "CREATE" } });
    expect(log.metadata.source).toBe("app");
  });
});

describe("customers.create through the route", () => {
  test("name is required, with the app's message", async () => {
    expect(await call(createCustomer, { body: { phone: "9876543210" } })).toMatchObject({ status: 400, body: { message: "Customer name is required" } });
  });

  test("a bad GSTIN keeps the app's message", async () => {
    expect(await call(createCustomer, { body: { name: "Shop", gstin: "123" } })).toMatchObject({ status: 400, body: { message: "GSTIN should be 15 characters, like 29ABCDE1234F1Z5" } });
  });

  test("contact fields are saved in metadata", async () => {
    const res = await call(createCustomer, { body: { name: " Laxmi ", phone: "9876543210", city: "Bidar" } });
    expect(res).toMatchObject({ status: 201, body: { message: "Customer created successfully", data: { name: "Laxmi", metadata: { phone: "9876543210", city: "Bidar" } } } });
  });
});
