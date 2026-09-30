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
