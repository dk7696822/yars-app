"use strict";

/**
 * Dashboard dates. Everything is a "YYYY-MM-DD" string in India time (the
 * server runs in UTC, so "today" must never come from the server clock's date).
 * Arithmetic runs on UTC midnights, which has no DST and no timezone drift.
 */

class PeriodError extends Error {}

const DAY_MS = 86400000;
const BANDS = ["0-30", "31-60", "61-90", "90+"];
const LABELS = { all: "All time", this_month: "This month", last_month: "Last month", this_fy: "This financial year", custom: "Custom" };
const MAX_SPAN_DAYS = 5 * 366;

const todayIST = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const toMs = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromMs(toMs(s)) === s;

const addDays = (d, n) => fromMs(toMs(d) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY_MS);
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const monthEnd = (d) => {
  const [y, m] = d.split("-").map(Number);
  return fromMs(Date.UTC(y, m, 0));
};
/** First day of the month `n` months from d's month. */
const shiftMonth = (d, n) => {
  const [y, m] = d.split("-").map(Number);
  return fromMs(Date.UTC(y, m - 1 + n, 1));
};
/** The given day in a month, clamped to that month's last day (31 → 28/29 Feb). */
const clampDay = (firstOfMonth, day) => {
  const last = Number(monthEnd(firstOfMonth).slice(8));
  return `${firstOfMonth.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
};

const lastMonths = (today, n) => Array.from({ length: n }, (_, i) => shiftMonth(today, i - (n - 1)).slice(0, 7));

const agingBand = (days) => (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");

const resolvePeriod = ({ preset = "all", from, to } = {}, today, earliest, latest) => {
  const day = Number(today.slice(8));
  switch (preset) {
    case "all": {
      const start = earliest && earliest < today ? earliest : today;
      // Reach any future-dated record (a date-picker slip) so All time always
      // reconciles with To collect, which counts every live order.
      const end = latest && latest > today ? latest : today;
      return { range: { from: start, to: end, label: LABELS.all }, compare: null };
    }
    case "this_month": {
      const prev = shiftMonth(today, -1);
      return { range: { from: monthStart(today), to: today, label: LABELS.this_month }, compare: { from: prev, to: clampDay(prev, day) } };
    }
    case "last_month": {
      const m1 = shiftMonth(today, -1);
      const m2 = shiftMonth(today, -2);
      return { range: { from: m1, to: monthEnd(m1), label: LABELS.last_month }, compare: { from: m2, to: monthEnd(m2) } };
    }
    case "this_fy": {
      const year = Number(today.slice(0, 4));
      const fyYear = Number(today.slice(5, 7)) >= 4 ? year : year - 1;
      const sameMonthLastYear = `${year - 1}${today.slice(4, 8)}01`;
      return {
        range: { from: `${fyYear}-04-01`, to: today, label: LABELS.this_fy },
        compare: { from: `${fyYear - 1}-04-01`, to: clampDay(sameMonthLastYear, day) },
      };
    }
    case "custom": {
      if (!isDate(from) || !isDate(to)) throw new PeriodError("Custom period needs from and to dates as YYYY-MM-DD");
      if (from > to) throw new PeriodError("From date must be on or before To date");
      const span = daysBetween(from, to) + 1;
      if (span > MAX_SPAN_DAYS) throw new PeriodError("Custom period can be at most 5 years");
      const compareTo = addDays(from, -1);
      return { range: { from, to, label: LABELS.custom }, compare: { from: addDays(compareTo, -(span - 1)), to: compareTo } };
    }
    default:
      throw new PeriodError(`Unknown period "${preset}"`);
  }
};

module.exports = { PeriodError, BANDS, todayIST, addDays, daysBetween, monthStart, monthEnd, lastMonths, agingBand, resolvePeriod };
