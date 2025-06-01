"use strict";

const { Order, Customer, OrderProductSize, ProductSize, PlateType, Payment, Expense, ExpenseCategory, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const XLSX = require("xlsx");

/**
 * Export dashboard data to Excel
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const exportDashboardData = async (req, res) => {
  try {
    const { customer_id, from_date, to_date, status, payment_status, plate_type_id, search } = req.query;

    // Build where clause for filtering (same logic as dashboard)
    let whereClause = {
      is_archived: false,
    };

    if (customer_id) {
      whereClause.customer_id = customer_id;
    }

    if (from_date && to_date) {
      whereClause.order_date = {
        [Op.between]: [from_date, to_date],
      };
    } else if (from_date) {
      whereClause.order_date = {
        [Op.gte]: from_date,
      };
    } else if (to_date) {
      whereClause.order_date = {
        [Op.lte]: to_date,
      };
    }

    if (status) {
      whereClause.status = status;
    }

    if (plate_type_id) {
      whereClause.plate_type_id = plate_type_id;
    }

    if (search) {
      whereClause[Op.or] = [{ "$customer.name$": { [Op.iLike]: `%${search}%` } }, { "$customer.company_name$": { [Op.iLike]: `%${search}%` } }];
    }

    // Payment status filter
    let paymentWhereClause = {};
    if (payment_status) {
      if (payment_status === "PAID") {
        paymentWhereClause = {
          [Op.and]: [
            sequelize.literal(`(
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.order_id = "Order".id
            ) >= "Order".total_amount`),
          ],
        };
      } else if (payment_status === "PARTIAL") {
        paymentWhereClause = {
          [Op.and]: [
            sequelize.literal(`(
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.order_id = "Order".id
            ) > 0`),
            sequelize.literal(`(
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.order_id = "Order".id
            ) < "Order".total_amount`),
          ],
        };
      } else if (payment_status === "PENDING") {
        paymentWhereClause = {
          [Op.and]: [
            sequelize.literal(`(
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.order_id = "Order".id
            ) = 0`),
          ],
        };
      }
    }

    // Combine where clauses
    const finalWhereClause = { ...whereClause, ...paymentWhereClause };

    // Fetch orders with all related data
    const orders = await Order.findAll({
      where: finalWhereClause,
      include: [
        { model: Customer, as: "customer" },
        { model: PlateType, as: "plateType" },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          include: [{ model: ProductSize, as: "productSize" }],
        },
        {
          model: Payment,
          as: "payments",
          required: false,
        },
      ],
      order: [["order_date", "DESC"]],
    });

    // Prepare data for Excel export
    const excelData = [];

    // Calculate totals for summary
    let grandTotalAmount = 0;
    let grandTotalQuantity = 0;
    let grandTotalReceivable = 0;

    for (const order of orders) {
      // Calculate totals for this order
      let productAmount = 0;
      for (const item of order.orderProductSizes) {
        const itemTotal = parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg);
        productAmount += itemTotal;
      }

      const plateCharge = parseFloat(order.custom_plate_charge || order.plateType.charge);
      const totalOrderAmount = productAmount + plateCharge;

      // Calculate payments
      const totalPaid = order.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const remainingAmount = totalOrderAmount - totalPaid;

      // Calculate total quantity for this order
      const orderTotalQuantity = order.orderProductSizes.reduce((sum, item) => sum + parseFloat(item.quantity_kg), 0);

      // Add to grand totals
      grandTotalAmount += totalOrderAmount;
      grandTotalQuantity += orderTotalQuantity;
      grandTotalReceivable += remainingAmount;

      // Determine payment status
      let paymentStatusText = "PENDING";
      if (totalPaid >= totalOrderAmount) {
        paymentStatusText = "PAID";
      } else if (totalPaid > 0) {
        paymentStatusText = "PARTIAL";
      }

      // Create base row data
      const baseRowData = {
        "Order ID": order.id,
        "Order Date": new Date(order.order_date).toLocaleDateString(),
        "Customer Name": order.customer.name,
        "Company Name": order.customer.company_name || "",
        "Customer Phone": order.customer.phone || "",
        "Customer Email": order.customer.email || "",
        "Order Status": order.status,
        "Payment Status": paymentStatusText,
        "Plate Type": order.plateType.type_name,
        "Plate Charge": plateCharge,
        "Custom Plate Charge": order.custom_plate_charge ? "Yes" : "No",
        "Product Amount": productAmount,
        "Total Order Amount": totalOrderAmount,
        "Advance Received": parseFloat(order.advance_received || 0),
        "Total Paid": totalPaid,
        "Remaining Amount": remainingAmount,
        "Created At": new Date(order.created_at).toLocaleDateString(),
      };

      // Add product details
      if (order.orderProductSizes.length > 0) {
        for (let i = 0; i < order.orderProductSizes.length; i++) {
          const item = order.orderProductSizes[i];
          const rowData = { ...baseRowData };

          // Add product-specific data
          rowData["Product Size"] = item.productSize.size_label;
          rowData["Product Category"] = item.productSize.category || "";
          rowData["Quantity (kg)"] = parseFloat(item.quantity_kg);
          rowData["Rate per kg"] = parseFloat(item.rate_per_kg);
          rowData["Custom Rate"] = item.rate_per_kg !== item.productSize.rate_per_kg ? "Yes" : "No";
          rowData["Product Line Total"] = parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg);

          excelData.push(rowData);
        }
      } else {
        // If no product sizes, add the base row
        excelData.push({
          ...baseRowData,
          "Product Size": "",
          "Product Category": "",
          "Quantity (kg)": 0,
          "Rate per kg": 0,
          "Custom Rate": "No",
          "Product Line Total": 0,
        });
      }
    }

    // Add summary totals at the end
    excelData.push({}); // Empty row for separation
    excelData.push({
      "Order ID": "SUMMARY TOTALS",
      "Order Date": "",
      "Customer Name": "",
      "Company Name": "",
      "Customer Phone": "",
      "Customer Email": "",
      "Order Status": "",
      "Payment Status": "",
      "Plate Type": "",
      "Plate Charge": "",
      "Custom Plate Charge": "",
      "Product Amount": "",
      "Total Order Amount": grandTotalAmount,
      "Advance Received": "",
      "Total Paid": "",
      "Remaining Amount": grandTotalReceivable,
      "Created At": "",
      "Product Size": "",
      "Product Category": "",
      "Quantity (kg)": grandTotalQuantity,
      "Rate per kg": "",
      "Custom Rate": "",
      "Product Line Total": "",
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 15 }, // Order ID
      { wch: 12 }, // Order Date
      { wch: 20 }, // Customer Name
      { wch: 20 }, // Company Name
      { wch: 15 }, // Customer Phone
      { wch: 25 }, // Customer Email
      { wch: 12 }, // Order Status
      { wch: 15 }, // Payment Status
      { wch: 15 }, // Plate Type
      { wch: 12 }, // Plate Charge
      { wch: 15 }, // Custom Plate Charge
      { wch: 15 }, // Product Amount
      { wch: 18 }, // Total Order Amount
      { wch: 15 }, // Advance Received
      { wch: 12 }, // Total Paid
      { wch: 15 }, // Remaining Amount
      { wch: 12 }, // Created At
      { wch: 20 }, // Product Size
      { wch: 15 }, // Product Category
      { wch: 12 }, // Quantity (kg)
      { wch: 12 }, // Rate per kg
      { wch: 12 }, // Custom Rate
      { wch: 15 }, // Product Line Total
    ];
    worksheet["!cols"] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders Data");

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Generate filename with current date and filters
    const currentDate = new Date().toISOString().split("T")[0];
    let filename = `YARS_Orders_${currentDate}`;

    if (from_date || to_date) {
      filename += `_${from_date || "start"}_to_${to_date || "end"}`;
    }
    if (customer_id) {
      filename += `_customer_${customer_id}`;
    }
    if (status) {
      filename += `_${status}`;
    }
    if (payment_status) {
      filename += `_${payment_status}`;
    }

    filename += ".xlsx";

    // Set response headers for Excel download
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);

    // Send the Excel file
    res.send(excelBuffer);
  } catch (err) {
    console.error("Error exporting dashboard data:", err);
    return error(res, 500, "Failed to export data", err.message);
  }
};

/**
 * Export expenses data to Excel
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const exportExpensesData = async (req, res) => {
  try {
    const { category_id, from_date, to_date, payment_status, vendor, search } = req.query;

    // Build where clause for filtering (same logic as expenses controller)
    let whereClause = {
      is_archived: false,
    };

    if (category_id) {
      whereClause.category_id = category_id;
    }

    if (from_date && to_date) {
      whereClause.bill_date = {
        [Op.between]: [from_date, to_date],
      };
    } else if (from_date) {
      whereClause.bill_date = {
        [Op.gte]: from_date,
      };
    } else if (to_date) {
      whereClause.bill_date = {
        [Op.lte]: to_date,
      };
    }

    if (payment_status) {
      whereClause.payment_status = payment_status;
    }

    if (vendor) {
      whereClause.vendor = {
        [Op.iLike]: `%${vendor}%`,
      };
    }

    if (search) {
      whereClause[Op.or] = [{ description: { [Op.iLike]: `%${search}%` } }, { vendor: { [Op.iLike]: `%${search}%` } }];
    }

    // Fetch expenses with all related data
    const expenses = await Expense.findAll({
      where: whereClause,
      include: [
        {
          model: ExpenseCategory,
          as: "category",
          where: {
            is_archived: false,
          },
        },
      ],
      order: [["bill_date", "DESC"]],
    });

    // Prepare data for Excel export
    const excelData = [];

    // Calculate totals for summary
    let grandTotalExpense = 0;

    for (const expense of expenses) {
      const totalCost = parseFloat(expense.total_cost);
      grandTotalExpense += totalCost;

      // Create row data
      const rowData = {
        "Expense ID": expense.id,
        "Bill Date": new Date(expense.bill_date).toLocaleDateString(),
        Category: expense.category.name,
        Vendor: expense.vendor || "",
        Description: expense.description || "",
        "Bill Number": expense.bill_number || "",
        "Total Cost": totalCost,
        "Payment Status": expense.payment_status,
        "Due Date": expense.due_date ? new Date(expense.due_date).toLocaleDateString() : "",
        "Created At": new Date(expense.created_at).toLocaleDateString(),
        "Updated At": new Date(expense.updated_at).toLocaleDateString(),
      };

      excelData.push(rowData);
    }

    // Add summary totals at the end
    excelData.push({}); // Empty row for separation
    excelData.push({
      "Expense ID": "SUMMARY TOTALS",
      "Bill Date": "",
      Category: "",
      Vendor: "",
      Description: "",
      "Bill Number": "",
      "Total Cost": grandTotalExpense,
      "Payment Status": "",
      "Due Date": "",
      "Created At": "",
      "Updated At": "",
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 15 }, // Expense ID
      { wch: 12 }, // Bill Date
      { wch: 20 }, // Category
      { wch: 20 }, // Vendor
      { wch: 30 }, // Description
      { wch: 15 }, // Bill Number
      { wch: 15 }, // Total Cost
      { wch: 15 }, // Payment Status
      { wch: 12 }, // Due Date
      { wch: 12 }, // Created At
      { wch: 12 }, // Updated At
    ];
    worksheet["!cols"] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses Data");

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Generate filename with current date and filters
    const currentDate = new Date().toISOString().split("T")[0];
    let filename = `YARS_Expenses_${currentDate}`;

    if (from_date || to_date) {
      filename += `_${from_date || "start"}_to_${to_date || "end"}`;
    }
    if (category_id) {
      filename += `_category_${category_id}`;
    }
    if (payment_status) {
      filename += `_${payment_status}`;
    }
    if (vendor) {
      filename += `_vendor_${vendor.replace(/\s+/g, "_")}`;
    }

    filename += ".xlsx";

    // Set response headers for Excel download
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);

    // Send the Excel file
    res.send(excelBuffer);
  } catch (err) {
    console.error("Error exporting expenses data:", err);
    return error(res, 500, "Failed to export expenses data", err.message);
  }
};

module.exports = {
  exportDashboardData,
  exportExpensesData,
};
