import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";
import { usePo, refreshStock } from "./api";
import { PO_STATUS, poActions, qty, qtyText } from "./labels";
import { purchaseOrderAPI } from "../../services/inventoryAPI";
import Tabs, { TabPanel } from "../../ui/Tabs";
import Tag from "../../ui/Tag";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const TABS = [{ value: "lines", label: "Items" }, { value: "receipts", label: "Deliveries" }, { value: "details", label: "Details" }];
const paise = (x) => Math.round(Number(x) * 100);

export default function PurchaseOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = usePo(id);
  const [tab, setTab] = useState("lines");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // "cancel" | "delete"
  const act = useMutation({
    mutationFn: (kind) => (kind === "cancel" ? purchaseOrderAPI.cancel(id) : purchaseOrderAPI.delete(id)),
    onSuccess: (_, kind) => {
      refreshStock(qc);
      setConfirm(null);
      if (kind === "delete") { toast.success("Purchase order deleted"); navigate("/purchase-orders", { replace: true }); }
      else toast.success("Purchase order cancelled");
    },
    onError: (err) => { setConfirm(null); toast.error(errorText(err, "That didn't work. Try again.")); },
  });

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {q.error?.response?.status === 404
          ? <EmptyState title="This purchase order doesn't exist" body="It may have been deleted." action={<Link to="/purchase-orders" className={buttonClass({ variant: "secondary" })}>All purchase orders</Link>} />
          : <ErrorState title="Couldn't load this purchase order." onRetry={() => q.refetch()} />}
      </div>
    );
  }
  const po = q.data;
  const s = PO_STATUS[po.status] || { label: po.status, tone: "muted" };
  const can = poActions(po);
  const receipts = po.receipts || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{po.po_number}</h1>
            <p className="truncate text-sm text-ink-2">{po.supplier ? <Link to={`/suppliers/${po.supplier.id}`} className="text-brass">{po.supplier.name}</Link> : "—"} · {shortDate(po.order_date)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Tag label={s.label} tone={s.tone} />
            {(can.canCancel || can.canDelete) && <IconButton label="More purchase order actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>}
          </div>
        </div>
        <Money value={paise(po.total_amount) / 100} className="mt-3 block text-3xl font-bold text-ink" />
        {po.expected_date && <p className="text-sm text-ink-2">Expected {shortDate(po.expected_date)}</p>}
        {can.canReceive && <Link to={`/purchase-orders/${po.id}/receive`} className={`${buttonClass({ block: true })} mt-3`}>Receive material</Link>}
      </section>
      <div className="mt-4"><Tabs label="Purchase order" tabs={TABS} value={tab} onChange={setTab} /></div>
      <TabPanel value={tab}>
        {tab === "lines" && (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {po.items.map((l) => {
              const done = Number(l.quantity_received) >= Number(l.quantity_ordered);
              return (
                <li key={l.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{l.item?.name}</span>
                    <span className="block text-xs text-ink-2">{qty(l.quantity_ordered, l.item?.unit)} × <Money value={Number(l.rate)} /></span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block font-num text-sm font-semibold tabular-nums ${done ? "text-status-good" : "text-ink"}`}>{qtyText(l.quantity_received)} received</span>
                    {!done && po.status !== "CANCELLED" && <span className="text-xs text-status-warn">{qty(l.quantity_pending, l.item?.unit)} to come</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {tab === "receipts" && (receipts.length === 0 ? <EmptyState title="Nothing received yet" /> : (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {receipts.map((r) => {
              const value = (r.items || []).reduce((sum, i) => sum + Math.round(Number(i.quantity_received) * Number(i.rate) * 100), 0) / 100;
              return (
                <li key={r.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{r.receipt_number} · {shortDate(r.receipt_date)}</span>
                    <span className="block truncate text-xs text-ink-2">{(r.items || []).length} item{(r.items || []).length === 1 ? "" : "s"}{r.supplier_bill_ref ? ` · Bill ${r.supplier_bill_ref}` : ""}</span>
                  </span>
                  <Money value={value} className="shrink-0 text-sm font-semibold text-ink" />
                </li>
              );
            })}
          </ul>
        ))}
        {tab === "details" && (
          <dl className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface text-sm">
            {[["Supplier", po.supplier?.name || "—"], ["Phone", po.supplier?.phone || "—"], ["Ordered", shortDate(po.order_date)], ["Expected", po.expected_date ? shortDate(po.expected_date) : "—"], ["Notes", po.notes || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-ink-2">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>
            ))}
          </dl>
        )}
      </TabPanel>
      <ActionSheet open={menuOpen} title={po.po_number} onClose={() => setMenuOpen(false)} actions={[
        can.canCancel && { label: "Cancel purchase order", tone: "danger", onSelect: () => setConfirm("cancel") },
        can.canDelete && { label: "Delete purchase order", tone: "danger", onSelect: () => setConfirm("delete") },
      ]} />
      <ConfirmDialog open={confirm === "cancel"} title="Cancel this purchase order?" message="It stays in the list as cancelled. Nothing can be received against it." confirmLabel="Cancel order" cancelLabel="Keep it" busy={act.isPending} onConfirm={() => act.mutate("cancel")} onClose={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "delete"} title="Delete this purchase order?" message="It will be removed completely." confirmLabel="Delete order" cancelLabel="Keep it" busy={act.isPending} onConfirm={() => act.mutate("delete")} onClose={() => setConfirm(null)} />
    </div>
  );
}
