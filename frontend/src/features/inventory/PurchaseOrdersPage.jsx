import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { usePoList, rowsOf } from "./api";
import { PO_STATUS } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { shortDate } from "../../utils/dashboardFormat";

const CHIPS = [{ value: "", label: "All" }, ...Object.entries(PO_STATUS).map(([value, s]) => ({ value, label: s.label }))];
const linesDone = (po) => po.items.filter((l) => Number(l.quantity_received) >= Number(l.quantity_ordered)).length;

export default function PurchaseOrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(status ? { status } : {}) }), [term, status]);
  const list = usePoList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const setParam = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Purchase orders" actions={<Link to="/purchase-orders/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search PO number" aria-label="Search purchase orders" enterKeyHint="search" />
        <Chips label="Status" options={CHIPS} value={status} onChange={(v) => setParam("status", v)} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load purchase orders." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="No purchase orders here" body={term || status ? "Try another search or status." : "Order material from a supplier; receive it here when it arrives."}
            action={<Link to="/purchase-orders/new" className={buttonClass()}>New purchase order</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((po) => {
                const s = PO_STATUS[po.status] || { label: po.status, tone: "muted" };
                return (
                  <li key={po.id} className="border-b border-line/60 last:border-0">
                    <Link to={`/purchase-orders/${po.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{po.po_number} · {po.supplier?.name || "—"}</span>
                        <span className="block truncate text-xs text-ink-2">{shortDate(po.order_date)} · {linesDone(po)} of {po.items.length} item{po.items.length === 1 ? "" : "s"} received</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Money value={Math.round(Number(po.total_amount) * 100) / 100} className="text-sm font-bold text-ink" />
                        <Tag label={s.label} tone={s.tone} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
