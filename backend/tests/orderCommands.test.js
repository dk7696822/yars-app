"use strict";

const db = require("../src/models");
const { createOrder, updateOrder } = require("../src/controllers/orderController");
const { COMMANDS } = require("../src/commands");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("orders through commands", () => {
  let base;
  let size;
  beforeEach(async () => {
    const customer = await createCustomer("Orderer");
    const plate = await createPlateType("500.00");
    size = await createSize({ rate_per_kg: "150.00" });
    base = { customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-10", product_sizes: [{ product_size_id: size.id, quantity_kg: 10 }] };
  });

  test("missing fields keep the app's message", async () => {
    expect(await call(createOrder, { body: { customer_id: base.customer_id } })).toMatchObject({ status: 400, body: { message: "Missing required fields" } });
  });

  test("an unknown status is a 400", async () => {
    const res = await call(createOrder, { body: { ...base, status: "LOST" } });
    expect(res).toMatchObject({ status: 400, body: { message: "Status must be one of PENDING, IN_PROGRESS, COMPLETED, DELIVERED, CANCELLED" } });
  });

  test("a bad line saves nothing at all", async () => {
    const res = await call(createOrder, { body: { ...base, product_sizes: [{ product_size_id: size.id, unit: "PIECES", quantity_pieces: 0 }] } });
    expect(res).toMatchObject({ status: 400, body: { message: "Quantity (pcs) must be a whole number, 1 or more" } });
    expect(await db.Order.count()).toBe(0);
  });

  test("an advance becomes an ADVANCE payment, as before", async () => {
    const res = await call(createOrder, { body: { ...base, advance_received: 300 } });
    expect(res.status).toBe(201);
    const pay = await db.Payment.findOne({ where: { order_id: res.body.data.id } });
    expect([pay.payment_type, Number(pay.amount)]).toEqual(["ADVANCE", 300]);
  });

  test("a status change from the screen is logged with source app", async () => {
    const created = await call(createOrder, { body: base });
    const res = await call(updateOrder, { params: { id: created.body.data.id }, body: { status: "DELIVERED" } });
    expect(res).toMatchObject({ status: 200, body: { message: "Order updated successfully", data: { status: "DELIVERED" } } });
    const log = await db.AuditLog.findOne({ where: { entity_type: "ORDER", action: "UPDATE" } });
    expect(log.metadata).toMatchObject({ source: "app", new_status: "DELIVERED" });
  });

  test("updating an order that doesn't exist is a 404", async () => {
    const res = await call(updateOrder, { params: { id: "00000000-0000-4000-8000-000000000000" }, body: { status: "DELIVERED" } });
    expect(res).toMatchObject({ status: 404, body: { message: "Order not found" } });
  });

  test("every command is listed once, with a route", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(COMMANDS.every((c) => /^(POST|PUT|PATCH|DELETE) \//.test(c.route))).toBe(true);
    expect(names.sort()).toEqual(["customers.create", "orders.create", "orders.update", "payments.create"]);
  });
});
