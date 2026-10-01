"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { ActionError } = require("../actionKit/errors");
const { orderView } = require("../actionKit/orderView");
const { recordId, isoDate, money } = require("../tools/fields");
const { lineAmount } = require("../../services/orderMath");
const { rupee, dayText } = require("../format");
const command = require("../../commands/orders/createOrder");
const { saidNumber, notSaid } = require("../actionKit/grounding");

const count = () => z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v), z.number().positive());

const lineText = (l) =>
  l.unit === "PIECES"
    ? `${l.quantity_pieces} pcs at ${rupee(l.price_amount)} per ${l.price_pieces_count} = ${rupee(lineAmount(l))}`
    : `${Number(l.quantity_kg)} kg × ${rupee(l.rate_per_kg)} = ${rupee(lineAmount(l))}`;

module.exports = defineAction({
  name: "create_order",
  area: "orders",
  summary: "a new order with kg or pieces lines",
  description:
    "Card for a new order. Ids from find. Each line: size_id, unit KG or PIECES, quantity (kg or pcs). rate_per_kg or price + price_per (e.g. 375 per 1000 pcs) only when the person gives one; otherwise the size's saved price is used.",
  input: z.object({
    customer_id: recordId(),
    plate_type_id: recordId(),
    lines: z.array(z.object({
      size_id: recordId(),
      unit: z.enum(["KG", "PIECES"]),
      quantity: count().describe("kg, or number of pieces"),
      rate_per_kg: money().optional().describe("₹ per kg, only if the person said one"),
      price: money().optional().describe("pieces: ₹ for price_per pieces, as said: '400 per 1000' → 400"),
      price_per: count().optional().describe("pieces: how many pieces that price is for: '400 per 1000' → 1000"),
    })).min(1),
    order_date: isoDate().optional(),
    advance: money().optional(),
    custom_plate_charge: money().optional(),
  }),
  trialRunSafe: true,
  command,
  grounded: (args, { userText, resolved }) => {
    // "0.6 per piece" / "0.6 each" is a price for 1 piece, though no "1" was typed.
    const perPiece = /\b(?:per|a|each|every)\s+(?:piece|pc|pcs|bag)\b|\beach\b/i.test(userText);
    // Spelling out the size's own saved rate or piece price is not inventing one.
    const saved = (l) => resolved.saved[l.size_id] || {};
    const same = (a, b) => b !== null && b !== undefined && Math.abs(Number(a) - Number(b)) < 0.005;
    const given = [
      ...args.lines.flatMap((l) => {
        const s = saved(l);
        const savedPrice = same(l.price, s.price) && same(l.price_per, s.per);
        return [
          l.quantity,
          same(l.rate_per_kg, s.rate) ? undefined : l.rate_per_kg,
          savedPrice ? undefined : l.price,
          savedPrice || (l.price_per === 1 && perPiece) ? undefined : l.price_per,
        ];
      }),
      args.advance,
      args.custom_plate_charge,
    ].filter((v) => v !== undefined);
    const invented = given.find((v) => !saidNumber(userText, v));
    return invented === undefined ? null : notSaid(String(invented));
  },
  resolve: async (args, { models, today }) => {
    const customer = await models.Customer.findOne({ where: { id: args.customer_id, is_archived: false } });
    if (!customer) throw new ActionError("No customer has that id. Use find with kind customer.");
    const plate = await models.PlateType.findOne({ where: { id: args.plate_type_id, is_archived: false } });
    if (!plate) throw new ActionError("No plate type has that id. Use find with kind plate.");

    const lines = [];
    const saved = {};
    for (const [i, l] of args.lines.entries()) {
      const n = `Line ${i + 1}`;
      const size = await models.ProductSize.findOne({ where: { id: l.size_id, is_archived: false } });
      if (!size) throw new ActionError(`${n}: no size has that id. Use find with kind size.`);
      saved[size.id] = {
        rate: Number(size.rate_per_kg) > 0 ? Number(size.rate_per_kg) : null,
        price: size.piece_price_amount != null ? Number(size.piece_price_amount) : null,
        per: size.piece_price_count,
      };
      if (l.unit === "KG") {
        // A saved ₹0 rate means "no rate saved", as on the order form.
        const rate = l.rate_per_kg ?? (Number(size.rate_per_kg) > 0 ? Number(size.rate_per_kg) : null);
        if (rate === null) throw new ActionError(`${n}: ${size.size_label} has no rate per kg saved — ask the person for the rate.`);
        lines.push({ product_size_id: size.id, unit: "KG", quantity_kg: l.quantity, rate_per_kg: rate });
        continue;
      }
      if (!Number.isInteger(l.quantity)) throw new ActionError(`${n}: pieces must be a whole number.`);
      let price;
      if (l.price !== undefined || l.price_per !== undefined) {
        if (l.price === undefined || l.price_per === undefined) throw new ActionError(`${n}: give the piece price as an amount for a number of pieces, like ₹375 for 1000 pcs.`);
        price = { price_amount: l.price, price_pieces_count: l.price_per };
      } else if (size.piece_price_amount != null) {
        price = { price_amount: Number(size.piece_price_amount), price_pieces_count: size.piece_price_count };
      } else {
        throw new ActionError(`${n}: ${size.size_label} has no piece price saved — ask the person for the price.`);
      }
      lines.push({ product_size_id: size.id, unit: "PIECES", quantity_pieces: l.quantity, ...price });
    }

    return {
      customer: { id: customer.id, name: customer.name, phone: customer.metadata?.phone || null },
      plate,
      lines,
      saved,
      date: args.order_date || today,
      advance: args.advance || 0,
      customPlateCharge: args.custom_plate_charge ?? null,
    };
  },
  // Every field the order form sends, defaults included, so "open in form, save unchanged" compares equal.
  toCommandInput: (r) => ({
    customer_id: r.customer.id,
    plate_type_id: r.plate.id,
    order_date: r.date,
    status: "PENDING",
    round_off_amount: 0,
    advance_received: r.advance,
    custom_plate_charge: r.customPlateCharge,
    product_sizes: r.lines,
  }),
  preview: async (r, { models, transaction, result }) => {
    const view = await orderView(models, result.id, transaction);
    const saved = view.order.orderProductSizes || [];
    return {
      title: `New order for ${r.customer.name}`,
      rows: [
        { label: "Customer", value: r.customer.name },
        { label: "Date", value: dayText(r.date) },
        { label: "Plate", value: `${r.plate.type_name} · ${rupee(r.customPlateCharge ?? r.plate.charge)}` },
        ...saved.map((l) => ({ label: l.productSize?.size_label || "Size", value: lineText(l) })),
        { label: "Total", value: rupee(view.row.total) },
        ...(r.advance ? [{ label: "Advance", value: rupee(r.advance) }] : []),
        { label: "Due", value: rupee(view.row.due) },
      ],
      warnings: view.row.due < 0 ? [`That's ${rupee(-view.row.due)} more than the total. It will show as extra received.`] : [],
    };
  },
  context: (r) => ({ customer: r.customer }),
  resultLink: (result) => `/orders/${result.id}`,
  formLink: (payload, id) => `/orders/new?assistant=${id}`,
  evals: [
    {
      ask: "New order for Bombay Saree Centre: 20 kg of 12 x 16, single colour plate",
      expect: { action: "create_order", args: { lines: [{ unit: "KG", quantity: 20 }] }, refs: { customer_id: "bombay", plate_type_id: "single", "lines.0.size_id": "size1216" } },
    },
    {
      ask: "Order for Laxmi Stores: 5000 pcs of 14 x 18 at 400 per 1000, two colour plate",
      expect: { action: "create_order", args: { lines: [{ unit: "PIECES", quantity: 5000, price: 400, price_per: 1000 }] }, refs: { customer_id: "laxmi", plate_type_id: "double", "lines.0.size_id": "size1418" } },
    },
    { ask: "Order for Laxmi Stores, 10 kg of 14 x 18, single colour plate", expect: { asks: true } },
  ],
});
