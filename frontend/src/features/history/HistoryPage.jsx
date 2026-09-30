import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, IndianRupee, ClipboardList, Package, Circle } from "lucide-react";
import { auditLogAPI } from "../../services/api";
import { keys } from "../../lib/queryKeys";
import { describeAudit, impactText, HISTORY_TYPES, HISTORY_PERIODS, historyParams, dayOfIST, timeIST } from "./describeAudit";
import PageHeader from "../../ui/PageHeader";
import Chips from "../../ui/Chips";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";

const ICON = { payment: IndianRupee, order: ClipboardList, stock: Package, other: Circle };
const TONE_DOT = { good: "bg-status-good/15 text-status-good", critical: "bg-status-critical/15 text-status-critical", info: "bg-brass/15 text-brass", muted: "bg-raised text-ink-2" };

function Entry({ row }) {
  const d = describeAudit(row);
  const Icon = ICON[d.kind];
  const impact = impactText(d.impact);
  const inner = (
    <>
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONE_DOT[d.tone]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{d.title}</span>
        {d.detail && <span className="block truncate text-xs text-ink-2">{d.detail}</span>}
        {impact && <span className="mt-1 block font-num text-xs tabular-nums text-ink-2">{impact} <span className="opacity-70">(at that time)</span></span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-ink-2">{timeIST(row.created_at)}{d.link && <ChevronRight className="h-4 w-4" aria-hidden="true" />}</span>
    </>
  );
  const cls = "flex items-start gap-3 px-4 py-3";
  return d.link
    ? <Link to={d.link} className={`${cls} hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass`}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

export default function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "all";
  const period = params.get("period") || "all";
  const today = todayIST();
  const query = useMemo(() => historyParams({ type, period }, today), [type, period, today]);
  const list = useInfiniteQuery({
    queryKey: keys.history.list(query),
    queryFn: ({ pageParam }) => auditLogAPI.getAll({ ...query, page: pageParam, limit: 30 }).then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });
  const sentinel = useInfiniteSentinel(list);
  const rows = useMemo(() => (list.data?.pages || []).flatMap((p) => p.logs), [list.data]);
  const groups = useMemo(() => groupByDay(rows, today, (r) => dayOfIST(r.created_at)), [rows, today]);
  const set = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value === "all") next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="History" subtitle="Every payment, order and stock change, newest first" />
      <div className="mt-3 space-y-2">
        <Chips label="What" options={HISTORY_TYPES} value={type} onChange={(v) => set("type", v)} />
        <Chips label="When" options={HISTORY_PERIODS} value={period} onChange={(v) => set("period", v)} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? (
          <ErrorState title="Couldn't load history." onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing here yet" body="Try another type or time." />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.date} aria-labelledby={`h-day-${g.date}`} className="mb-3">
                <h2 id={`h-day-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
                <ul className="overflow-hidden rounded-2xl bg-surface">
                  {g.rows.map((r) => <li key={r.id} className="border-b border-line/60 last:border-0"><Entry row={r} /></li>)}
                </ul>
              </section>
            ))}
            <div ref={sentinel} className="py-4 text-center text-xs text-ink-2">
              {list.isFetchingNextPage ? "Loading more…" : list.hasNextPage ? "" : `That's everything · ${list.data.pages[0].pagination.total} entries`}
              {list.isError && rows.length > 0 && <button type="button" onClick={() => list.fetchNextPage()} className="ml-2 font-semibold text-brass">Couldn't load more — retry</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
