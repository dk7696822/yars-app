import { lineKg } from "./orderMath";

/**
 * Format a number as currency (INR)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a date string to a readable format
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * Format a date for API requests (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export const formatDateForAPI = (date) => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/** Indian digit grouping, up to maxFrac decimals: 10000 → "10,000". */
export const formatNumber = (n, maxFrac = 3) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: maxFrac }).format(Number(n));

export const formatKg = (kg) => `${formatNumber(kg, 2)} kg`;

// ₹ with 2–4 decimals: 0.375 → "₹0.375", 375 → "₹375.00".
const rupees = (amount) =>
  `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(amount))}`;

/** A pieces price exactly as it was entered: "₹0.50/pc" or "₹375.00 / 1,000 pcs". */
export const formatPiecePrice = (amount, count) =>
  Number(count) === 1 ? `${rupees(amount)}/pc` : `${rupees(amount)} / ${formatNumber(count)} pcs`;

export const perPiecePriceHint = (amount, count) => `= ${rupees(Number(amount) / Number(count))} per piece`;

export const perPieceWeightHint = (kg, count) => `≈ ${formatNumber((Number(kg) / Number(count)) * 1000, 2)} g per piece`;

const hasValue = (v) => v !== null && v !== undefined && v !== "";

/** Product-size list summary: "₹180.00/kg · ₹0.50/pc · 10 g/pc" ("—" when unset). */
export const formatSizePricing = (size) => {
  const kg = hasValue(size.rate_per_kg) ? `${formatCurrency(size.rate_per_kg)}/kg` : "—";
  const pcs = hasValue(size.piece_price_amount) ? formatPiecePrice(size.piece_price_amount, size.piece_price_count) : "—";
  const weight = hasValue(size.weight_kg)
    ? `${formatNumber((Number(size.weight_kg) / Number(size.weight_pieces_count)) * 1000, 2)} g/pc`
    : "—";
  return `${kg} · ${pcs} · ${weight}`;
};

export const formatLineQuantity = (item) =>
  item.unit === "PIECES" ? `${formatNumber(item.quantity_pieces)} pcs` : `${parseFloat(item.quantity_kg)} kg`;

export const formatLineRate = (item) =>
  item.unit === "PIECES"
    ? formatPiecePrice(item.price_amount, item.price_pieces_count)
    : `${formatCurrency(item.rate_per_kg || item.productSize?.rate_per_kg)}/kg`;

/** Estimated kg text for a pieces line; null for kg lines. */
export const formatLineKg = (item) => {
  if (item.unit !== "PIECES") return null;
  const kg = lineKg(item);
  if (kg === null) return "kg: weight not set";
  return `≈ ${formatKg(kg)}${item.weight_source === "MANUAL" ? " (measured)" : ""}`;
};

/** Invoice items: unit NULL = created before pieces existed → show exactly as before. */
export const formatInvoiceQty = (item) => {
  if (item.unit === "PIECES") return `${formatNumber(item.quantity)} pcs`;
  if (item.unit === "KG") return `${parseFloat(item.quantity)} kg`;
  return item.quantity;
};

export const formatInvoiceRate = (item) => {
  if (item.unit === "PIECES") return formatPiecePrice(item.price_amount, item.price_pieces_count);
  if (item.unit === "KG") return `${formatCurrency(item.unit_price)}/kg`;
  return formatCurrency(item.unit_price);
};

/** Shown after saving a size weight that back-filled earlier pieces lines; null when none. */
export const backfillMessage = (count) =>
  count > 0 ? `Weight added to ${count} earlier order line${count === 1 ? "" : "s"}` : null;
