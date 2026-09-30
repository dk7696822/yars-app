import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useIssueList, rowsOf } from "./api";
import { ISSUE_TYPES, ISSUE_TYPE_OPTIONS } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";

const CHIPS = [{ value: "", label: "All" }, ...ISSUE_TYPE_OPTIONS];
const itemsLine = (s) => {
  const names = (s.items || []).map((i) => i.item?.name).filter(Boolean);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", ");
};

export default function StockIssuesPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const today = todayIST();
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(type ? { issue_type: type } : {}) }), [term, type]);
  const list = useIssueList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const groups = useMemo(() => groupByDay(rows, today, (s) => s.issue_date), [rows, today]);
  const setParam = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Stock issues" subtitle="Material used, wasted or corrected" actions={<Link to="/stock-issues/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search issue number" aria-label="Search stock issues" enterKeyHint="search" />
        <Chips label="Type" options={CHIPS} value={type} onChange={(v) => setParam("type", v)} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load stock issues." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="Nothing here yet" body={term || type ? "Try another search or type." : "Record material taken from stock for production, wastage or a count correction."}
            action={<Link to="/stock-issues/new" className={buttonClass()}>Issue stock</Link>} />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.date} aria-labelledby={`si-${g.date}`} className="mb-3">
                <h2 id={`si-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
                <ul className="overflow-hidden rounded-2xl bg-surface">
                  {g.rows.map((s) => {
                    const t = ISSUE_TYPES[s.issue_type] || { label: s.issue_type, tone: "muted" };
                    const cost = Math.round((Number(s.total_cost) + Number(s.total_wastage_cost || 0)) * 100) / 100;
                    return (
                      <li key={s.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><span className="text-sm font-semibold text-ink">{s.issue_number}</span><Tag label={t.label} tone={t.tone} /></span>
                          <span className="block truncate text-xs text-ink-2">{itemsLine(s) || `${(s.items || []).length} items`}</span>
                          {s.order && <Link to={`/orders/${s.order_id || s.order.id}`} className="block truncate text-xs font-semibold text-brass">For {s.order.customer?.name || "an order"}</Link>}
                          {s.reason && <span className="block truncate text-xs text-ink-2">{s.reason}</span>}
                        </span>
                        <Money value={cost} className="shrink-0 text-sm font-semibold text-ink" />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
