import { formatNumber } from "./formatters";

export const qtyText = (item) => (item.unit === "PIECES" ? `${formatNumber(item.quantity, 0)} pcs` : `${formatNumber(item.quantity, 2)} kg`);

/** "14x18 · 30 kg +1 more" — one line for list rows. */
export const itemsText = (items) => {
  if (!items.length) return "No items";
  const first = `${items[0].size} · ${qtyText(items[0])}`;
  return items.length === 1 ? first : `${first} +${items.length - 1} more`;
};

/** Saved order lines (API shape) → list items. */
export const itemsFromLines = (lines = []) =>
  lines.map((l) => ({
    size: l.productSize?.size_label || "Unknown size",
    unit: l.unit === "PIECES" ? "PIECES" : "KG",
    quantity: l.unit === "PIECES" ? Number(l.quantity_pieces) : parseFloat(l.quantity_kg),
  }));
