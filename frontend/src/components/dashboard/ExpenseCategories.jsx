import { useState } from "react";
import PropTypes from "prop-types";
import { inr } from "../../utils/dashboardFormat";

export default function ExpenseCategories({ categories }) {
  const [all, setAll] = useState(false);
  const shown = all ? categories : categories.slice(0, 4);
  const max = Math.max(1, ...categories.map((c) => c.amount));
  return (
    <section aria-labelledby="expense-cats">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-5"><h2 id="expense-cats" className="text-sm font-bold text-ink">Expenses by category</h2><span className="text-xs text-ink-2">selected period</span></div>
      <div className="rounded-2xl bg-surface p-3.5">
        {categories.length === 0 ? <p className="text-sm text-ink-2">No expenses in this period.</p> : shown.map((c) => (
          <div key={c.name} className="my-1.5 flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-ink-2">{c.name}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-chart-expense" style={{ width: `${(c.amount / max) * 100}%` }} /></span>
            <span className="w-20 text-right font-semibold tabular-nums text-ink">{inr(c.amount)}</span>
          </div>
        ))}
        {categories.length > 4 && (
          <button type="button" onClick={() => setAll(!all)} className="mt-1 text-xs font-semibold text-brass">{all ? "Show fewer" : `+${categories.length - 4} more`}</button>
        )}
      </div>
    </section>
  );
}
ExpenseCategories.propTypes = { categories: PropTypes.array.isRequired };
