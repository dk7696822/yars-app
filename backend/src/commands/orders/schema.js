"use strict";

const { z } = require("zod");

const ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"];
const numberText = z.union([z.number(), z.string()]);

/** One order line as the order form sends it; buildLineRow does the detailed checks. */
const orderLine = z.object({
  product_size_id: z.string().nullish(),
  unit: z.string().nullish(),
  quantity_kg: numberText.nullish(),
  rate_per_kg: numberText.nullish(),
  quantity_pieces: numberText.nullish(),
  price_amount: numberText.nullish(),
  price_pieces_count: numberText.nullish(),
  weight_kg: numberText.nullish(),
  weight_pieces_count: numberText.nullish(),
  weight_source: z.string().nullish(),
});

const orderFields = {
  customer_id: z.string().nullish(),
  order_date: z.string().nullish(),
  plate_type_id: z.string().nullish(),
  product_sizes: z.array(orderLine).nullish(),
  status: z.enum(ORDER_STATUSES, { error: `Status must be one of ${ORDER_STATUSES.join(", ")}` }).nullish(),
  custom_plate_charge: numberText.nullish(),
  round_off_amount: numberText.nullish(),
};

module.exports = { ORDER_STATUSES, numberText, orderLine, orderFields };
