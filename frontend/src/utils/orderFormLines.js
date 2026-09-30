import { lineAmount, lineKg } from "./orderMath";

const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v) => (has(v) ? parseFloat(v) : "");

/** Units a size can be sold in — only those it has a price for. */
export const availableUnits = (size) => {
  if (!size) return ["KG", "PIECES"];
  const units = [];
  if (has(size.rate_per_kg)) units.push("KG");
  if (has(size.piece_price_amount)) units.push("PIECES");
  return units;
};

export const emptyLine = () => ({
  product_size_id: "",
  unit: "KG",
  quantity_kg: 1,
  rate_per_kg: 0,
  quantity_pieces: "",
  price_amount: "",
  price_pieces_count: "",
  weight_kg: "",
  weight_pieces_count: "",
  weight_source: null,
});

/** A saved order line (API shape) → form state. */
export const lineFromOrderItem = (item) => {
  if (item.unit === "PIECES") {
    return {
      ...emptyLine(),
      product_size_id: item.product_size_id,
      unit: "PIECES",
      quantity_pieces: item.quantity_pieces,
      price_amount: num(item.price_amount),
      price_pieces_count: item.price_pieces_count,
      weight_kg: num(item.weight_kg),
      weight_pieces_count: item.weight_pieces_count ?? "",
      weight_source: item.weight_source ?? null,
    };
  }
  return {
    ...emptyLine(),
    product_size_id: item.product_size_id,
    unit: "KG",
    quantity_kg: parseFloat(item.quantity_kg),
    rate_per_kg: parseFloat(item.rate_per_kg || item.productSize.rate_per_kg),
  };
};

const withSizeWeight = (line, size) =>
  has(size.weight_kg)
    ? { ...line, weight_kg: parseFloat(size.weight_kg), weight_pieces_count: size.weight_pieces_count, weight_source: "SIZE" }
    : line;

/** User picked a size on a line. */
export const applySizeSelection = (line, size) => {
  if (!size) return { ...line, product_size_id: "" };
  const changed = size.id !== line.product_size_id;
  let next = { ...line, product_size_id: size.id };

  const units = availableUnits(size);
  if (units.length && !units.includes(next.unit)) next.unit = units[0];

  // kg: pre-fill only if the line has no rate yet (unchanged behaviour).
  if (!next.rate_per_kg) next.rate_per_kg = has(size.rate_per_kg) ? parseFloat(size.rate_per_kg) : 0;

  // pieces: a new size means new price/weight — never keep the old size's.
  if (changed) {
    next = { ...next, price_amount: "", price_pieces_count: "", weight_kg: "", weight_pieces_count: "", weight_source: null };
  }
  if (!has(next.price_amount) && has(size.piece_price_amount)) {
    next = { ...next, price_amount: parseFloat(size.piece_price_amount), price_pieces_count: size.piece_price_count };
  }
  if (!has(next.weight_kg)) next = withSizeWeight(next, size);
  return next;
};

/** A weight was just saved on the size: fill this line only if it has none. */
export const applySizeWeight = (line, size) => (has(line.weight_kg) ? line : withSizeWeight(line, size));

const isWholePositive = (v) => has(v) && Number.isInteger(Number(v)) && Number(v) >= 1;

/** Live amount + kg for the form; null where the line is incomplete. */
export const previewLine = (line, size) => {
  if (line.unit === "PIECES") {
    const complete = isWholePositive(line.quantity_pieces) && has(line.price_amount) && isWholePositive(line.price_pieces_count);
    if (!complete) return { amount: null, kg: null };
    const weighed = has(line.weight_kg) && isWholePositive(line.weight_pieces_count);
    const mathLine = { ...line, weight_kg: weighed ? line.weight_kg : null, weight_pieces_count: weighed ? line.weight_pieces_count : null };
    return { amount: lineAmount(mathLine), kg: lineKg(mathLine) };
  }
  if (!size || !line.quantity_kg) return { amount: null, kg: null };
  return { amount: lineAmount({ ...line, rate_per_kg: line.rate_per_kg || size.rate_per_kg }, size), kg: parseFloat(line.quantity_kg) };
};

/** Form state → API payload line (only the chosen unit's fields). */
export const toPayloadLine = (line) => {
  if (line.unit !== "PIECES") {
    return { product_size_id: line.product_size_id, unit: "KG", quantity_kg: line.quantity_kg, rate_per_kg: line.rate_per_kg };
  }
  const payload = {
    product_size_id: line.product_size_id,
    unit: "PIECES",
    quantity_pieces: Number(line.quantity_pieces),
    price_amount: line.price_amount,
    price_pieces_count: line.price_pieces_count,
  };
  if (has(line.weight_kg) && has(line.weight_pieces_count)) {
    payload.weight_kg = line.weight_kg;
    payload.weight_pieces_count = line.weight_pieces_count;
    payload.weight_source = line.weight_source || "MANUAL";
  }
  return payload;
};
