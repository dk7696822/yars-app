"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { recordId } = require("./fields");
const { findSimilar } = require("../../services/customerSimilar");
const { loadOrders } = require("../../services/dashboard/ledger");
const { toOrderRow } = require("../../services/lists/orderList");
const { rupee, itemsText, capLines, ORDER_STATUS_LABEL } = require("../format");

const digits = (s) => String(s || "").replace(/\D/g, "");
const squashSize = (s) => String(s || "").toLowerCase().replace(/[×*]/g, "x").replace(/[^a-z0-9.]/g, "");

const customers = async (text) => {
  if (!text.trim()) return "Give a name or phone number to look for.";
  const all = (await models.Customer.findAll({ where: { is_archived: false }, attributes: ["id", "name", "metadata"] })).map((c) => c.toJSON());
  const d = digits(text);
  const byPhone = d.length >= 4 ? all.filter((c) => digits(c.metadata?.phone).includes(d)) : [];
  const seen = new Set();
  const list = [...byPhone, ...findSimilar(text, all, null, 5)].filter((c) => !seen.has(c.id) && seen.add(c.id)).slice(0, 5);
  if (!list.length) return `No customer matches "${text}".`;
  return list.map((c) => [c.id, c.name, c.metadata?.phone || "no phone", c.metadata?.city].filter(Boolean).join(" | ")).join("\n");
};

const sizes = async (text) => {
  const all = await models.ProductSize.findAll({ where: { is_archived: false }, order: [["size_label", "ASC"]] });
  const q = squashSize(text);
  const list = q ? all.filter((s) => squashSize(s.size_label).includes(q)) : all;
  if (!list.length) return `No size matches "${text}". Call find with kind size and no text to list them all.`;
  const line = (s) => {
    const rate = Number(s.rate_per_kg) > 0 ? `rate/kg ${rupee(s.rate_per_kg)}` : "rate/kg not saved";
    const pcs = s.piece_price_amount != null ? `pcs price ${rupee(s.piece_price_amount)} per ${s.piece_price_count}` : "pcs price not saved";
    return `${s.id} | ${s.size_label} | ${rate} | ${pcs}`;
  };
  return capLines(list.map(line), 25).join("\n");
};

const plates = async () => {
  const all = await models.PlateType.findAll({ where: { is_archived: false }, order: [["type_name", "ASC"]] });
  return all.map((p) => `${p.id} | ${p.type_name} | ${rupee(p.charge)}`).join("\n") || "No plate types are saved.";
};

const orders = async (customerId) => {
  if (!customerId) return "Give customer_id (from find with kind customer) to list that customer's orders.";
  const rows = (await loadOrders(models, { is_archived: false, customer_id: customerId }))
    .map(toOrderRow)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || new Date(b.createdAt) - new Date(a.createdAt));
  if (!rows.length) return "This customer has no orders.";
  const line = (r) => `${r.id} | ${r.orderDate} | ${itemsText(r.items)} | ${ORDER_STATUS_LABEL[r.status] || r.status} | total ${rupee(r.total)} | due ${rupee(r.due)}`;
  return capLines(rows.map(line), 10).join("\n");
};

module.exports = defineTool({
  name: "find",
  description:
    "Look up ids. kind customer: text is a name or phone. kind size: text is a label like 12 x 16 (empty lists all). kind plate: lists all. kind order: customer_id lists that customer's orders, newest first, with due.",
  input: z.object({ kind: z.enum(["customer", "size", "plate", "order"]), text: z.string().optional(), customer_id: recordId().optional() }),
  run: ({ kind, text = "", customer_id }) => {
    if (kind === "customer") return customers(text);
    if (kind === "size") return sizes(text);
    if (kind === "plate") return plates();
    return orders(customer_id);
  },
});
