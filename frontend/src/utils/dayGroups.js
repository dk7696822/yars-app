import { addDays } from "./istDate";
import { shortDate } from "./dashboardFormat";

export const dayLabel = (date, today) => (date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : shortDate(date));

/** Rows already sorted newest first → consecutive day groups, order kept. */
export const groupByDay = (rows, today, dateOf = (r) => r.orderDate) => {
  const groups = [];
  for (const row of rows) {
    const date = dateOf(row);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.rows.push(row);
    else groups.push({ date, label: dayLabel(date, today), rows: [row] });
  }
  return groups;
};
