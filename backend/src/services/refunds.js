"use strict";

const { Order, PlateType, OrderProductSize, ProductSize, Payment } = require("../models");
const { orderTotal, paymentPosition } = require("./orderMath");

/**
 * "A refund can't be more than received": the order's received money, leaving
 * out `excludePaymentId` (the payment being edited). Returns the message to
 * send, or null when the refund is allowed.
 */
const refundTooLarge = async (orderId, amount, excludePaymentId, transaction) => {
  const full = await Order.findByPk(orderId, {
    include: [
      { model: PlateType, as: "plateType", required: false },
      { model: OrderProductSize, as: "orderProductSizes", required: false, include: [{ model: ProductSize, as: "productSize", required: false }] },
      { model: Payment, as: "payments", required: false },
    ],
    transaction,
  });
  const data = full.toJSON();
  data.payments = (data.payments || []).filter((p) => p.id !== excludePaymentId);
  const received = Math.round(paymentPosition(data, orderTotal(data)).totalReceived * 100);
  if (Math.round(parseFloat(amount) * 100) <= received) return null;
  return `A refund can't be more than received (₹${new Intl.NumberFormat("en-IN").format(received / 100)})`;
};

module.exports = { refundTooLarge };
