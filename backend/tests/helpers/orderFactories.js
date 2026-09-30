"use strict";

const db = require("../../src/models");

const rand = () => Math.random().toString(36).slice(2, 8);

const createCustomer = (name = `Customer-${rand()}`) => db.Customer.create({ name });

const createPlateType = (charge = "1500.00") => db.PlateType.create({ type_name: `Plate-${rand()}`, charge });

const createSize = (fields = {}) => db.ProductSize.create({ size_label: `S-${rand()}`, rate_per_kg: "180.00", ...fields });

const createOrderWithLines = async ({ customer, plateType, lines, ...orderFields }) => {
  const order = await db.Order.create({
    customer_id: customer.id,
    plate_type_id: plateType.id,
    order_date: "2026-09-01",
    ...orderFields,
  });
  for (const line of lines) {
    await db.OrderProductSize.create({ order_id: order.id, ...line });
  }
  return order;
};

module.exports = { createCustomer, createPlateType, createSize, createOrderWithLines };
