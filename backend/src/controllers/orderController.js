"use strict";

const { Order, Customer, PlateType, ProductSize, OrderProductSize, Payment, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new order
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { customer_id, order_date, advance_received, plate_type_id, product_sizes, status } = req.body;

    // Validate required fields
    if (!customer_id || !plate_type_id || !product_sizes || !product_sizes.length) {
      await transaction.rollback();
      return error(res, 400, "Missing required fields");
    }

    // Create the order
    const order = await Order.create(
      {
        customer_id,
        order_date: order_date || new Date(),
        advance_received: advance_received || 0,
        plate_type_id,
        status: status || "PENDING",
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
          payment_date: order_date || new Date(),
          payment_method: "CASH", // Default to cash, can be updated later
          payment_type: "ADVANCE",
          notes: "Advance payment at order creation",
        },
        { transaction }
      );
    }

    // Create order product sizes
    const orderProductSizes = [];
    for (const ps of product_sizes) {
      if (!ps.product_size_id || !ps.quantity_kg) {
        await transaction.rollback();
        return error(res, 400, "Product size ID and quantity are required");
      }

      // Get the current rate for this product size
      const productSize = await ProductSize.findByPk(ps.product_size_id);
      if (!productSize) {
        await transaction.rollback();
        return error(res, 400, "Invalid product size ID");
      }

      const orderProductSize = await OrderProductSize.create(
        {
          order_id: order.id,
          product_size_id: ps.product_size_id,
          quantity_kg: ps.quantity_kg,
          rate_per_kg: productSize.rate_per_kg, // Store the current rate
        },
        { transaction }
      );

      orderProductSizes.push(orderProductSize);
    }

    await transaction.commit();

    // Fetch the complete order with associations
    const createdOrder = await Order.findByPk(order.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: PlateType, as: "plateType" },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          include: [{ model: ProductSize, as: "productSize" }],
        },
      ],
    });

    return success(res, 201, "Order created successfully", createdOrder);
  } catch (err) {
    await transaction.rollback();
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

    // Build the include array with customer filtering if needed
    const includeArray = [
      {
        model: Customer,
        as: "customer",
        where: {
          is_archived: false,
          ...(customerName && {
            name: {
              [Op.iLike]: `%${customerName}%`,
            },
          }),
        },
      },
      {
        model: PlateType,
        as: "plateType",
        where: {
          is_archived: false,
        },
      },
      {
        model: OrderProductSize,
        as: "orderProductSizes",
        include: [
          {
            model: ProductSize,
            as: "productSize",
            where: {
              is_archived: false,
            },
          },
        ],
      },
      {
        model: Payment,
        as: "payments",
        required: false,
      },
    ];

    const orders = await Order.findAll({
      where: orderWhere,
      include: includeArray,
      order: [["order_date", "DESC"]],
    });

    // Calculate total receivable for each order
    const ordersWithTotal = orders.map((order) => {
      const orderData = order.toJSON();

      // Calculate total from product sizes
      let totalProductAmount = 0;
      orderData.orderProductSizes.forEach((ops) => {
        // Use the stored rate_per_kg instead of the current product size rate
        totalProductAmount += parseFloat(ops.quantity_kg) * parseFloat(ops.rate_per_kg || ops.productSize.rate_per_kg);
      });

      // Add plate charge
      const plateCharge = parseFloat(orderData.plateType.charge);

      // Calculate total order amount
      const totalOrderAmount = totalProductAmount + plateCharge;

      // Calculate payment summary
      // Filter out ADVANCE type payments to avoid double counting
      const advancePayments = orderData.payments ? orderData.payments.filter((payment) => payment.payment_type === "ADVANCE") : [];

      const otherPayments = orderData.payments ? orderData.payments.filter((payment) => payment.payment_type !== "ADVANCE") : [];

      // Calculate total of non-advance payments
      const totalPaid = otherPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // Use either the advance_received field or the sum of ADVANCE payments, not both
      // This handles both old orders (with advance_received) and new orders (with ADVANCE payments)
      const advanceFromPayments = advancePayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(orderData.advance_received || 0);

      // Calculate remaining balance
      const remainingBalance = totalOrderAmount - totalPaid - advanceReceived;

      // Calculate total receivable (for backward compatibility)
      const totalReceivable = totalOrderAmount - advanceReceived;

      return {
        ...orderData,
        total_amount: parseFloat(totalOrderAmount.toFixed(2)),
        totalReceivable: parseFloat(totalReceivable.toFixed(2)), // For backward compatibility
        payment_summary: {
          total_paid: totalPaid,
          advance_received: advanceReceived,
          total_payments: totalPaid + advanceReceived,
          remaining_balance: parseFloat(remainingBalance.toFixed(2)),
          is_fully_paid: totalPaid + advanceReceived >= totalOrderAmount,
        },
      };
    });

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
      include: [
        {
          model: Customer,
          as: "customer",
          where: {
            is_archived: false,
          },
        },
        {
          model: PlateType,
          as: "plateType",
          where: {
            is_archived: false,
          },
        },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          include: [
            {
              model: ProductSize,
              as: "productSize",
              where: {
                is_archived: false,
              },
            },
          ],
        },
        {
          model: Payment,
          as: "payments",
          required: false,
        },
      ],
    });

    if (!order) {
      return error(res, 404, "Order not found");
    }

    // Calculate total receivable
    const orderData = order.toJSON();

    // Calculate total from product sizes
    let totalProductAmount = 0;
    orderData.orderProductSizes.forEach((ops) => {
      // Use the stored rate_per_kg instead of the current product size rate
      totalProductAmount += parseFloat(ops.quantity_kg) * parseFloat(ops.rate_per_kg || ops.productSize.rate_per_kg);
    });

    // Add plate charge
    const plateCharge = parseFloat(orderData.plateType.charge);

    // Calculate total order amount
    const totalOrderAmount = totalProductAmount + plateCharge;

    // Calculate payment summary
    // Filter out ADVANCE type payments to avoid double counting
    const advancePayments = orderData.payments ? orderData.payments.filter((payment) => payment.payment_type === "ADVANCE") : [];

    const otherPayments = orderData.payments ? orderData.payments.filter((payment) => payment.payment_type !== "ADVANCE") : [];

    // Calculate total of non-advance payments
    const totalPaid = otherPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    // Use either the advance_received field or the sum of ADVANCE payments, not both
    // This handles both old orders (with advance_received) and new orders (with ADVANCE payments)
    const advanceFromPayments = advancePayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(orderData.advance_received || 0);

    // Calculate remaining balance
    const remainingBalance = totalOrderAmount - totalPaid - advanceReceived;

    // Calculate total receivable (for backward compatibility)
    const totalReceivable = totalOrderAmount - advanceReceived;

    const orderWithTotal = {
      ...orderData,
      total_amount: parseFloat(totalOrderAmount.toFixed(2)),
      totalReceivable: parseFloat(totalReceivable.toFixed(2)), // For backward compatibility
      payment_summary: {
        total_paid: totalPaid,
        advance_received: advanceReceived,
        total_payments: totalPaid + advanceReceived,
        remaining_balance: parseFloat(remainingBalance.toFixed(2)),
        is_fully_paid: totalPaid + advanceReceived >= totalOrderAmount,
      },
    };

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
    const { customer_id, order_date, advance_received, plate_type_id, product_sizes, status } = req.body;

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

    // Get the original advance amount before updating
    const originalAdvance = parseFloat(order.advance_received || 0);
    const newAdvance = advance_received !== undefined ? parseFloat(advance_received) : originalAdvance;

    // Update order details
    await order.update(
      {
        customer_id: customer_id || order.customer_id,
        order_date: order_date || order.order_date,
        advance_received: newAdvance,
        plate_type_id: plate_type_id || order.plate_type_id,
        status: status || order.status,
      },
      { transaction }
    );

    // Handle changes in advance payment
    if (newAdvance !== originalAdvance) {
      // Find existing advance payment
      const existingAdvancePayment = await Payment.findOne({
        where: {
          order_id: id,
          payment_type: "ADVANCE",
        },
        transaction,
      });

      if (existingAdvancePayment) {
        // Update existing advance payment
        await existingAdvancePayment.update(
          {
            amount: newAdvance,
            payment_date: order_date || existingAdvancePayment.payment_date,
          },
          { transaction }
        );
      } else if (newAdvance > 0) {
        // Create new advance payment if none exists and amount > 0
        await Payment.create(
          {
            order_id: id,
            customer_id: customer_id || order.customer_id,
            amount: newAdvance,
            payment_date: order_date || new Date(),
            payment_method: "CASH",
            payment_type: "ADVANCE",
            notes: "Advance payment updated",
          },
          { transaction }
        );
      }
    }

    // Update product sizes if provided
    if (product_sizes && product_sizes.length > 0) {
      // Delete existing order product sizes
      await OrderProductSize.destroy({
        where: { order_id: id },
        transaction,
      });

      // Create new order product sizes
      for (const ps of product_sizes) {
        if (!ps.product_size_id || !ps.quantity_kg) {
          await transaction.rollback();
          return error(res, 400, "Product size ID and quantity are required");
        }

        // Get the current rate for this product size
        const productSize = await ProductSize.findByPk(ps.product_size_id);
        if (!productSize) {
          await transaction.rollback();
          return error(res, 400, "Invalid product size ID");
        }

        await OrderProductSize.create(
          {
            order_id: id,
            product_size_id: ps.product_size_id,
            quantity_kg: ps.quantity_kg,
            rate_per_kg: productSize.rate_per_kg, // Store the current rate
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    // Fetch the updated order with associations
    const updatedOrder = await Order.findOne({
      where: {
        id,
        is_archived: false,
      },
      include: [
        {
          model: Customer,
          as: "customer",
          where: {
            is_archived: false,
          },
        },
        {
          model: PlateType,
          as: "plateType",
          where: {
            is_archived: false,
          },
        },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          include: [
            {
              model: ProductSize,
              as: "productSize",
              where: {
                is_archived: false,
              },
            },
          ],
        },
        {
          model: Payment,
          as: "payments",
          required: false,
        },
      ],
    });

    return success(res, 200, "Order updated successfully", updatedOrder);
  } catch (err) {
    await transaction.rollback();
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
