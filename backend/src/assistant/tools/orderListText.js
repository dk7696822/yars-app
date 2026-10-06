"use strict";

const { rupee, itemsText, ORDER_STATUS_LABEL } = require("../format");

const MAX_ROWS = 25;

/** The Orders screen's list as text: its own summary line, then up to 25 orders and a link to the rest. */
const formatOrderList = (out, { from, to } = {}) => {
  const s = out.summary;
  const head = `${s.count} orders · total ${rupee(s.total)} · due ${rupee(s.due)}${s.cancelled ? ` · ${s.cancelled} cancelled, not counted` : ""}`;
  const rows = out.rows.slice(0, MAX_ROWS).map((r) =>
    `${r.orderDate} | ${r.customer.name} | ${itemsText(r.items)} | ${r.cancelled ? "Cancelled (not counted)" : ORDER_STATUS_LABEL[r.status] || r.status} | total ${rupee(r.total)} | due ${rupee(r.due)}`);
  const more = out.rows.length - MAX_ROWS;
  const link = from && to ? `/orders?period=custom&from=${from}&to=${to}` : "/orders";
  return [head, ...rows, ...(more > 0 ? [`…and ${more} more: [Orders](${link})`] : [])].join("\n");
};

module.exports = { formatOrderList, MAX_ROWS };
