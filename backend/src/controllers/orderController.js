"use strict";

const { Order, Customer, PlateType, ProductSize, OrderProductSize, sequelize } = require("../models");
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
    const { customerName, dateFrom, dateTo, date, status } = req.query;

    // Build the where clause for Order
    const orderWhere = {
      is_archived: false,
    };

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

      // Subtract advance
      const advanceReceived = parseFloat(orderData.advance_received);

      // Calculate total receivable
      const totalReceivable = totalProductAmount + plateCharge - advanceReceived;

      return {
        ...orderData,
        totalReceivable: parseFloat(totalReceivable.toFixed(2)),
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

    // Subtract advance
    const advanceReceived = parseFloat(orderData.advance_received);

    // Calculate total receivable
    const totalReceivable = totalProductAmount + plateCharge - advanceReceived;

    const orderWithTotal = {
      ...orderData,
      totalReceivable: parseFloat(totalReceivable.toFixed(2)),
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

    // Update order details
    await order.update(
      {
        customer_id: customer_id || order.customer_id,
        order_date: order_date || order.order_date,
        advance_received: advance_received !== undefined ? advance_received : order.advance_received,
        plate_type_id: plate_type_id || order.plate_type_id,
        status: status || order.status,
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
