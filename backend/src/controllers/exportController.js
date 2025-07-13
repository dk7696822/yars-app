"use strict";

const { Order, Customer, OrderProductSize, ProductSize, PlateType, Payment, Expense, ExpenseCategory, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const XLSX = require("xlsx");

const exportDashboardData = async (req, res) => {
  try {
    const { customer_id, from_date, to_date, status, payment_status, plate_type_id, search } = req.query;

    let whereClause = {
      is_archived: false,
    };

    if (customer_id && customer_id !== "undefined" && customer_id !== "null" && customer_id.trim() !== "") {
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

    if (status && status !== "undefined" && status !== "null" && status.trim() !== "") {
      whereClause.status = status;
    }

    if (plate_type_id && plate_type_id !== "undefined" && plate_type_id !== "null" && plate_type_id.trim() !== "") {
      whereClause.plate_type_id = plate_type_id;
    }

    if (search && search !== "undefined" && search !== "null" && search.trim() !== "") {
      whereClause[Op.or] = [{ "$customer.name$": { [Op.iLike]: `%${search}%` } }, sequelize.literal(`"customer"."metadata"->>'company_name' ILIKE '%${search.replace(/'/g, "''")}%'`)];
    }

    let paymentWhereClause = {};
    if (payment_status && payment_status !== "undefined" && payment_status !== "null" && payment_status.trim() !== "") {
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

    const finalWhereClause = { ...whereClause, ...paymentWhereClause };

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

    const excelData = [];
    let grandTotalAmount = 0;
    let grandTotalQuantity = 0;
    let grandTotalReceivable = 0;

    for (const order of orders) {
      let productAmount = 0;
      for (const item of order.orderProductSizes) {
        const itemTotal = parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg);
        productAmount += itemTotal;
      }

      const plateCharge = parseFloat(order.custom_plate_charge || order.plateType.charge);

      const roundOffAmount = parseFloat(order.round_off_amount || 0);

      const totalOrderAmount = productAmount + plateCharge - roundOffAmount;

      const totalPaid = order.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const remainingAmount = totalOrderAmount - totalPaid;

      const orderTotalQuantity = order.orderProductSizes.reduce((sum, item) => sum + parseFloat(item.quantity_kg), 0);

      grandTotalAmount += totalOrderAmount;
      grandTotalQuantity += orderTotalQuantity;
      grandTotalReceivable += remainingAmount;

      let paymentStatusText = "PENDING";
      if (totalPaid >= totalOrderAmount) {
        paymentStatusText = "PAID";
      } else if (totalPaid > 0) {
        paymentStatusText = "PARTIAL";
      }

      const baseRowData = {
        "Order ID": order.id,
        "Order Date": new Date(order.order_date).toLocaleDateString(),
        "Customer Name": order.customer.name,
        "Company Name": order.customer.metadata?.company_name || "",
        "Customer Phone": order.customer.metadata?.phone || "",
        "Customer Email": order.customer.metadata?.email || "",
        "Order Status": order.status,
        "Payment Status": paymentStatusText,
        "Plate Type": order.plateType.type_name,
        "Plate Charge": plateCharge,
        "Custom Plate Charge": order.custom_plate_charge ? "Yes" : "No",
        "Round Off Amount": roundOffAmount,
        "Product Amount": productAmount,
        "Total Order Amount": totalOrderAmount,
        "Advance Received": parseFloat(order.advance_received || 0),
        "Total Paid": totalPaid,
        "Remaining Amount": remainingAmount,
        "Created At": new Date(order.created_at).toLocaleDateString(),
      };

      if (order.orderProductSizes.length > 0) {
        for (let i = 0; i < order.orderProductSizes.length; i++) {
          const item = order.orderProductSizes[i];
          const rowData = { ...baseRowData };

          rowData["Product Size"] = item.productSize.size_label;
          rowData["Product Category"] = item.productSize.category || "";
          rowData["Quantity (kg)"] = parseFloat(item.quantity_kg);
          rowData["Rate per kg"] = parseFloat(item.rate_per_kg);
          rowData["Custom Rate"] = item.rate_per_kg !== item.productSize.rate_per_kg ? "Yes" : "No";
          rowData["Product Line Total"] = parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg);

          excelData.push(rowData);
        }
      } else {
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

    excelData.push({});
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

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const columnWidths = [
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
    ];
    worksheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders Data");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

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

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);

    res.send(excelBuffer);
  } catch (err) {
    console.error("Error exporting dashboard data:", err);
    return error(res, 500, "Failed to export data", err.message);
  }
};

const exportExpensesData = async (req, res) => {
  try {
    const { category_id, from_date, to_date, payment_status, vendor, search } = req.query;

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

    const excelData = [];
    let grandTotalExpense = 0;

    for (const expense of expenses) {
      const totalCost = parseFloat(expense.total_cost);
      grandTotalExpense += totalCost;

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

    excelData.push({});
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

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const columnWidths = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    worksheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses Data");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

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

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);

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
