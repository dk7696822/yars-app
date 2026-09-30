"use strict";

const { Order, Customer, PlateType, ProductSize, OrderProductSize, Payment, Invoice, sequelize } = require("../models");
const { lineAmount, lineKg, orderTotal, paymentPosition, volumeSummary } = require("../services/orderMath");
const { buildLineRow } = require("../services/orderLines");
const { LineError } = require("../services/pieceFields");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { todayIST } = require("../services/dashboard/dateRanges");

/** Attach computed money + volume fields to a plain order (shared by list and detail). */
const withComputedFields = (orderData) => {
  const total = orderTotal(orderData);
  const position = paymentPosition(orderData, total);
  return {
    ...orderData,
    orderProductSizes: (orderData.orderProductSizes || []).map((line) => ({
      ...line,
      line_amount: lineAmount(line),
      line_kg: lineKg(line),
    })),
    volume: volumeSummary([orderData]),
    total_amount: parseFloat(total.toFixed(2)),
    totalReceivable: parseFloat((total - position.advanceReceived).toFixed(2)), // For backward compatibility
    payment_summary: {
      total_paid: position.totalPaid,
      advance_received: position.advanceReceived,
      total_payments: position.totalPaid + position.advanceReceived,
      remaining_balance: parseFloat(position.remaining.toFixed(2)),
      is_fully_paid: position.totalPaid + position.advanceReceived >= total,
    },
  };
};

/**
 * Every include is required:false — an archived size, plate or customer must
 * never hide an order or one of its lines (a nested `where` would).
 */
const orderIncludes = () => [
  { model: Customer, as: "customer", required: false },
  { model: PlateType, as: "plateType", required: false },
  {
    model: OrderProductSize, as: "orderProductSizes", required: false,
    include: [{ model: ProductSize, as: "productSize", required: false }],
  },
  { model: Payment, as: "payments", required: false },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number"], required: false },
];

/** Validate + create every line of an order inside `transaction`. Throws LineError. */
const createLines = async (orderId, productSizes, transaction) => {
  for (const ps of productSizes) {
    if (!ps.product_size_id) throw new LineError("Product size ID and quantity are required");
    const productSize = await ProductSize.findByPk(ps.product_size_id, { transaction });
    if (!productSize) throw new LineError("Invalid product size ID");
    const row = buildLineRow(ps, productSize);
    await OrderProductSize.create({ order_id: orderId, product_size_id: ps.product_size_id, ...row }, { transaction });
  }
};

/**
 * Create a new order
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { customer_id, order_date, advance_received, plate_type_id, product_sizes, status, custom_plate_charge, round_off_amount } = req.body;

    // Validate required fields
    if (!customer_id || !plate_type_id || !product_sizes || !product_sizes.length) {
      await transaction.rollback();
      return error(res, 400, "Missing required fields");
    }

    // Create the order
    const order = await Order.create(
      {
        customer_id,
        order_date: order_date || todayIST(),
        advance_received: advance_received || 0,
        plate_type_id,
        status: status || "PENDING",
        custom_plate_charge: custom_plate_charge ? parseFloat(custom_plate_charge) : null,
        round_off_amount: round_off_amount ? parseFloat(round_off_amount) : 0,
      },
      { transaction }
    );

    // If advance payment was provided, create a payment record
    if (advance_received && parseFloat(advance_received) > 0) {
      await Payment.create(
        {
          order_id: order.id,
          customer_id,
          amount: parseFloat(advance_received),
          payment_date: order_date || todayIST(),
          payment_method: "CASH", // Default to cash, can be updated later
          payment_type: "ADVANCE",
          notes: "Advance payment at order creation",
        },
        { transaction }
      );
    }

    await createLines(order.id, product_sizes, transaction);

    await transaction.commit();

    // Fetch the complete order with associations
    const createdOrder = await Order.findByPk(order.id, { include: orderIncludes() });

    return success(res, 201, "Order created successfully", createdOrder);
  } catch (err) {
    await transaction.rollback();
    if (err instanceof LineError) {
      return error(res, 400, err.message);
    }
    console.error("Error creating order:", err);
    return error(res, 500, "Failed to create order", err.message);
  }
};

/**
 * Get all orders with filtering
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllOrders = async (req, res) => {
  try {
    const { customerName, dateFrom, dateTo, date, status, customer_id, invoice_id } = req.query;

    // Build the where clause for Order
    const orderWhere = {
      is_archived: false,
    };

    // Customer ID filtering
    if (customer_id) {
      orderWhere.customer_id = customer_id;
    }

    // Invoice ID filtering - special case for 'null' to find unbilled orders
    if (invoice_id === "null") {
      orderWhere.invoice_id = null;
    } else if (invoice_id) {
      orderWhere.invoice_id = invoice_id;
    }

    // Date filtering
    if (date) {
      orderWhere.order_date = date;
    } else if (dateFrom || dateTo) {
      orderWhere.order_date = {};
      if (dateFrom) {
        orderWhere.order_date[Op.gte] = dateFrom;
      }
      if (dateTo) {
        orderWhere.order_date[Op.lte] = dateTo;
      }
    }

    // Status filtering
    if (status) {
      orderWhere.status = status;
    }

    const includeArray = orderIncludes();
    if (customerName) {
      includeArray[0] = { model: Customer, as: "customer", required: true, where: { name: { [Op.iLike]: `%${customerName}%` } } };
    }

    const orders = await Order.findAll({
      where: orderWhere,
      include: includeArray,
      order: [["order_date", "DESC"]],
    });

    // Calculate total receivable for each order
    const ordersWithTotal = orders.map((order) => withComputedFields(order.toJSON()));

    return success(res, 200, "Orders retrieved successfully", ordersWithTotal);
  } catch (err) {
    console.error("Error retrieving orders:", err);
    return error(res, 500, "Failed to retrieve orders", err.message);
  }
};

/**
 * Get an order by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: {
        id,
        is_archived: false,
      },
      include: orderIncludes(),
    });

    if (!order) {
      return error(res, 404, "Order not found");
    }

    const orderWithTotal = withComputedFields(order.toJSON());

    return success(res, 200, "Order retrieved successfully", orderWithTotal);
  } catch (err) {
    console.error("Error retrieving order:", err);
    return error(res, 500, "Failed to retrieve order", err.message);
  }
};

/**
 * Update an order
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updateOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { customer_id, order_date, plate_type_id, product_sizes, status, custom_plate_charge, round_off_amount } = req.body;

    // Check if order exists
    const order = await Order.findOne({
      where: {
        id,
        is_archived: false,
      },
    });
    if (!order) {
      await transaction.rollback();
      return error(res, 404, "Order not found");
    }

    // Update order details. The advance is set only when an order is created;
    // later advances or corrections are recorded as payments — editing never
    // rewrites them.
    await order.update(
      {
        customer_id: customer_id || order.customer_id,
        order_date: order_date || order.order_date,
        plate_type_id: plate_type_id || order.plate_type_id,
        status: status || order.status,
        custom_plate_charge: custom_plate_charge !== undefined ? (custom_plate_charge ? parseFloat(custom_plate_charge) : null) : order.custom_plate_charge,
        round_off_amount: round_off_amount !== undefined ? parseFloat(round_off_amount || 0) : order.round_off_amount,
      },
      { transaction }
    );

    // Update product sizes if provided
    if (product_sizes && product_sizes.length > 0) {
      // Delete existing order product sizes
      await OrderProductSize.destroy({
        where: { order_id: id },
        transaction,
      });

      await createLines(id, product_sizes, transaction);
    }

    await transaction.commit();

    // Fetch the updated order with associations
    const updatedOrder = await Order.findOne({
      where: {
        id,
        is_archived: false,
      },
      include: orderIncludes(),
    });

    return success(res, 200, "Order updated successfully", updatedOrder);
  } catch (err) {
    await transaction.rollback();
    if (err instanceof LineError) {
      return error(res, 400, err.message);
    }
    console.error("Error updating order:", err);
    return error(res, 500, "Failed to update order", err.message);
  }
};

/**
 * Delete an order
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deleteOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Check if order exists
    const order = await Order.findOne({
      where: {
        id,
        is_archived: false,
      },
    });
    if (!order) {
      await transaction.rollback();
      return error(res, 404, "Order not found");
    }

    // Soft delete the order
    await order.update({ is_archived: true }, { transaction });

    await transaction.commit();

    return success(res, 200, "Order deleted successfully");
  } catch (err) {
    await transaction.rollback();
    console.error("Error deleting order:", err);
    return error(res, 500, "Failed to delete order", err.message);
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
};
