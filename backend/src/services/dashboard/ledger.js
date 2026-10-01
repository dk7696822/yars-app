"use strict";

/**
 * Live orders with everything money needs. Every include is required:false so
 * no order or line is ever dropped because a size/customer/plate was archived.
 */
const loadOrders = async (models, where = { is_archived: false }, { transaction } = {}) => {
  const { Order, Customer, PlateType, OrderProductSize, ProductSize, Payment } = models;
  const rows = await Order.findAll({
    where,
    transaction,
    attributes: ["id", "customer_id", "order_date", "created_at", "status", "custom_plate_charge", "round_off_amount", "advance_received", "invoice_id", "is_archived"],
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "metadata"], required: false },
      { model: PlateType, as: "plateType", attributes: ["charge", "type_name"], required: false },
      {
        model: OrderProductSize, as: "orderProductSizes", required: false,
        include: [{ model: ProductSize, as: "productSize", attributes: ["rate_per_kg", "size_label"], required: false }],
      },
      {
        model: Payment, as: "payments", required: false,
        attributes: ["id", "amount", "payment_type", "payment_date", "payment_method", "reference_number", "notes", "invoice_id"],
      },
    ],
  });
  return rows.map((r) => {
    const o = r.toJSON();
    return { ...o, customerName: o.customer?.name || "Unknown customer", customerPhone: o.customer?.metadata?.phone || null };
  });
};

/** One read of everything the dashboard needs. */
const loadLedger = async (models) => {
  const { Order, Payment, Expense, ExpenseCategory } = models;
  const orders = await loadOrders(models);

  const deletedOrderPayments = await Payment.findAll({
    attributes: ["amount", "payment_date"],
    include: [{ model: Order, as: "order", attributes: [], where: { is_archived: true }, required: true }],
    raw: true,
  });

  // Payments recorded against no order (invoice-only) — never part of Collected,
  // but reported so money received can't disappear silently.
  const unlinkedPayments = await Payment.findAll({ where: { order_id: null }, attributes: ["amount", "payment_date"], raw: true });

  const expenses = (
    await Expense.findAll({
      where: { is_archived: false },
      attributes: ["bill_date", "total_cost"],
      include: [{ model: ExpenseCategory, as: "category", attributes: ["name"], required: false }],
    })
  ).map((e) => {
    const x = e.toJSON();
    return { bill_date: x.bill_date, total_cost: x.total_cost, categoryName: x.category?.name || "Uncategorised" };
  });

  const dates = [
    ...orders.map((o) => o.order_date),
    ...orders.flatMap((o) => (o.payments || []).map((p) => p.payment_date)),
    ...expenses.map((e) => e.bill_date),
  ].filter(Boolean).sort();

  return { orders, deletedOrderPayments, unlinkedPayments, expenses, earliest: dates[0] || null, latest: dates[dates.length - 1] || null };
};

module.exports = { loadLedger, loadOrders };
