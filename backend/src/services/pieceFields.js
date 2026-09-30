"use strict";

/** A client-facing validation failure on one order line → HTTP 400. */
class LineError extends Error {}

const isBlank = (v) => v === undefined || v === null || v === "";

/**
 * Parse an "N pieces ↔ amount" pair (a piece price or a weight).
 * Both blank → { value: null }. Half-filled or invalid → { error }.
 * `positive` = amount must be > 0 (weights); otherwise ≥ 0 (prices).
 */
const parsePair = (amountRaw, countRaw, label, { positive }) => {
  if (isBlank(amountRaw) && isBlank(countRaw)) return { value: null };
  if (isBlank(amountRaw) || isBlank(countRaw)) {
    return { error: `${label}: enter both the number of pieces and the amount` };
  }
  const amount = Number(amountRaw);
  const count = Number(countRaw);
  if (!Number.isFinite(amount) || (positive ? amount <= 0 : amount < 0)) {
    return { error: `${label}: amount must be ${positive ? "greater than 0" : "0 or more"}` };
  }
  if (!Number.isInteger(count) || count < 1) {
    return { error: `${label}: number of pieces must be a whole number, 1 or more` };
  }
  return { value: { amount, count } };
};

module.exports = { LineError, isBlank, parsePair };
