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
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";
import { inr } from "../../utils/dashboardFormat";
import { exportAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const CHIPS = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "in_progress", label: "In progress" },
  { value: "this_month", label: "This month" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const chip = params.get("chip") || "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();

  const list = useOrderList({ chip, search: term || undefined });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const groups = useMemo(() => groupByDay(rows, todayIST()), [rows]);
  const summary = pages?.[0]?.summary;
  const filtered = chip !== "all" || term !== "";

  // Filters live in the URL, so Back from an order returns to the same list.
  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const downloadExcel = async () => {
    const today = todayIST();
    try {
      await exportAPI.downloadDashboardData({ search: term || undefined, ...(chip === "this_month" ? { from_date: `${today.slice(0, 7)}-01`, to_date: today } : {}) });
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
        actions={[{ label: chip === "this_month" ? "Download this month as Excel" : "Download Excel", onSelect: downloadExcel }]} />
    </div>
  );
}
