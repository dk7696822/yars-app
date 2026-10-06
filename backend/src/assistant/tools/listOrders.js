"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { isoDate } = require("./fields");
const { loadOrders } = require("../../services/dashboard/ledger");
const { buildOrderList, ListError } = require("../../services/lists/orderList");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { formatOrderList } = require("./orderListText");

module.exports = defineTool({
  name: "list_orders",
  description: "Orders as the Orders screen lists them: count, total and due (cancelled not counted) and the orders, newest first. Optional from/to dates, filter due or in_progress, search (customer or size). Use for 'orders in August'.",
  input: z.object({
    from: isoDate().optional(),
    to: isoDate().optional(),
    filter: z.enum(["all", "due", "in_progress"]).optional(),
    search: z.string().optional(),
  }),
  run: async ({ from, to, filter = "all", search }) => {
    let out;
    try {
      out = buildOrderList(await loadOrders(models), { chip: filter, search, from, to, limit: "100" }, todayIST());
    } catch (err) {
      if (err instanceof ListError) return err.message;
      throw err;
    }
    return formatOrderList(out, { from, to });
  },
});
