import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Ellipsis } from "lucide-react";
import { useOrderList } from "./api";
import OrderRow from "./OrderRow";
import Chips from "../../ui/Chips";
import TextInput from "../../ui/TextInput";
import PageHeader from "../../ui/PageHeader";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import Button from "../../ui/Button";
import Sheet from "../../ui/Sheet";
import Field from "../../ui/Field";
import DateField from "../../ui/DateField";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";
import { inr } from "../../utils/dashboardFormat";
import { exportAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { customRangeError } from "../../utils/periodPrefs";
import { PERIODS, periodRange, periodLabel, recentMonths, readPeriod } from "./period";

const CHIPS = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "in_progress", label: "In progress" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  // "This month" used to be a chip; old links (chip=this_month) now mean the When filter.
  const chip = CHIPS.some((c) => c.value === params.get("chip")) ? params.get("chip") : "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();
  const today = todayIST();
  const when = readPeriod(params);
  const range = periodRange(when, today);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState({ from: when.from, to: when.to });
  const draftError = customRangeError(draft.from, draft.to);

  const list = useOrderList({ chip, search: term || undefined, ...range });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const groups = useMemo(() => groupByDay(rows, todayIST()), [rows]);
  const summary = pages?.[0]?.summary;
  const filtered = chip !== "all" || term !== "" || when.period !== "any";

  // Filters live in the URL, so Back from an order returns to the same list.
  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const setWhen = (period, from = "", to = "") =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("chip") === "this_month") next.delete("chip");
      for (const [k, v] of [["period", period === "any" ? "" : period], ["from", from], ["to", to]]) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });

  const pickWhen = (value) => {
    if (value === "custom") {
      setDraft({ from: when.from, to: when.to });
      setCustomOpen(true);
    } else setWhen(value);
  };

  const showCustom = (from, to) => {
    setWhen("custom", from, to);
    setCustomOpen(false);
  };

  const downloadExcel = async () => {
    try {
      await exportAPI.downloadDashboardData({ search: term || undefined, ...(range.from ? { from_date: range.from, to_date: range.to } : {}) });
    } catch {
      toast.error("Couldn't download the Excel file. Try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Orders" actions={<>
        <IconButton label="More order actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/orders/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>
      </>} />

      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search customer or size" aria-label="Search orders" enterKeyHint="search" />
        <Chips label="Filter orders" options={CHIPS} value={chip} onChange={(v) => setParam("chip", v)} />
        <Chips label="Orders from" value={when.period}
          options={PERIODS.map((p) => (p.value === "custom" && when.period === "custom" ? { ...p, label: periodLabel(when, today) } : p))}
          onChange={pickWhen} />
        {summary && (
          <p className="text-sm text-ink-2" aria-live="polite">
            {plural(summary.count, "order")} · <span className="font-num tabular-nums">{inr(summary.total)}</span>
            {summary.due > 0 && <> · <span className="font-semibold text-status-critical">Due <span className="font-num tabular-nums">{inr(summary.due)}</span></span></>}
            {summary.cancelled > 0 && <> · {summary.cancelled} cancelled not counted</>}
          </p>
        )}
      </div>

      <div className={`mt-3 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && rows.length === 0 ? (
          <ErrorState title="Couldn't load orders." onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState title="No orders match" body="Try another name, size or filter."
              action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear search and filters</Button>} />
          ) : (
            <EmptyState title="No orders yet" body="Orders you take show up here, newest first."
              action={<Link to="/orders/new" className={buttonClass()}>New order</Link>} />
          )
        ) : (
          groups.map((g) => (
            <section key={g.date} aria-labelledby={`day-${g.date}`} className="mb-3">
              <h2 id={`day-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface">{g.rows.map((r) => <OrderRow key={r.id} row={r} />)}</ul>
            </section>
          ))
        )}
        <div ref={sentinel} aria-hidden="true" />
        {list.isFetchingNextPage && <ListSkeleton rows={2} />}
      </div>

      <ActionSheet open={menuOpen} title="Orders" onClose={() => setMenuOpen(false)}
        actions={[{ label: range.from ? `Download ${periodLabel(when, today)} as Excel` : "Download Excel", onSelect: downloadExcel }]} />

      <Sheet open={customOpen} title="Orders from" onClose={() => setCustomOpen(false)}
        footer={<Button block size="lg" disabled={Boolean(draftError)} onClick={() => showCustom(draft.from, draft.to)}>Show orders</Button>}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-2">A month</p>
            <div className="flex flex-wrap gap-2">
              {recentMonths(today).map((m) => (
                <button key={m.from} type="button" onClick={() => showCustom(m.from, m.to)}
                  className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">{m.label}</button>
              ))}
            </div>
          </div>
          <Field label="From" htmlFor="orders-from"><DateField quick={false} value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} /></Field>
          <Field label="To" htmlFor="orders-to"><DateField quick={false} value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} /></Field>
          {draft.from && draft.to && draftError && <p role="alert" className="text-sm text-status-critical">{draftError}</p>}
        </div>
      </Sheet>
    </div>
  );
}
