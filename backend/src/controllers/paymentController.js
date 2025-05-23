"use strict";

const { Payment, Invoice, Customer, Order, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new payment
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { invoice_id, order_id, amount, payment_date, payment_method, payment_type = "PARTIAL", reference_number, notes } = req.body;

    // Validate required fields
    if ((!invoice_id && !order_id) || !amount) {
      await transaction.rollback();
      return error(res, 400, "Missing required fields. Either invoice_id or order_id is required, and amount is required.");
    }

    let customer_id;
    let paymentData = {
      amount,
      payment_date: payment_date || new Date(),
      payment_method: payment_method || "CASH",
      payment_type,
      reference_number,
      notes,
    };

    // Handle invoice payment
    if (invoice_id) {
      // Check if invoice exists
      const invoice = await Invoice.findOne({
        where: {
          id: invoice_id,
          is_archived: false,
        },
        include: [
          {
            model: Customer,
            as: "customer",
          },
          {
            model: Order,
            as: "orders",
          },
        ],
      });

      if (!invoice) {
        await transaction.rollback();
        return error(res, 404, "Invoice not found");
      }

      customer_id = invoice.customer.id;
      paymentData.invoice_id = invoice_id;

      // If order_id is not provided but the payment is for an invoice with orders,
      // we can link the payment to the first order
      if (!order_id && invoice.orders && invoice.orders.length > 0) {
        paymentData.order_id = invoice.orders[0].id;
      }
    }

    // Handle order payment
    if (order_id) {
      // Check if order exists
      const order = await Order.findOne({
        where: {
          id: order_id,
          is_archived: false,
        },
        include: [
          {
            model: Customer,
            as: "customer",
          },
        ],
      });

      if (!order) {
        await transaction.rollback();
        return error(res, 404, "Order not found");
      }

      customer_id = order.customer.id;
      paymentData.order_id = order_id;

      // If this is an advance payment for an order
      if (payment_type === "ADVANCE" && !invoice_id) {
        // No invoice_id for advance payments on orders
        paymentData.invoice_id = null;
      }
    }

    // Set the customer_id
    paymentData.customer_id = customer_id;

    // Create the payment
    const payment = await Payment.create(paymentData, { transaction });

    // If this is an invoice payment, update the invoice status
    if (invoice_id) {
      // Get total payments for this invoice
      const payments = await Payment.findAll({
        where: {
          invoice_id,
        },
        attributes: [[sequelize.fn("SUM", sequelize.col("amount")), "total_paid"]],
        raw: true,
      });

      const invoice = await Invoice.findByPk(invoice_id);
      const totalPaid = parseFloat(payments[0].total_paid || 0);
      const finalAmount = parseFloat(invoice.final_amount);

      // Update invoice status if fully paid
      if (totalPaid >= finalAmount) {
        await invoice.update({ status: "PAID" }, { transaction });
      } else if (invoice.status === "PAID") {
        // If it was previously marked as paid but now isn't (e.g., payment adjustment)
        await invoice.update({ status: "PENDING" }, { transaction });
      }
    }

    await transaction.commit();

    // Fetch the complete payment with associations
    const createdPayment = await Payment.findByPk(payment.id, {
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
        { model: Customer, as: "customer" },
      ],
    });

    return success(res, 201, "Payment recorded successfully", createdPayment);
  } catch (err) {
    await transaction.rollback();
    console.error("Error recording payment:", err);
    return error(res, 500, "Failed to record payment", err.message);
  }
};

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

    // Update payment
    await payment.update(
      {
        amount: amount || payment.amount,
        payment_date: payment_date || payment.payment_date,
        payment_method: payment_method || payment.payment_method,
        payment_type: payment_type || payment.payment_type,
        reference_number: reference_number !== undefined ? reference_number : payment.reference_number,
        notes: notes !== undefined ? notes : payment.notes,
      },
      { transaction }
    );

    // If this payment is associated with an invoice, update the invoice status
    if (payment.invoice_id) {
      // Get total payments for this invoice
      const payments = await Payment.findAll({
        where: {
          invoice_id: payment.invoice_id,
        },
        attributes: [[sequelize.fn("SUM", sequelize.col("amount")), "total_paid"]],
        raw: true,
      });

      const totalPaid = parseFloat(payments[0].total_paid || 0);
      const finalAmount = parseFloat(payment.invoice.final_amount);

      // Update invoice status if fully paid
      if (totalPaid >= finalAmount) {
        await payment.invoice.update({ status: "PAID" }, { transaction });
      } else if (payment.invoice.status === "PAID") {
        // If it was previously marked as paid but now isn't (e.g., payment adjustment)
        await payment.invoice.update({ status: "PENDING" }, { transaction });
      }
    }

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

    // Store invoice_id before deleting
    const invoiceId = payment.invoice_id;

    // Delete payment
    await payment.destroy({ transaction });

    // If this payment was associated with an invoice, update the invoice status
    if (invoiceId) {
      // Get total payments for this invoice
      const payments = await Payment.findAll({
        where: {
          invoice_id: invoiceId,
        },
        attributes: [[sequelize.fn("SUM", sequelize.col("amount")), "total_paid"]],
        raw: true,
      });

      const totalPaid = parseFloat(payments[0]?.total_paid || 0);

      // Only proceed if the invoice still exists
      if (payment.invoice) {
        const finalAmount = parseFloat(payment.invoice.final_amount);

        // Update invoice status based on remaining payments
        if (totalPaid >= finalAmount) {
          await payment.invoice.update({ status: "PAID" }, { transaction });
        } else if (payment.invoice.status === "PAID") {
          // If it was previously marked as paid but now isn't
          await payment.invoice.update({ status: "PENDING" }, { transaction });
        }
      }
    }

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
