const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY = 86400000;
const toMs = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

/** Today's date in India as "YYYY-MM-DD". Never use toISOString() for a date — that is UTC. */
export const todayIST = (now = new Date()) => fmt.format(now);
export const addDays = (d, n) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY);
export const isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
