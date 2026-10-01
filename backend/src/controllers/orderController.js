"use strict";

const { Order, Customer, PlateType, ProductSize, OrderProductSize, Payment, Invoice, sequelize } = require("../models");
const { lineAmount, lineKg, orderTotal, paymentPosition, volumeSummary } = require("../services/orderMath");
const { orderFacts, rupees } = require("../services/orderFacts");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { todayIST } = require("../services/dashboard/dateRanges");
const models = require("../models");
const { loadOrders } = require("../services/dashboard/ledger");
const { buildOrderList, ListError } = require("../services/lists/orderList");
const { httpRoute } = require("../commands/httpRoute");
const createOrderCommand = require("../commands/orders/createOrder");
const updateOrderCommand = require("../commands/orders/updateOrder");

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
    // The figures every new screen shows — identical to the list row and the dashboard.
    money: (() => {
      const f = orderFacts(orderData);
      return { total: rupees(f.totalPaise), received: rupees(f.receivedPaise), due: rupees(f.remainingPaise) };
    })(),
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

/** Create an order (POST /orders) — the save is the orders.create command. */
const createOrder = httpRoute(createOrderCommand, {
  respond: async ({ id }) => ({ status: 201, message: "Order created successfully", data: await Order.findByPk(id, { include: orderIncludes() }) }),
  failMessage: "Failed to create order",
});

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

/** Orders screen: filtered, summarised, paged — figures from orderFacts. */
const listOrders = async (req, res) => {
  try {
    const orders = await loadOrders(models);
    return success(res, 200, "Orders list", buildOrderList(orders, req.query, todayIST()));
  } catch (err) {
    if (err instanceof ListError) return error(res, 400, err.message);
    console.error("Error listing orders:", err);
    return error(res, 500, "Failed to load orders", err.message);
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

/** Update an order (PUT /orders/:id) — the save is the orders.update command. */
const updateOrder = httpRoute(updateOrderCommand, {
  toInput: (req) => ({ ...req.body, id: req.params.id }),
  respond: async ({ id }) => ({
    status: 200,
    message: "Order updated successfully",
    data: await Order.findOne({ where: { id, is_archived: false }, include: orderIncludes() }),
  }),
  failMessage: "Failed to update order",
});

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
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
};
