/**
 * Order math — mirror of backend/src/services/orderMath.js. Both are pinned by
 * backend/tests/fixtures/order-math-vectors.json; change them together.
 * DECIMAL fields from the API are strings — every function parses its inputs.
 */

const isPieces = (line) => line.unit === "PIECES";

const toScaled = (value, scale) => BigInt(Number(value).toFixed(scale).replace(".", ""));

export const piecesAmount = (quantityPieces, priceAmount, pricePiecesCount) => {
  const numerator = BigInt(quantityPieces) * toScaled(priceAmount, 4);
  const denominator = BigInt(pricePiecesCount) * 100n;
  const paise = (2n * numerator + denominator) / (2n * denominator);
  return Number(paise) / 100;
};

export const lineAmount = (line, size = line.productSize) => {
  if (isPieces(line)) {
    return piecesAmount(line.quantity_pieces, line.price_amount, line.price_pieces_count);
  }
  // Byte-for-byte the pre-pieces expression — existing totals depend on it.
  return parseFloat(line.quantity_kg) * parseFloat(line.rate_per_kg || size.rate_per_kg);
};

export const lineKg = (line) => {
  if (!isPieces(line)) return parseFloat(line.quantity_kg);
  if (line.weight_kg == null || line.weight_kg === "" || line.weight_pieces_count == null || line.weight_pieces_count === "") return null;
  return (Number(line.quantity_pieces) * parseFloat(line.weight_kg)) / Number(line.weight_pieces_count);
};

export const linePieces = (line) => (isPieces(line) ? Number(line.quantity_pieces) : 0);

export const plateCharge = (order) => parseFloat(order.custom_plate_charge || order.plateType?.charge || 0);

export const orderTotal = (order) => {
  const productAmount = (order.orderProductSizes || []).reduce((sum, line) => sum + lineAmount(line), 0);
  return productAmount + plateCharge(order) - parseFloat(order.round_off_amount || 0);
};

export const paymentPosition = (order, total = orderTotal(order)) => {
  const payments = order.payments || [];
  const sum = (list) => list.reduce((acc, p) => acc + parseFloat(p.amount), 0);
  const totalPaid = sum(payments.filter((p) => p.payment_type !== "ADVANCE"));
  const advanceFromPayments = sum(payments.filter((p) => p.payment_type === "ADVANCE"));
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return { totalPaid, advanceReceived, totalReceived: totalPaid + advanceReceived, remaining: total - totalPaid - advanceReceived };
};

const round3 = (x) => Math.round(x * 1000) / 1000;

export const volumeSummary = (orders) => {
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
