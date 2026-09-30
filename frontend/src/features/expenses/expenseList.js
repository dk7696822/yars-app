import { addDays } from "../../utils/istDate";
import { groupByDay } from "../../utils/dayGroups";

export const EXPENSE_CHIPS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
];

const monthStart = (d) => `${d.slice(0, 7)}-01`;

/** Screen filters → the /expenses query (dates are India dates). */
export const expenseParams = ({ chip = "this_month", categoryId, search }, today) => {
  const p = {};
  if (chip === "this_month") Object.assign(p, { from_date: monthStart(today), to_date: today });
  if (chip === "last_month") {
    const lastDay = addDays(monthStart(today), -1);
    Object.assign(p, { from_date: monthStart(lastDay), to_date: lastDay });
  }
  if (chip === "unpaid") p.payment_status = "UNPAID";
  if (categoryId) p.category_id = categoryId;
  if (search && search.trim()) p.search = search.trim();
  return p;
};

const paise = (x) => Math.round(Number(x) * 100);

/** Exact totals in paise, back to rupees. */
export const expenseTotals = (expenses) => {
  let total = 0;
  let unpaid = 0;
  for (const e of expenses) {
    const p = paise(e.total_cost);
    total += p;
    if (e.payment_status === "UNPAID") unpaid += p;
  }
  return { total: total / 100, unpaid: unpaid / 100, count: expenses.length };
};

export const groupExpenses = (expenses, today) => groupByDay(expenses, today, (e) => e.bill_date);
