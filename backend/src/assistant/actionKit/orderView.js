"use strict";

const { loadOrders } = require("../../services/dashboard/ledger");
const { toOrderRow } = require("../../services/lists/orderList");
const { isCounted } = require("../../services/orderFacts");
const { dayText, itemsText } = require("../format");

/** One live order as the screens show it (total / received / due from orderFacts), optionally inside a transaction. */
const orderView = async (models, id, transaction) => {
  const [order] = await loadOrders(models, { id, is_archived: false }, { transaction });
  if (!order) return null;
  const row = toOrderRow(order);
  return { order, row, label: `${dayText(row.orderDate)} · ${itemsText(row.items)}`, counted: isCounted(order) };
};

module.exports = { orderView };
