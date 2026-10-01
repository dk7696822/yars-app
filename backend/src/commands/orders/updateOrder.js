"use strict";

const { z } = require("zod");
const { Order, OrderProductSize } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { NotFoundError } = require("../errors");
const { orderFields } = require("./schema");
const { createLines } = require("./lines");

module.exports = defineCommand({
  name: "orders.update",
  route: "PUT /orders/:id",
  input: z.object({ id: z.string(), ...orderFields }),
  run: async (v, { transaction, actor }) => {
    const order = await Order.findOne({ where: { id: v.id, is_archived: false }, transaction });
    if (!order) throw new NotFoundError("Order not found");

    // The advance is set only when an order is created; later advances or
    // corrections are recorded as payments — editing never rewrites them.
    await order.update(
      {
        customer_id: v.customer_id || order.customer_id,
        order_date: v.order_date || order.order_date,
        plate_type_id: v.plate_type_id || order.plate_type_id,
        status: v.status || order.status,
        custom_plate_charge:
          v.custom_plate_charge !== undefined ? (v.custom_plate_charge ? parseFloat(v.custom_plate_charge) : null) : order.custom_plate_charge,
        round_off_amount: v.round_off_amount !== undefined ? parseFloat(v.round_off_amount || 0) : order.round_off_amount,
      },
      { transaction, actor }
    );

    if (v.product_sizes && v.product_sizes.length > 0) {
      await OrderProductSize.destroy({ where: { order_id: v.id }, transaction });
      await createLines(v.id, v.product_sizes, transaction);
    }
    return { id: v.id };
  },
});
