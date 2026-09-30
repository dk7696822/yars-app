"use strict";

/**
 * Order math — the single source of truth for line amounts, line kg, order
 * totals and payment position. frontend/src/utils/orderMath.js mirrors this
 * file; both are pinned by backend/tests/fixtures/order-math-vectors.json.
 *
 * DECIMAL columns arrive as strings — every function parses its inputs.
 */

const isPieces = (line) => line.unit === "PIECES";

// 0.375 / "0.3750" → 3750n at scale 4. Inputs are DB decimals (≤ 4 dp) or form numbers.
const toScaled = (value, scale) => BigInt(Number(value).toFixed(scale).replace(".", ""));

/**
 * ₹ for a pieces line: quantity × price ÷ count, rounded half-up to the paisa
 * with exact integer arithmetic, so it matches Postgres ROUND(numeric, 2).
 */
const piecesAmount = (quantityPieces, priceAmount, pricePiecesCount) => {
  const numerator = BigInt(quantityPieces) * toScaled(priceAmount, 4); // ₹ × 10^4
  const denominator = BigInt(pricePiecesCount) * 100n; // → paise
  const paise = (2n * numerator + denominator) / (2n * denominator);
  return Number(paise) / 100;
};

const lineAmount = (line, size = line.productSize) => {
  if (isPieces(line)) {
    return piecesAmount(line.quantity_pieces, line.price_amount, line.price_pieces_count);
  }
  // Byte-for-byte the pre-pieces expression. Do not "improve" it: every
  // existing order total depends on it staying identical.
  return parseFloat(line.quantity_kg) * parseFloat(line.rate_per_kg || size.rate_per_kg);
};

const lineKg = (line) => {
  if (!isPieces(line)) return parseFloat(line.quantity_kg);
  if (line.weight_kg == null || line.weight_pieces_count == null) return null;
  return (Number(line.quantity_pieces) * parseFloat(line.weight_kg)) / Number(line.weight_pieces_count);
};

const linePieces = (line) => (isPieces(line) ? Number(line.quantity_pieces) : 0);

const plateCharge = (order) => parseFloat(order.custom_plate_charge || order.plateType?.charge || 0);

const orderTotal = (order) => {
  const productAmount = (order.orderProductSizes || []).reduce((sum, line) => sum + lineAmount(line), 0);
  return productAmount + plateCharge(order) - parseFloat(order.round_off_amount || 0);
};

/**
 * The advance rule: an order's advance is EITHER the sum of its ADVANCE
 * payments (when any exist) OR the legacy advance_received column — never both.
 */
const paymentPosition = (order, total = orderTotal(order)) => {
  const payments = order.payments || [];
  // A refund is money given back: it counts against what was received.
  const signed = (p) => (p.payment_type === "REFUND" ? -1 : 1) * parseFloat(p.amount);
  const sum = (list) => list.reduce((acc, p) => acc + signed(p), 0);
  const totalPaid = sum(payments.filter((p) => p.payment_type !== "ADVANCE"));
  const advanceFromPayments = sum(payments.filter((p) => p.payment_type === "ADVANCE"));
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return {
    totalPaid,
    advanceReceived,
    totalReceived: totalPaid + advanceReceived,
    remaining: total - totalPaid - advanceReceived,
  };
};

const round3 = (x) => Math.round(x * 1000) / 1000;

/** Each line lands in exactly one bucket — the no-double-counting rule. */
const volumeSummary = (orders) => {
  let kgFromKgLines = 0;
  let kgFromPieces = 0;
  let piecesTotal = 0;
  let piecesWithoutWeight = 0;
  for (const order of orders) {
    for (const line of order.orderProductSizes || []) {
      if (!isPieces(line)) {
        kgFromKgLines += parseFloat(line.quantity_kg || 0);
        continue;
      }
      const pieces = linePieces(line);
      piecesTotal += pieces;
      const kg = lineKg(line);
      if (kg === null) piecesWithoutWeight += pieces;
      else kgFromPieces += kg;
    }
  }
  return {
    kgFromKgLines: round3(kgFromKgLines),
    kgFromPieces: round3(kgFromPieces),
    kgSold: round3(kgFromKgLines + kgFromPieces),
    piecesTotal,
    piecesWithoutWeight,
  };
};

module.exports = { piecesAmount, lineAmount, lineKg, linePieces, plateCharge, orderTotal, paymentPosition, volumeSummary };
