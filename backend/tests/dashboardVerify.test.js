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
