import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePo, refreshStock } from "./api";
import { poActions, qty, qtyText, UNIT_LABEL } from "./labels";
import { receiveLinesFromPo, receiveErrors, isOverReceipt, receiveTotal, toReceivePayload } from "./receiveForm";
import { purchaseOrderAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, buttonClass } from "../../ui/styles";
import { todayIST } from "../../utils/istDate";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function ReceivePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = usePo(id);
  const initial = useMemo(() => (q.data ? { receipt_date: todayIST(), supplier_bill_ref: "", notes: "", lines: receiveLinesFromPo(q.data) } : null), [q.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const save = useMutation({ mutationFn: (payload) => purchaseOrderAPI.receive(id, payload), onSuccess: () => refreshStock(qc) });

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <div className="mx-auto max-w-xl px-4 py-6"><ErrorState title="Couldn't load this purchase order." onRetry={() => q.refetch()} /></div>;
  const po = q.data;
  const toPo = () => navigate(`/purchase-orders/${id}`, { replace: true });
  if (!poActions(po).canReceive) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <EmptyState title={po.status === "CANCELLED" ? "This order is cancelled" : "Everything has been received"} body="Nothing more can be received against it."
          action={<Link to={`/purchase-orders/${id}`} className={buttonClass({ variant: "secondary" })}>Back to {po.po_number}</Link>} />
      </div>
    );
  }
  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const setLine = (lid, patch) => set({ lines: f.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const errors = shown ? receiveErrors(f) : {};
  const total = receiveTotal(f);

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(receiveErrors(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: "center" }));
      return;
    }
    save.mutate(toReceivePayload(f), { onSuccess: () => { toast.success("Material received — stock updated"); toPo(); } });
  };

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title="Receive material" subtitle={`${po.po_number} · ${po.supplier?.name || ""}`} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Arrived on" htmlFor="rc-date" error={errors.receipt_date}><DateField value={f.receipt_date} onChange={(receipt_date) => set({ receipt_date })} /></Field>
        <Field label="Supplier's bill number" htmlFor="rc-ref" optional><TextInput value={f.supplier_bill_ref} onChange={(e) => set({ supplier_bill_ref: e.target.value })} /></Field>
        <div className="space-y-3">
          <p className="text-[0.8rem] font-semibold text-ink-2">What arrived — leave a line blank if it didn't come</p>
          {f.lines.map((l) => {
            const unit = UNIT_LABEL[l.unit];
            return (
              <section key={l.id} aria-label={l.name} className="space-y-3 rounded-2xl bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-sm font-semibold text-ink">{l.name}</h2>
                  <span className="shrink-0 text-xs text-ink-2">{qtyText(l.received)} of {qty(l.ordered, l.unit)} received</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" htmlFor={`rc-q-${l.id}`} error={errors[`qty:${l.id}`]}><NumberInput value={l.quantity} onChange={(quantity) => setLine(l.id, { quantity })} suffix={unit?.[1]} placeholder="0" /></Field>
                  <Field label={`Rate${unit ? ` per ${unit[0]}` : ""}`} htmlFor={`rc-r-${l.id}`} error={errors[`rate:${l.id}`]}><NumberInput value={l.rate} onChange={(rate) => setLine(l.id, { rate })} prefix="₹" /></Field>
                </div>
                {isOverReceipt(l) && <p className="text-xs font-medium text-status-warn">More than the {qty(l.pending, l.unit)} still to come — the extra will be recorded.</p>}
              </section>
            );
          })}
          {errors.lines && <p role="alert" className="text-sm font-medium text-status-critical">{errors.lines}</p>}
        </div>
        <Field label="Notes" htmlFor="rc-notes" optional><textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={toPo}>Back</Button>
          <div className="min-w-0 flex-1 text-right"><p className="text-xs text-ink-2">Value</p><Money value={total} className="text-lg font-bold text-ink" /></div>
          <Button type="submit" loading={save.isPending}>Save</Button>
        </div>
      </StickyFooter>
    </form>
  );
}
