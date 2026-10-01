"use strict";

const { ProductSize, OrderProductSize } = require("../../models");
const { buildLineRow } = require("../../services/orderLines");
const { LineError } = require("../../services/pieceFields");

/** Validate + create every line of an order inside `transaction`. Throws LineError (a 400). */
const createLines = async (orderId, productSizes, transaction) => {
  for (const ps of productSizes) {
    if (!ps.product_size_id) throw new LineError("Product size ID and quantity are required");
    const productSize = await ProductSize.findByPk(ps.product_size_id, { transaction });
    if (!productSize) throw new LineError("Invalid product size ID");
    const row = buildLineRow(ps, productSize);
    await OrderProductSize.create({ order_id: orderId, product_size_id: ps.product_size_id, ...row }, { transaction });
  }
};

module.exports = { createLines };
