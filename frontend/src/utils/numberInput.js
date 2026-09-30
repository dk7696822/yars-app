const MAX = 99999999.99; // DECIMAL(10,2)

/**
 * Text typed in a number box → { value, error }. Never NaN. Empty → { null, null }:
 * the caller decides whether the field is required. Commas are ignored ("1,250").
 */
export const parseNumber = (text, { dp = 2, whole = false, allowZero = false, signed = false } = {}) => {
  const t = String(text ?? "").trim().replace(/,/g, "");
  if (t === "") return { value: null, error: null };
  const sign = signed ? "-?" : "";
  if (whole) {
    if (!new RegExp(`^${sign}\\d+$`).test(t)) return { value: null, error: "Whole numbers only" };
  } else {
    if (!new RegExp(`^${sign}(\\d+(\\.\\d*)?|\\.\\d+)$`).test(t)) return { value: null, error: "Enter a number" };
    if ((t.split(".")[1] || "").length > dp) return { value: null, error: `Use at most ${dp} decimals` };
  }
  const value = Number(t);
  if (Math.abs(value) > MAX) return { value: null, error: "That number is too large" };
  if (value === 0 && !allowZero) return { value: null, error: whole ? "Must be at least 1" : "Must be more than 0" };
  return { value, error: null };
};
