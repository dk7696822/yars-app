"use strict";

const { z } = require("zod");
const { Order, Payment } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { numberText, orderFields } = require("./schema");
const { createLines } = require("./lines");

const input = z
  .object({ ...orderFields, advance_received: numberText.nullish() })
  .superRefine((v, ctx) => {
    if (!v.customer_id || !v.plate_type_id || !v.product_sizes || !v.product_sizes.length) {
      ctx.addIssue({ code: "custom", message: "Missing required fields" });
    }
  });

module.exports = defineCommand({
  name: "orders.create",
  route: "POST /orders",
  input,
  run: async (v, { transaction, actor }) => {
    const order = await Order.create(
      {
        customer_id: v.customer_id,
        order_date: v.order_date || todayIST(),
        advance_received: v.advance_received || 0,
        plate_type_id: v.plate_type_id,
        status: v.status || "PENDING",
        custom_plate_charge: v.custom_plate_charge ? parseFloat(v.custom_plate_charge) : null,
        round_off_amount: v.round_off_amount ? parseFloat(v.round_off_amount) : 0,
      },
      { transaction, actor }
    );

    // An advance given at order time is recorded as an ADVANCE payment.
    if (v.advance_received && parseFloat(v.advance_received) > 0) {
      await Payment.create(
        {
          order_id: order.id,
          customer_id: v.customer_id,
          amount: parseFloat(v.advance_received),
          payment_date: v.order_date || todayIST(),
          payment_method: "CASH", // Default to cash, can be updated later
          payment_type: "ADVANCE",
          notes: "Advance payment at order creation",
        },
        { transaction, actor }
      );
    }

    await createLines(order.id, v.product_sizes, transaction);
    return { id: order.id };
  },
});
