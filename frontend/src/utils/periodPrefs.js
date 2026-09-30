const KEY = "yars_dashboard_period";
const PRESETS = ["all", "this_month", "last_month", "this_fy", "custom"];

export const loadPeriod = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && PRESETS.includes(v.preset)) return v;
  } catch {
    /* unavailable or corrupt — use the default */
  }
  return { preset: "all" };
};
export const savePeriod = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
};

const DAY_MS = 86400000;
const MAX_SPAN_DAYS = 5 * 366; // same limit as the server

/** Why a custom range can't be used (null when it's fine) — mirrors the server's checks. */
export const customRangeError = (from, to) => {
  if (!from || !to) return "Choose both dates.";
  if (from > to) return "From date must be on or before To date.";
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  if (span > MAX_SPAN_DAYS) return "A custom period can be at most 5 years.";
  return null;
};
