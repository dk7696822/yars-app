"use strict";

const { LineError, isBlank, parsePair } = require("./pieceFields");

/**
 * Turn one client order line + its product size into the row we store.
 * Snapshot rules (spec §4): values sent by the client win; otherwise prices
 * and weights are copied from the size. Throws LineError for 400s.
 */
const buildLineRow = (input, size) => {
  const unit = isBlank(input.unit) ? "KG" : input.unit;
  if (unit !== "KG" && unit !== "PIECES") throw new LineError(`Unknown unit "${unit}" — use KG or PIECES`);

  if (unit === "KG") {
    if (!input.quantity_kg) throw new LineError("Product size ID and quantity are required");
    const rate = input.rate_per_kg || size.rate_per_kg; // same fallback as before pieces existed
    if (isBlank(rate)) {
      throw new LineError(`${size.size_label} has no rate per kg — enter a rate for this line or choose Pcs`);
    }
    return { unit: "KG", quantity_kg: input.quantity_kg, rate_per_kg: rate };
  }

  const quantity = isBlank(input.quantity_pieces) ? NaN : Number(input.quantity_pieces);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new LineError("Quantity (pcs) must be a whole number, 1 or more");
  }

  const price = parsePair(input.price_amount, input.price_pieces_count, "Price", { positive: false });
  if (price.error) throw new LineError(price.error);
  let priceFields;
  if (price.value) {
    priceFields = { price_amount: price.value.amount, price_pieces_count: price.value.count };
  } else if (!isBlank(size.piece_price_amount)) {
    priceFields = { price_amount: size.piece_price_amount, price_pieces_count: size.piece_price_count };
  } else {
    throw new LineError(`${size.size_label} has no piece price — enter a price for this line`);
  }

  const weight = parsePair(input.weight_kg, input.weight_pieces_count, "Weight", { positive: true });
  if (weight.error) throw new LineError(weight.error);
  let weightFields = { weight_kg: null, weight_pieces_count: null, weight_source: null };
  if (weight.value) {
    // The client echoes SIZE for a weight it prefilled and the user didn't touch.
    weightFields = {
      weight_kg: weight.value.amount,
      weight_pieces_count: weight.value.count,
      weight_source: input.weight_source === "SIZE" ? "SIZE" : "MANUAL",
    };
  } else if (!isBlank(size.weight_kg)) {
    weightFields = { weight_kg: size.weight_kg, weight_pieces_count: size.weight_pieces_count, weight_source: "SIZE" };
  }

  return { unit: "PIECES", quantity_kg: null, rate_per_kg: null, quantity_pieces: quantity, ...priceFields, ...weightFields };
};

module.exports = { buildLineRow };
