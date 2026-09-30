"use strict";

// PDF text for invoice items. unit NULL = created before piece orders existed
// (and plate-charge/advance rows) — rendered exactly as before.

const groupIN = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 });

// 2–4 decimals: 375 → "375.00", 0.375 → "0.375"
const priceText = (amount) =>
  Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false });

const formatInvoiceRate = (item) => {
  if (item.unit === "PIECES") {
    const count = Number(item.price_pieces_count);
    return count === 1 ? `Rs. ${priceText(item.price_amount)} / pc` : `Rs. ${priceText(item.price_amount)} / ${groupIN(count)} pcs`;
  }
  const base = `Rs. ${Math.abs(parseFloat(item.unit_price)).toFixed(2)}`;
  return item.unit === "KG" ? `${base} / kg` : base;
};

const formatInvoiceQty = (item) => {
  if (item.unit === "PIECES") return `${groupIN(item.quantity)} pcs`;
  if (item.unit === "KG") return `${parseFloat(item.quantity)} kg`;
  return parseFloat(item.quantity).toString();
};

module.exports = { formatInvoiceRate, formatInvoiceQty };
