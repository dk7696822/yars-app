import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Plus } from "lucide-react";
import { useItemStock, refreshStock } from "./api";
import { ISSUE_TYPES, ISSUE_TYPE_OPTIONS, qty, UNIT_LABEL } from "./labels";
import { emptyIssue, newIssueLine, isAdjustment, takesOrder, issueErrors, shortfalls, toIssuePayload } from "./issueForm";
import { rememberItems } from "./recentItems";
import ItemPicker from "./ItemPicker";
import OrderPicker from "./OrderPicker";
import { stockIssueAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { FORM_PAGE, INPUT, INPUT_INVALID } from "../../ui/styles";
import { todayIST } from "../../utils/istDate";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function NewStockIssuePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const preset = useItemStock(params.get("item"));
  const initial = useMemo(() => emptyIssue(todayIST(), preset.data ? { ...preset.data.item, in_stock: Number(preset.data.in_stock) } : undefined), [preset.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [itemFor, setItemFor] = useState(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const save = useMutation({ mutationFn: (payload) => stockIssueAPI.create(payload).then((r) => r.data.data), onSuccess: () => refreshStock(qc) });

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const setLine = (key, patch) => set({ lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const errors = shown ? issueErrors(f) : {};
  const short = shortfalls(f);
  const type = ISSUE_TYPES[f.issue_type];
  const leave = () => navigate("/stock-issues", { replace: true });

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(issueErrors(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: "center" }));
      return;
    }
    const payload = toIssuePayload(f);
    save.mutate(payload, {
      onSuccess: (issue) => {
        rememberItems(payload.items.map((i) => i.item_id));
        toast.success(`${issue.issue_number || "Stock issue"} saved — stock updated`);
        leave();
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title="Issue stock" />
      <div className="space-y-5 pb-6 sm:mt-4">
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">What happened</p>
          <Chips label="Type" options={ISSUE_TYPE_OPTIONS} value={f.issue_type} onChange={(issue_type) => set({ issue_type })} />
          <p className="mt-1.5 text-xs text-ink-2">{type.hint}</p>
        </div>
        <Field label="Date" htmlFor="si-date" error={errors.issue_date}><DateField value={f.issue_date} onChange={(issue_date) => set({ issue_date })} /></Field>
        {takesOrder(f.issue_type) && (
          <div>
            <Field label="For order" htmlFor="si-order" optional>
              <button type="button" onClick={() => setOrderOpen(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left`}>
                {f.order ? <span className="truncate font-semibold">{f.order.label}</span> : <span className="text-ink-2">Choose an order</span>}
                <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
              </button>
            </Field>
            {f.order && <button type="button" onClick={() => set({ order: null })} className="mt-1.5 text-sm font-semibold text-brass">Clear order</button>}
          </div>
        )}
        <div className="space-y-3">
          {f.lines.map((l, i) => {
            const unit = UNIT_LABEL[l.unit];
            return (
              <section key={l.key} aria-label={`Item ${i + 1}`} className="space-y-3 rounded-2xl bg-surface p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label={`Item ${i + 1}`} htmlFor={`si-item-${l.key}`} error={errors[`item:${l.key}`]} hint={l.item_id && l.in_stock !== undefined ? `In stock: ${qty(l.in_stock, l.unit)}` : undefined}>
                      <button type="button" onClick={() => setItemFor(l.key)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors[`item:${l.key}`] ? INPUT_INVALID : ""}`}>
                        {l.item_id ? <span className="truncate font-semibold">{l.item_name}</span> : <span className="text-ink-2">Choose an item</span>}
                        <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                      </button>
                    </Field>
                  </div>
                  {f.lines.length > 1 && <IconButton label={`Remove item ${i + 1}`} onClick={() => set({ lines: f.lines.filter((x) => x.key !== l.key) })} className="mt-6 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={f.issue_type === "WASTAGE" ? "Wasted" : "Quantity"} htmlFor={`si-q-${l.key}`} error={errors[`qty:${l.key}`]}>
                    <NumberInput value={l.quantity} onChange={(quantity) => setLine(l.key, { quantity })} suffix={unit?.[1]} />
                  </Field>
                  {f.issue_type === "ISSUE" && (
                    <Field label="Wasted too" htmlFor={`si-w-${l.key}`} optional error={errors[`waste:${l.key}`]}>
                      <NumberInput value={l.wastage} onChange={(wastage) => setLine(l.key, { wastage })} suffix={unit?.[1]} placeholder="0" />
                    </Field>
                  )}
                </div>
                {short[l.key] > 0 && <p className="text-xs font-medium text-status-critical">Only {qty(l.in_stock, l.unit)} in stock — {qty(short[l.key], l.unit)} short. It won't save until stock is received.</p>}
              </section>
            );
          })}
          {errors.lines && <p role="alert" className="text-sm font-medium text-status-critical">{errors.lines}</p>}
          <Button variant="secondary" block onClick={() => set({ lines: [...f.lines, newIssueLine()] })}><Plus className="h-4 w-4" aria-hidden="true" />Add another item</Button>
        </div>
        <Field label="Reason" htmlFor="si-reason" optional={!isAdjustment(f.issue_type)} error={errors.reason}>
          <TextInput value={f.reason} onChange={(e) => set({ reason: e.target.value })} placeholder={isAdjustment(f.issue_type) ? "e.g. Monthly stock count" : ""} />
        </Field>
        <Field label="Notes" htmlFor="si-notes" optional><textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => (edited ? setConfirmLeave(true) : leave())}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>Save</Button>
        </div>
      </StickyFooter>
      <ItemPicker withStock open={Boolean(itemFor)} onClose={() => setItemFor(null)}
        onPick={(it) => { setLine(itemFor, { item_id: it.id, item_name: it.name, unit: it.unit, in_stock: it.in_stock }); setItemFor(null); }} />
      <OrderPicker open={orderOpen} onClose={() => setOrderOpen(false)} onPick={(order) => { set({ order }); setOrderOpen(false); }} />
      <ConfirmDialog open={confirmLeave} title="Leave without saving?" message="What you entered will be lost." confirmLabel="Leave" cancelLabel="Stay" onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </form>
  );
}
