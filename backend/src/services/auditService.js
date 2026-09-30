"use strict";

const { orderTotal, paymentPosition } = require("./orderMath");

/**
 * Audit Service
 * Handles creating audit logs and calculating order metrics for tracking
 */

/**
 * Create an audit log entry
 * @param {Object} AuditLog - The AuditLog model
 * @param {Object} options
 * @param {string} options.entityType - 'PAYMENT' or 'ORDER'
 * @param {string} options.entityId - UUID of the entity
 * @param {string} options.action - 'CREATE', 'UPDATE', or 'DELETE'
 * @param {Object} options.oldValues - Previous state (optional)
 * @param {Object} options.newValues - New state (optional)
 * @param {Object} options.metadata - Additional context
 * @param {Object} options.transaction - Sequelize transaction (optional)
 */
const createAuditLog = async (AuditLog, { entityType, entityId, action, oldValues, newValues, metadata, transaction }) => {
  try {
    // Calculate changed fields for updates
    let changedFields = null;
    if (action === "UPDATE" && oldValues && newValues) {
      changedFields = Object.keys(newValues).filter(
        (key) => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
      );
    }

    await AuditLog.create(
      {
        entity_type: entityType,
        entity_id: entityId,
        action,
        old_values: oldValues,
        new_values: newValues,
        changed_fields: changedFields,
        metadata,
      },
      { transaction }
    );
  } catch (err) {
    console.error("Error creating audit log:", err);
    // Don't throw - audit logging should not break main operations
  }
};

/**
 * Calculate order metrics (total_amount, total_received, outstanding)
 * Reuses calculation logic from orderController.js
 * @param {Object} models - Sequelize models object
 * @param {string} orderId - Order UUID
 * @returns {Object} - { total_amount, total_received, outstanding }
 */
const calculateOrderMetrics = async (models, orderId) => {
  try {
    const { Order, Customer, PlateType, OrderProductSize, ProductSize, Payment } = models;

    const order = await Order.findByPk(orderId, {
      include: [
        { model: Customer, as: "customer" },
        { model: PlateType, as: "plateType" },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          include: [{ model: ProductSize, as: "productSize" }],
        },
        { model: Payment, as: "payments", required: false },
      ],
    });

    if (!order) {
      return { total_amount: 0, total_received: 0, outstanding: 0 };
    }

    const orderData = order.toJSON();

    const totalOrderAmount = orderTotal(orderData);
    const { totalReceived } = paymentPosition(orderData, totalOrderAmount);
    // Kept as total − received (not total − paid − advance) to match the
    // audit history already written.
    const outstanding = totalOrderAmount - totalReceived;

    return {
      total_amount: parseFloat(totalOrderAmount.toFixed(2)),
      total_received: parseFloat(totalReceived.toFixed(2)),
      outstanding: parseFloat(outstanding.toFixed(2)),
      customer_name: orderData.customer?.name || null,
    };
  } catch (err) {
    console.error("Error calculating order metrics:", err);
    return { total_amount: 0, total_received: 0, outstanding: 0 };
  }
};

/**
 * Helper to extract relevant payment fields for audit
 */
const extractPaymentAuditData = (payment) => {
  return {
    id: payment.id,
    amount: parseFloat(payment.amount),
    payment_type: payment.payment_type,
    payment_method: payment.payment_method,
    payment_date: payment.payment_date,
    reference_number: payment.reference_number,
    notes: payment.notes,
    order_id: payment.order_id,
    invoice_id: payment.invoice_id,
    customer_id: payment.customer_id,
  };
};

/**
 * Helper to extract relevant order fields for audit
 */
const extractOrderAuditData = (order) => {
  return {
    id: order.id,
    status: order.status,
    order_date: order.order_date,
    advance_received: parseFloat(order.advance_received || 0),
    customer_id: order.customer_id,
    is_archived: order.is_archived,
  };
};

module.exports = {
  createAuditLog,
  calculateOrderMetrics,
  extractPaymentAuditData,
  extractOrderAuditData,
};
