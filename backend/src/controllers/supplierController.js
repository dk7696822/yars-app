"use strict";

const { Supplier, PurchaseOrder, GoodsReceipt } = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { Op } = require("sequelize");

const createSupplier = async (req, res) => {
  try {
    const { phone, email, gst_number, address } = req.body;
    const name = typeof req.body.name === "string" ? req.body.name.trim() : req.body.name;

    if (!name) {
      return error(res, 400, "Supplier name is required");
    }

    // No duplicate-name check on purpose: real suppliers can share a name.
    const supplier = await Supplier.create({
      name,
      phone: phone || null,
      email: email || null,
      gst_number: gst_number || null,
      address: address || null,
    });

    return success(res, 201, "Supplier created successfully", supplier);
  } catch (err) {
    console.error("Error creating supplier:", err);
    return error(res, 500, "Failed to create supplier", err.message);
  }
};

const getAllSuppliers = async (req, res) => {
  try {
    const { search, all } = req.query;
    const whereClause = { is_archived: false };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { gst_number: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // `all=true` skips pagination — used to populate dropdowns.
    if (all === "true") {
      const suppliers = await Supplier.findAll({ where: whereClause, order: [["name", "ASC"]] });
      return success(res, 200, "Suppliers retrieved successfully", suppliers);
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await Supplier.findAndCountAll({
      where: whereClause,
      order: [["name", "ASC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return success(
      res,
      200,
      "Suppliers retrieved successfully",
      buildPaginatedResponse(rows, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving suppliers:", err);
    return error(res, 500, "Failed to retrieve suppliers", err.message);
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrders",
          where: { is_archived: false },
          required: false,
          separate: true,
          order: [["order_date", "DESC"]],
          limit: 20,
        },
      ],
    });

    if (!supplier) {
      return error(res, 404, "Supplier not found");
    }

    return success(res, 200, "Supplier retrieved successfully", supplier);
  } catch (err) {
    console.error("Error retrieving supplier:", err);
    return error(res, 500, "Failed to retrieve supplier", err.message);
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { phone, email, gst_number, address } = req.body;
    const name = typeof req.body.name === "string" ? req.body.name.trim() : req.body.name;

    const supplier = await Supplier.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!supplier) {
      return error(res, 404, "Supplier not found");
    }

    if (!name) {
      return error(res, 400, "Supplier name is required");
    }

    // `undefined` leaves a field alone; an explicit null CLEARS it.
    await supplier.update({
      name,
      phone: phone !== undefined ? phone : supplier.phone,
      email: email !== undefined ? email : supplier.email,
      gst_number: gst_number !== undefined ? gst_number : supplier.gst_number,
      address: address !== undefined ? address : supplier.address,
    });

    return success(res, 200, "Supplier updated successfully", supplier);
  } catch (err) {
    console.error("Error updating supplier:", err);
    return error(res, 500, "Failed to update supplier", err.message);
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findOne({ where: { id, is_archived: false } });

    if (!supplier) {
      return error(res, 404, "Supplier not found");
    }

    // Check-then-act race tolerated: single-user app, worst case is a stale refusal.
    const poCount = await PurchaseOrder.count({ where: { supplier_id: id, is_archived: false } });
    const receiptCount = await GoodsReceipt.count({ where: { supplier_id: id, is_archived: false } });

    if (poCount > 0 || receiptCount > 0) {
      return error(
        res,
        409,
        "Cannot delete this supplier as it is being used by purchase orders or goods receipts"
      );
    }

    await supplier.update({ is_archived: true });

    return success(res, 200, "Supplier deleted successfully");
  } catch (err) {
    console.error("Error deleting supplier:", err);
    return error(res, 500, "Failed to delete supplier", err.message);
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};
