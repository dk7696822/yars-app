import { parseNumber } from "../../utils/numberInput";
import { formatNumber } from "../../utils/formatters";

/** The size form holds exactly what was typed; numbers are parsed on save. */
export const emptySize = () => ({ size_label: "", rate_per_kg: "", piece_price_count: "1", piece_price_amount: "", weight_pieces_count: "", weight_kg: "" });

const text = (v) => (v === null || v === undefined || v === "" ? "" : String(Number(v))); // "190.00" → "190", "0.3750" → "0.375"

export const formFromSize = (s) => ({
  size_label: s.size_label || "",
  rate_per_kg: text(s.rate_per_kg),
  piece_price_amount: text(s.piece_price_amount),
  piece_price_count: s.piece_price_count ? String(s.piece_price_count) : "1",
  weight_kg: text(s.weight_kg),
  weight_pieces_count: s.weight_pieces_count ? String(s.weight_pieces_count) : "",
});

/** Same rules as the server (productSizeController parsePricing). ₹0 per kg is allowed: the rate is then set on each order. */
export const validateSize = (f) => {
  const e = {};
  if (!f.size_label.trim()) e.size_label = "Enter the size, like 14 x 18";
  const rate = parseNumber(f.rate_per_kg, { allowZero: true });
  if (rate.error) e.rate_per_kg = rate.error;
  const amount = parseNumber(f.piece_price_amount, { dp: 4, allowZero: true });
  const count = parseNumber(f.piece_price_count, { whole: true });
  if (amount.error) e.piece_price = amount.error;
  else if (amount.value !== null && (count.error || count.value === null)) e.piece_price = count.error || "Enter both: how many pieces and their price";
  const wk = parseNumber(f.weight_kg, { dp: 3 });
  const wc = parseNumber(f.weight_pieces_count, { whole: true });
  if (String(f.weight_kg).trim() !== "" || String(f.weight_pieces_count).trim() !== "") {
    if (wk.error || wc.error) e.weight = wk.error || wc.error;
    else if (wk.value === null || wc.value === null) e.weight = "Enter both the pieces and their weight in kg, or clear both";
  }
  if (!e.rate_per_kg && !e.piece_price && rate.value === null && amount.value === null) e.form = "Enter a rate per kg or a piece price (or both)";
  return e;
};

export const toSizePayload = (f) => {
  const amount = parseNumber(f.piece_price_amount, { dp: 4, allowZero: true }).value;
  return {
    size_label: f.size_label.trim(),
    rate_per_kg: parseNumber(f.rate_per_kg, { allowZero: true }).value,
    piece_price_amount: amount,
    piece_price_count: amount === null ? null : parseNumber(f.piece_price_count, { whole: true }).value,
    weight_kg: parseNumber(f.weight_kg, { dp: 3 }).value,
    weight_pieces_count: parseNumber(f.weight_pieces_count, { whole: true }).value,
  };
};

const has = (v) => v !== null && v !== undefined && v !== "";

/** "₹180/kg · ₹375 per 1,000 pcs · 10 g per piece" — how a size is priced, in plain words. */
export const sizePricingText = (s) => {
  const parts = [];
  parts.push(Number(s.rate_per_kg) > 0 ? `₹${formatNumber(s.rate_per_kg, 2)}/kg` : null);
  if (has(s.piece_price_amount)) {
    parts.push(Number(s.piece_price_count) === 1
      ? `₹${formatNumber(s.piece_price_amount, 4)} per piece`
      : `₹${formatNumber(s.piece_price_amount, 4)} per ${formatNumber(s.piece_price_count)} pcs`);
  }
  if (!parts.some(Boolean)) return "Rate set on each order";
  if (has(s.weight_kg) && has(s.weight_pieces_count)) parts.push(`${formatNumber((Number(s.weight_kg) / Number(s.weight_pieces_count)) * 1000, 2)} g per piece`);
  return parts.filter(Boolean).join(" · ");
};
