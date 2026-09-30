const exact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const one = (x) => String(Math.round(x * 10) / 10);

/** Exact rupees — the only format used for figures. */
export const inr = (n) => `₹${exact.format(Number(n))}`;
/** Compact rupees for chart axis ticks only (figures always use inr). */
export const axisInr = (n) => {
  const v = Number(n);
  if (Math.abs(v) >= 1e7) return `₹${one(v / 1e7)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${one(v / 1e5)}L`;
  if (Math.abs(v) >= 1e3) return `₹${one(v / 1e3)}k`;
  return inr(v);
};
export const kgText = (n) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(Number(n))} kg`;
export const delta = (cur, prev) => {
  if (prev === null || prev === undefined) return null;
  if (Number(prev) === 0) return Number(cur) === 0 ? { text: "no change", dir: "flat" } : { text: "new", dir: "up" };
  const pct = Math.round(((Number(cur) - Number(prev)) / Number(prev)) * 100);
  if (pct === 0) return { text: "no change", dir: "flat" };
  return { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`, dir: pct > 0 ? "up" : "down" };
};
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const shortDate = (d) => dateFmt.format(new Date(`${d}T00:00:00Z`));
export const monthLabel = (ym) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));
export const rangeText = ({ from, to }) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);
