"use strict";

const { Op } = require("sequelize");
const db = require("../models");

/**
 * Stock Service
 *
 * The single place where stock is mutated. Every function here runs in a
 * transaction and keeps two things in lockstep:
 *
 *   stock_batches   — FIFO lots. quantity_remaining IS the stock on hand.
 *   stock_movements — append-only ledger. Never updated, never deleted.
 *
 * Invariant: for any item, SUM(batch.quantity_remaining) always equals
 * SUM(movement.quantity). Task 3.6 tests this.
 *
 * Sequelize returns DECIMAL as a STRING. parseFloat() everything.
 */

/** Thrown when an issue would drive stock negative. Controllers map this to a 400. */
class InsufficientStockError extends Error {
  constructor(itemName, requested, available, unit) {
    super(
      `Insufficient stock for ${itemName}: tried to issue ${requested} ${unit}, but only ${available} ${unit} available`
    );
    this.name = "InsufficientStockError";
    this.itemName = itemName;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Current stock and value for one item, derived from its open batches.
 * @returns {{quantity: number, value: number}}
 */
const getStockOnHand = async (itemId, transaction = null) => {
  const batches = await db.StockBatch.findAll({
    where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
    transaction,
  });

  return batches.reduce(
    (acc, batch) => {
      const remaining = parseFloat(batch.quantity_remaining);
      const rate = parseFloat(batch.rate);
      return {
        quantity: acc.quantity + remaining,
        value: acc.value + remaining * rate,
      };
    },
    { quantity: 0, value: 0 }
  );
};

module.exports = {
  InsufficientStockError,
  getStockOnHand,
};
