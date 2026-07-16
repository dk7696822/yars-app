"use strict";

const db = require("../../src/models");

const createCategory = async (name = "Fabric") => db.InventoryCategory.create({ name });

const createSupplier = async (name = "Test Supplier") => db.Supplier.create({ name });

const createItem = async (overrides = {}) => {
  const category = overrides.category_id
    ? null
    : await createCategory(`Cat-${Math.random().toString(36).slice(2, 8)}`);

  return db.InventoryItem.create({
    name: "90 GSM White",
    unit: "KG",
    category_id: overrides.category_id || category.id,
    reorder_level: 0,
    ...overrides,
  });
};

/**
 * Put stock into an item directly, as a batch, bypassing the receipt flow.
 * Used to set up FIFO scenarios cheaply.
 */
const givenBatch = async (item, { quantity, rate, received_date }) =>
  db.StockBatch.create({
    item_id: item.id,
    received_date,
    quantity_received: quantity,
    quantity_remaining: quantity,
    rate,
  });

module.exports = { createCategory, createSupplier, createItem, givenBatch };
