import { addDays } from "../../utils/istDate";
import { customRangeError } from "../../utils/periodPrefs";

/** The "When" chips on the Orders screen. */
export const PERIODS = [
  { value: "any", label: "Any time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom…" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08" → the month before it, "2026-07". */
const prevMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const nextMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** "2026-08" → 1 Aug to 31 Aug (India dates, no time of day). */
export const monthRange = (ym) => ({ from: `${ym}-01`, to: addDays(`${nextMonth(ym)}-01`, -1) });

/** The dates the list is filtered by; {} when nothing (or an unfinished custom range) is chosen. */
export const periodRange = ({ period, from, to }, today) => {
  if (period === "this_month") return monthRange(today.slice(0, 7));
  if (period === "last_month") return monthRange(prevMonth(today.slice(0, 7)));
  if (period === "custom" && !customRangeError(from, to)) return { from, to };
  return {};
};

const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;

/** The last `n` months, this one first — one tap for "August". */
export const recentMonths = (today, n = 6) => {
  const out = [];
  let ym = today.slice(0, 7);
  for (let i = 0; i < n; i += 1) {
    out.push({ label: monthLabel(ym), ...monthRange(ym) });
    ym = prevMonth(ym);
  }
  return out;
};

const dayText = (d, withYear) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}${withYear ? ` ${d.slice(0, 4)}` : ""}`;

/** What the "When" chip says: a whole month as "Aug 2026", otherwise "10 Aug → 5 Sep". */
export const periodLabel = ({ period, from, to }, today) => {
  if (period !== "custom" || customRangeError(from, to)) return PERIODS.find((p) => p.value === period)?.label || "Any time";
  const whole = monthRange(from.slice(0, 7));
  if (whole.from === from && whole.to === to) return monthLabel(from.slice(0, 7));
  const thisYear = from.slice(0, 4) === today.slice(0, 4) && to.slice(0, 4) === today.slice(0, 4);
  return `${dayText(from, !thisYear)} → ${dayText(to, !thisYear)}`;
};

/** The period from the page address; old links with chip=this_month still work. */
export const readPeriod = (params) => {
  const legacy = params.get("chip") === "this_month" ? "this_month" : null;
  return { period: params.get("period") || legacy || "any", from: params.get("from") || "", to: params.get("to") || "" };
};
