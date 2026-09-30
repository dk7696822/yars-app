import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Ellipsis } from "lucide-react";
import { useExpenses, useExpenseCategories } from "./api";
import { EXPENSE_CHIPS, expenseParams, cardTotals, groupExpenses } from "./expenseList";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import { todayIST } from "../../utils/istDate";
import { exportAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const PERIOD_LABEL = { this_month: "This month", last_month: "Last month", all: "All time", unpaid: "Unpaid" };

export default function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const chip = params.get("chip") || "this_month";
  const categoryId = params.get("cat") || "";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const [menuOpen, setMenuOpen] = useState(false);
  const today = todayIST();
  const query = useMemo(() => expenseParams({ chip, categoryId, search: term }, today), [chip, categoryId, term, today]);
  const list = useExpenses(query);
  const categories = useExpenseCategories();
  const expenses = useMemo(() => list.data?.expenses || [], [list.data]);
  const totals = useMemo(() => cardTotals({ expenses, isPlaceholderData: list.isPlaceholderData, isPending: list.isPending, hasData: Boolean(list.data) }), [expenses, list.isPlaceholderData, list.isPending, list.data]);
  const groups = useMemo(() => groupExpenses(expenses, today), [expenses, today]);

  const setParam = (key, value, fallback = "") =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== fallback) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const download = async () => {
    try {
      await exportAPI.downloadExpensesData(query);
    } catch {
      toast.error("Couldn't download the Excel file. Try again.");
    }
  };

  const categoryChips = [{ value: "", label: "All categories" }, ...(categories.data || []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Expenses" actions={<>
        <IconButton label="More expense actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/expenses/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>
      </>} />

      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search description or vendor" aria-label="Search expenses" enterKeyHint="search" />
        <Chips label="Period" options={EXPENSE_CHIPS} value={chip} onChange={(v) => setParam("chip", v, "this_month")} />
        {categoryChips.length > 1 && <Chips label="Category" options={categoryChips} value={categoryId} onChange={(v) => setParam("cat", v)} />}
      </div>

      <section aria-label="Total" className="mt-4 rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <p className="text-sm text-ink-2">{PERIOD_LABEL[chip]}{categoryId && categories.data ? ` · ${categories.data.find((c) => c.id === categoryId)?.name || ""}` : ""}</p>
        {totals ? (
          <>
            <Money value={totals.total} className="block text-3xl font-bold text-ink" />
            <p className="mt-1 text-sm text-ink-2">
              {totals.count} expense{totals.count === 1 ? "" : "s"}
              {totals.unpaid > 0 && <> · <span className="font-semibold text-status-warn">Unpaid <Money value={totals.unpaid} /></span></>}
            </p>
          </>
        ) : (
          <div aria-label="Loading total" className="mt-1 space-y-2"><div className="h-9 w-40 animate-pulse rounded-xl bg-raised" /><div className="h-4 w-28 animate-pulse rounded bg-raised" /></div>
        )}
      </section>

      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && expenses.length === 0 ? (
          <ErrorState title="Couldn't load expenses." onRetry={() => list.refetch()} />
        ) : expenses.length === 0 ? (
          <EmptyState title="No expenses here" body={chip === "all" && !categoryId && !term ? "Add your first expense to start tracking." : "Try another period, category or search."}
            action={<Link to="/expenses/new" className={buttonClass()}>Add an expense</Link>} />
        ) : (
          groups.map((g) => (
            <section key={g.date} aria-labelledby={`exp-day-${g.date}`} className="mb-3">
              <h2 id={`exp-day-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface">
                {g.rows.map((e) => (
                  <li key={e.id} className="border-b border-line/60 last:border-0">
                    <Link to={`/expenses/edit/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{e.description || "No description"}</span>
                        <span className="block truncate text-xs text-ink-2">{e.vendor || "No vendor"} · {e.category?.name || "Uncategorised"}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Money value={Number(e.total_cost)} className="text-sm font-bold text-ink" />
                        {e.payment_status === "UNPAID" && <Tag label="Unpaid" tone="warn" />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <ActionSheet open={menuOpen} title="Expenses" onClose={() => setMenuOpen(false)}
        actions={[{ label: "Download Excel of this list", onSelect: download }, { label: "Expense categories", onSelect: () => navigate("/expense-categories") }]} />
    </div>
  );
}
