import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, MessageCircle, Ellipsis } from "lucide-react";
import { useSupplier, usePoList, rowsOf, refreshStock } from "./api";
import { PO_STATUS } from "./labels";
import { supplierAPI } from "../../services/inventoryAPI";
import Tabs, { TabPanel } from "../../ui/Tabs";
import Tag from "../../ui/Tag";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "../../ui/States";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { buttonClass } from "../../ui/styles";
import { telHref, whatsappHref } from "../../utils/phone";
import { shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const TABS = [{ value: "pos", label: "Purchase orders" }, { value: "details", label: "Details" }];
// The supplier endpoint lists POs without their lines, so totals come from the PO list filtered by supplier.
const poTotal = (po) => Math.round(Number(po.total_amount) * 100) / 100;

export default function SupplierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useSupplier(id);
  const poList = usePoList({ supplier_id: id });
  const sentinel = useInfiniteSentinel(poList);
  const [tab, setTab] = useState("pos");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useMutation({
    mutationFn: () => supplierAPI.delete(id),
    onSuccess: () => { refreshStock(qc); toast.success("Supplier deleted"); navigate("/suppliers", { replace: true }); },
    onError: (err) => { setConfirmDelete(false); toast.error(errorText(err, "Couldn't delete. Try again.")); },
  });

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {q.error?.response?.status === 404
          ? <EmptyState title="This supplier doesn't exist" body="It may have been deleted." action={<Link to="/suppliers" className={buttonClass({ variant: "secondary" })}>All suppliers</Link>} />
          : <ErrorState title="Couldn't load this supplier." onRetry={() => q.refetch()} />}
      </div>
    );
  }
  const s = q.data;
  const pos = rowsOf(poList);
  const tel = telHref(s.phone);
  const wa = whatsappHref(s.phone, "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{s.name}</h1>
            <p className="truncate text-sm text-ink-2">{s.phone || "No phone"}</p>
          </div>
          <IconButton label="More supplier actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tel && <a href={tel} className={buttonClass({ size: "sm", variant: "secondary" })}><Phone className="h-4 w-4" aria-hidden="true" />Call</a>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "secondary" })}><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</a>}
          <Link to={`/purchase-orders/new?supplier=${s.id}`} className={buttonClass({ size: "sm" })}>New purchase order</Link>
        </div>
      </section>
      <div className="mt-4"><Tabs label="Supplier" tabs={TABS} value={tab} onChange={setTab} /></div>
      <TabPanel value={tab}>
        {tab === "pos" && (poList.isPending ? <ListSkeleton rows={3} /> : poList.isError && pos.length === 0 ? <ErrorState title="Couldn't load purchase orders." onRetry={() => poList.refetch()} /> : pos.length === 0 ? <EmptyState title="No purchase orders yet" /> : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {pos.map((po) => {
                const st = PO_STATUS[po.status] || { label: po.status, tone: "muted" };
                return (
                  <li key={po.id} className="border-b border-line/60 last:border-0">
                    <Link to={`/purchase-orders/${po.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60">
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{po.po_number}</span><span className="block text-xs text-ink-2">{shortDate(po.order_date)}</span></span>
                      <span className="flex shrink-0 flex-col items-end gap-1"><Money value={poTotal(po)} className="text-sm font-semibold text-ink" /><Tag label={st.label} tone={st.tone} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{poList.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        ))}
        {tab === "details" && (
          <dl className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface text-sm">
            {[["Phone", s.phone || "—"], ["Email", s.email || "—"], ["GSTIN", s.gst_number || "—"], ["Address", s.address || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-ink-2">{k}</dt><dd className="break-words text-right font-medium text-ink">{v}</dd></div>
            ))}
          </dl>
        )}
      </TabPanel>
      <ActionSheet open={menuOpen} title={s.name} onClose={() => setMenuOpen(false)} actions={[
        { label: "Edit supplier", onSelect: () => navigate(`/suppliers/edit/${s.id}`) },
        { label: "Delete supplier", tone: "danger", onSelect: () => setConfirmDelete(true) },
      ]} />
      <ConfirmDialog open={confirmDelete} title={`Delete ${s.name}?`} message="A supplier with purchase orders can't be deleted — you'll see why." confirmLabel="Delete supplier" cancelLabel="Keep it"
        busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}
