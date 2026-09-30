import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Ellipsis, ChevronRight } from "lucide-react";
import { useStockList, useStockSummary, rowsOf } from "./api";
import { qty, attributesText } from "./labels";
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
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { inventoryExportAPI } from "../../services/inventoryAPI";
import { useToast } from "../../context/ToastContext";

const CHIPS = [{ value: "all", label: "All" }, { value: "low", label: "Low stock" }];

function Summary() {
  const s = useStockSummary();
  if (s.isPending) return <div className="h-28 animate-pulse rounded-3xl bg-surface" />;
  if (s.isError) return <ErrorState title="Couldn't load the stock summary." onRetry={() => s.refetch()} />;
  const d = s.data;
  return (
    <section aria-label="Stock summary" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
      <p className="text-sm text-ink-2">Stock value</p>
      <Money value={Number(d.total_stock_value)} className="block text-3xl font-bold text-ink" />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-ink-2">Low stock</dt><dd className={`font-num text-base font-bold tabular-nums ${d.low_stock_count > 0 ? "text-status-warn" : "text-ink"}`}>{d.low_stock_count} of {d.item_count}</dd></div>
        <div><dt className="text-ink-2">Received this month</dt><dd><Money value={Number(d.received_value_this_month)} className="text-base font-bold text-ink" /></dd></div>
        <div><dt className="text-ink-2">Used this month</dt><dd><Money value={Number(d.consumed_value_this_month)} className="text-base font-bold text-ink" /></dd></div>
      </dl>
    </section>
  );
}

export default function StockPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const chip = params.get("chip") || "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(chip === "low" ? { low_stock_only: "true" } : {}) }), [term, chip]);
  const list = useStockList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const setParam = (key, value, fallback = "") => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value && value !== fallback) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  const exportExcel = async () => {
    try {
      const res = await inventoryExportAPI.download();
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement("a"), { href: url, download: "inventory.xlsx" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download the Excel file. Try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Stock" actions={<>
        <IconButton label="More stock actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/stock-issues/new" className={buttonClass({ size: "sm" })}>Issue stock</Link>
      </>} />
      <div className="mt-3"><Summary /></div>
      <div className="mt-4 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search item name or code" aria-label="Search stock" enterKeyHint="search" />
        <Chips label="Show" options={CHIPS} value={chip} onChange={(v) => setParam("chip", v, "all")} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load stock." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={chip === "low" ? "Nothing is low" : "No items here"} body={chip === "low" ? "Every item is above its reorder level." : "Add items, then receive material against a purchase order."}
            action={<Link to="/inventory-items/new" className={buttonClass({ variant: "secondary" })}>Add an item</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/stock/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-ink">{r.name}</span>{r.is_low_stock && <Tag label="Low" tone="warn" />}</span>
                      <span className="block truncate text-xs text-ink-2">{[r.category?.name, attributesText(r)].filter(Boolean).join(" · ") || "—"}</span>
                      {Number(r.on_order) > 0 && <span className="block text-xs text-ink-2">On order {qty(r.on_order, r.unit)}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-num text-sm font-bold tabular-nums text-ink">{qty(r.in_stock, r.unit)}</span>
                      <Money value={Number(r.stock_value)} className="text-xs text-ink-2" />
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
      <ActionSheet open={menuOpen} title="Stock" onClose={() => setMenuOpen(false)} actions={[
        { label: "Download Excel of all stock", onSelect: exportExcel },
        { label: "Purchase orders", onSelect: () => navigate("/purchase-orders") },
        { label: "Stock issues", onSelect: () => navigate("/stock-issues") },
        { label: "Items", onSelect: () => navigate("/inventory-items") },
        { label: "Suppliers", onSelect: () => navigate("/suppliers") },
      ]} />
    </div>
  );
}
