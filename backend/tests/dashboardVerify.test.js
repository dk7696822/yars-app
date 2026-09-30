"use strict";

const db = require("../src/models");
const { verifyDashboard } = require("../scripts/dashboard-verify");
const { todayIST, addDays } = require("../src/services/dashboard/dateRanges");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

test("verification agrees with independent SQL on consistent data", async () => {
  const today = todayIST();
  const c = await createCustomer("Gamma");
  const plate = await createPlateType("100.00");
  const size = await createSize({ rate_per_kg: "50.00" });
  const o = await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, -10), lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "3.00", rate_per_kg: "50.00" }] });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "100.00", payment_type: "PARTIAL", payment_date: today });

  const result = await verifyDashboard(db.sequelize, db, today);
  expect(result.problems).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.summary.toCollect).toBe(150);
});

test("verification agrees when there are refunds and cancelled orders", async () => {
  const today = todayIST();
  const c = await createCustomer("Delta");
  const plate = await createPlateType("0.00");
  const size = await createSize({ rate_per_kg: "100.00" });
  const line = { product_size_id: size.id, unit: "KG", quantity_kg: "5.00", rate_per_kg: "100.00" };
  const o = await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, -3), lines: [line] });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "500.00", payment_type: "FINAL", payment_date: today });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "50.00", payment_type: "REFUND", payment_date: today });
  await createOrderWithLines({ customer: c, plateType: plate, order_date: today, status: "CANCELLED", lines: [line] });

  const result = await verifyDashboard(db.sequelize, db, today);
  expect(result.problems).toEqual([]);
  expect(result.summary.toCollect).toBe(50);
});

test("verification covers the orders list, customer directory and invoices", async () => {
  const { generateInvoice } = require("../src/controllers/invoiceController");
  const { mockRes } = require("./helpers/http");
  const today = todayIST();
  const c = await createCustomer("Epsilon");
  const plate = await createPlateType("0.00");
  const size = await createSize({ rate_per_kg: "100.00" });
  const line = { product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" };
  const o = await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, -5), lines: [line] });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "1000.00", payment_type: "FINAL", payment_date: today });
  const res = mockRes();
  await generateInvoice({ body: { customer_id: c.id, order_ids: [o.id], tax_percent: 10 } }, res);
  expect(res.status.mock.calls[0][0]).toBe(201);

  const result = await verifyDashboard(db.sequelize, db, today);
  expect(result.problems).toEqual([]);
  expect(result.summary.lists).toEqual({ ordersDue: 0, ordersTotal: 1000, directoryDue: 0, archivedCustomersDue: 0 });
  expect(result.summary.invoices).toEqual({
    count: 1, derived: { PENDING: 1, OVERDUE: 0, PAID: 0, CANCELLED: 0 }, storedPendingNowPaid: 0,
    taxed: [{ number: "00000001", finalAmount: 1100, amountDue: 100 }], doubleInvoicedOrders: [],
  });
});
