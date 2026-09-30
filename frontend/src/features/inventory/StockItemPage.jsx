import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useItemStock, useMovements, rowsOf } from "./api";
import { qty, qtyText, attributesText, MOVEMENT, UNIT_LABEL } from "./labels";
import Tabs, { TabPanel } from "../../ui/Tabs";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { shortDate } from "../../utils/dashboardFormat";

const TABS = [{ value: "batches", label: "Batches" }, { value: "moves", label: "Movements" }, { value: "details", label: "Details" }];

function Movements({ itemId, unit }) {
  const list = useMovements(itemId, {});
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  if (list.isPending) return <ListSkeleton rows={4} />;
  if (list.isError && rows.length === 0) return <ErrorState title="Couldn't load movements." onRetry={() => list.refetch()} />;
  if (rows.length === 0) return <EmptyState title="No movements yet" />;
  return (
    <>
      <ul className="overflow-hidden rounded-2xl bg-surface">
        {rows.map((m, i) => {
          const meta = MOVEMENT[m.movement_type] || { label: m.movement_type, sign: "" };
          const n = Math.abs(Number(m.quantity));
          return (
            <li key={m.id || i} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{meta.label}</span>
                <span className="block truncate text-xs text-ink-2">{shortDate(String(m.movement_date).slice(0, 10))}{m.notes ? ` · ${m.notes}` : ""}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block font-num text-sm font-bold tabular-nums ${meta.sign === "+" ? "text-status-good" : "text-ink"}`}>{meta.sign}{qty(n, unit)}</span>
                {m.total_cost !== null && m.total_cost !== undefined && <Money value={Math.abs(Number(m.total_cost))} className="text-xs text-ink-2" />}
              </span>
            </li>
          );
        })}
      </ul>
      <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
    </>
  );
}

export default function StockItemPage() {
  const { itemId } = useParams();
  const [tab, setTab] = useState("batches");
  const q = useItemStock(itemId);
  if (q.isPending) return <PageSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {q.error?.response?.status === 404
          ? <EmptyState title="This item doesn't exist" body="It may have been deleted." action={<Link to="/stock" className={buttonClass({ variant: "secondary" })}>All stock</Link>} />
          : <ErrorState title="Couldn't load this item." onRetry={() => q.refetch()} />}
      </div>
    );
  }
  const { item, in_stock, stock_value, batches } = q.data;
  const low = Number(in_stock) <= Number(item.reorder_level) && Number(item.reorder_level) > 0;
  const unit = UNIT_LABEL[item.unit]?.[1] || item.unit;
  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{item.name}</h1>
            <p className="truncate text-sm text-ink-2">{[item.category?.name, attributesText(item)].filter(Boolean).join(" · ")}</p>
          </div>
          {low && <Tag label="Low stock" tone="warn" />}
        </div>
        <p className="mt-3 font-num text-3xl font-bold tabular-nums text-ink">{qty(in_stock, item.unit)}</p>
        <p className="text-sm text-ink-2">Worth <Money value={Number(stock_value)} className="font-semibold text-ink" /> · Reorder at {qtyText(item.reorder_level)} {unit}</p>
        <div className="mt-3 flex gap-2">
          <Link to={`/stock-issues/new?item=${item.id}`} className={buttonClass({ size: "sm" })}>Issue stock</Link>
          <Link to={`/purchase-orders/new?item=${item.id}`} className={buttonClass({ size: "sm", variant: "secondary" })}>Order more</Link>
        </div>
      </section>
      <div className="mt-4"><Tabs label="Item stock" tabs={TABS} value={tab} onChange={setTab} /></div>
      <TabPanel value={tab}>
        {tab === "batches" && (batches.length === 0 ? <EmptyState title="No stock on hand" body="Receive material against a purchase order to add stock." /> : (
          <>
            <p className="mb-2 px-1 text-xs text-ink-2">Used oldest first. Each batch keeps the rate it was bought at.</p>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {batches.map((b) => (
                <li key={b.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{shortDate(b.received_date)}{b.receipt_number ? ` · ${b.receipt_number}` : ""}</span>
                    <span className="block truncate text-xs text-ink-2">{b.supplier?.name || "Stock count"} · <Money value={Number(b.rate)} /> per {UNIT_LABEL[item.unit]?.[0] || item.unit}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-num text-sm font-bold tabular-nums text-ink">{qtyText(b.quantity_remaining)} of {qty(b.quantity_received, item.unit)}</span>
                    <Money value={Number(b.value)} className="text-xs text-ink-2" />
                  </span>
                </li>
              ))}
            </ul>
          </>
        ))}
        {tab === "moves" && <Movements itemId={item.id} unit={item.unit} />}
        {tab === "details" && (
          <dl className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface text-sm">
            {[["Code", item.item_code || "—"], ["Category", item.category?.name || "—"], ["Unit", unit], ["Reorder level", `${qtyText(item.reorder_level)} ${unit}`],
              ["Reorder up to", item.reorder_target ? `${qtyText(item.reorder_target)} ${unit}` : "—"], ["Details", attributesText(item) || "—"], ["Notes", item.notes || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-ink-2">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>
            ))}
            <div className="px-4 py-3"><Link to={`/inventory-items/edit/${item.id}`} className="font-semibold text-brass">Edit item</Link></div>
          </dl>
        )}
      </TabPanel>
    </div>
  );
}
