"use strict";

const { Payment, Invoice, Customer, Order, sequelize } = require("../models");
const { refundTooLarge } = require("../services/refunds");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { httpRoute } = require("../commands/httpRoute");
const createPaymentCommand = require("../commands/payments/createPayment");

/** Record a payment (POST /payments) — the save is the payments.create command. */
const createPayment = httpRoute(createPaymentCommand, {
  respond: async ({ id }) => ({
    status: 201,
    message: "Payment recorded successfully",
    data: await Payment.findByPk(id, {
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
        { model: Customer, as: "customer" },
      ],
    }),
  }),
  failMessage: "Failed to record payment",
});

/**
 * Get all payments
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllPayments = async (req, res) => {
  try {
    const { invoice_id, order_id, customer_id, from_date, to_date, payment_type } = req.query;

    // Build where clause
    const where = {};

    if (invoice_id) {
      where.invoice_id = invoice_id;
    }

    if (order_id) {
      where.order_id = order_id;
    }

    if (customer_id) {
      where.customer_id = customer_id;
    }

    if (payment_type) {
      where.payment_type = payment_type;
    }

    if (from_date || to_date) {
      where.payment_date = {};
      if (from_date) {
        where.payment_date[Op.gte] = from_date;
      }
      if (to_date) {
        where.payment_date[Op.lte] = to_date;
      }
    }

    const payments = await Payment.findAll({
      where,
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
        { model: Customer, as: "customer" },
      ],
      order: [["payment_date", "DESC"]],
    });

    return success(res, 200, "Payments retrieved successfully", payments);
  } catch (err) {
    console.error("Error retrieving payments:", err);
    return error(res, 500, "Failed to retrieve payments", err.message);
  }
};

/**
 * Get payment by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({
      where: {
        id,
      },
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
        { model: Customer, as: "customer" },
      ],
    });

    if (!payment) {
      return error(res, 404, "Payment not found");
    }

    return success(res, 200, "Payment retrieved successfully", payment);
  } catch (err) {
    console.error("Error retrieving payment:", err);
    return error(res, 500, "Failed to retrieve payment", err.message);
  }
};

/**
 * Update payment
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updatePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { amount, payment_date, payment_method, payment_type, reference_number, notes } = req.body;

    // Check if payment exists
    const payment = await Payment.findOne({
      where: {
        id,
      },
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
      ],
    });

    if (!payment) {
      await transaction.rollback();
      return error(res, 404, "Payment not found");
    }

    const nextType = payment_type || payment.payment_type;
    if (nextType === "REFUND" && payment.order_id) {
      const tooLarge = await refundTooLarge(payment.order_id, amount !== undefined ? amount : payment.amount, payment.id, transaction);
      if (tooLarge) {
        await transaction.rollback();
        return error(res, 400, tooLarge);
      }
    }

    // Update payment
    await payment.update(
      {
        amount: amount !== undefined ? amount : payment.amount,
        payment_date: payment_date || payment.payment_date,
        payment_method: payment_method || payment.payment_method,
        payment_type: payment_type || payment.payment_type,
        reference_number: reference_number !== undefined ? reference_number : payment.reference_number,
        notes: notes !== undefined ? notes : payment.notes,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch the updated payment with associations
    const updatedPayment = await Payment.findByPk(id, {
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
        { model: Customer, as: "customer" },
      ],
    });

    return success(res, 200, "Payment updated successfully", updatedPayment);
  } catch (err) {
    await transaction.rollback();
    console.error("Error updating payment:", err);
    return error(res, 500, "Failed to update payment", err.message);
  }
};

/**
 * Delete payment
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deletePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Check if payment exists
    const payment = await Payment.findOne({
      where: {
        id,
      },
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
      ],
    });

    if (!payment) {
      await transaction.rollback();
      return error(res, 404, "Payment not found");
    }

    // Delete payment
    await payment.destroy({ transaction });

    await transaction.commit();

    return success(res, 200, "Payment deleted successfully", { id });
  } catch (err) {
    await transaction.rollback();
    console.error("Error deleting payment:", err);
    return error(res, 500, "Failed to delete payment", err.message);
  }
};

module.exports = {
  createPayment,
  getAllPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
};
