import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Plus } from "lucide-react";
import { useItemsPicker, useSuppliersPicker, refreshStock } from "./api";
import { PO_STEPS, emptyPo, newPoLine, lineAmount, poTotal, poErrors, toPoPayload } from "./poDraft";
import { qty, UNIT_LABEL } from "./labels";
import ItemPicker from "./ItemPicker";
import SupplierPicker from "./SupplierPicker";
import { purchaseOrderAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Stepper from "../../ui/Stepper";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ReviewBlock from "../../ui/ReviewBlock";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { FORM_PAGE, INPUT, INPUT_INVALID } from "../../ui/styles";
import useSteps from "../../ui/useSteps";
import { todayIST } from "../../utils/istDate";
import { shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const presetItemId = params.get("item");
  const presetSupplierId = params.get("supplier");
  const picker = useItemsPicker();
  const suppliers = useSuppliersPicker();
  const initial = useMemo(() => {
    const found = (suppliers.data || []).find((s) => s.id === presetSupplierId);
    return { ...emptyPo(todayIST(), (picker.data || []).find((i) => i.id === presetItemId)), supplier: found ? { id: found.id, name: found.name } : null };
  }, [picker.data, presetItemId, suppliers.data, presetSupplierId]);
  const [edited, setEdited] = useState(null);
  const d = edited ?? initial;
  const update = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const setLine = (key, patch) => update({ lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const steps = useSteps({ count: PO_STEPS.length, errorsFor: (i) => poErrors(d, i) });
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [itemFor, setItemFor] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const create = useMutation({ mutationFn: (payload) => purchaseOrderAPI.create(payload).then((r) => r.data.data), onSuccess: () => refreshStock(qc) });

  const step = steps.step;
  const errors = steps.shownFor(step) ? poErrors(d, step) : {};
  const total = poTotal(d);
  const leave = () => navigate("/purchase-orders", { replace: true });
  const back = () => (step === 0 ? (edited ? setConfirmLeave(true) : leave()) : steps.back());
  const submit = () => {
    if (!steps.validateAll()) return;
    create.mutate(toPoPayload(d), { onSuccess: (po) => { toast.success(`Purchase order ${po.po_number} created`); navigate(`/purchase-orders/${po.id}`, { replace: true }); } });
  };
  const filled = d.lines.filter((l) => l.item_id);

  return (
    <div className={`${FORM_PAGE} pt-3`}>
      <PageHeader title="New purchase order" />
      <Stepper steps={PO_STEPS} current={step} reached={steps.reached} onGo={steps.go} />
      <div className="mt-4 space-y-5 pb-6">
        {step === 0 && (
          <>
            <Field label="Supplier" htmlFor="po-supplier" error={errors.supplier}>
              <button type="button" onClick={() => setSupplierOpen(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.supplier ? INPUT_INVALID : ""}`}>
                {d.supplier ? <span className="truncate font-semibold">{d.supplier.name}</span> : <span className="text-ink-2">Choose a supplier</span>}
                <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
              </button>
            </Field>
            <Field label="Order date" htmlFor="po-date" error={errors.order_date}><DateField value={d.order_date} onChange={(order_date) => update({ order_date })} /></Field>
            <Field label="Expected by" htmlFor="po-expected" optional error={errors.expected_date}><DateField quick={false} value={d.expected_date} onChange={(expected_date) => update({ expected_date })} /></Field>
            <Field label="Notes" htmlFor="po-notes" optional><textarea rows={2} value={d.notes} onChange={(e) => update({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
          </>
        )}
        {step === 1 && (
          <div className="space-y-3">
            {d.lines.map((l, i) => {
              const amount = lineAmount(l);
              const unit = UNIT_LABEL[l.unit];
              return (
                <section key={l.key} aria-label={`Item ${i + 1}`} className="space-y-3 rounded-2xl bg-surface p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label={`Item ${i + 1}`} htmlFor={`po-item-${l.key}`} error={errors[`item:${l.key}`]}>
                        <button type="button" onClick={() => setItemFor(l.key)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors[`item:${l.key}`] ? INPUT_INVALID : ""}`}>
                          {l.item_id ? <span className="truncate font-semibold">{l.item_name}</span> : <span className="text-ink-2">Choose an item</span>}
                          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                        </button>
                      </Field>
                    </div>
                    {d.lines.length > 1 && <IconButton label={`Remove item ${i + 1}`} onClick={() => update({ lines: d.lines.filter((x) => x.key !== l.key) })} className="mt-6 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity" htmlFor={`po-qty-${l.key}`} error={errors[`qty:${l.key}`]}><NumberInput value={l.quantity} onChange={(quantity) => setLine(l.key, { quantity })} suffix={unit?.[1]} /></Field>
                    <Field label={`Rate${unit ? ` per ${unit[0]}` : ""}`} htmlFor={`po-rate-${l.key}`} error={errors[`rate:${l.key}`]}><NumberInput value={l.rate} onChange={(rate) => setLine(l.key, { rate })} prefix="₹" /></Field>
                  </div>
                  {amount !== null && <p className="text-right text-sm text-ink-2">Amount <Money value={amount} className="font-semibold text-ink" /></p>}
                </section>
              );
            })}
            {errors.lines && <p role="alert" className="text-sm font-medium text-status-critical">{errors.lines}</p>}
            <Button variant="secondary" block onClick={() => update({ lines: [...d.lines, newPoLine()] })}><Plus className="h-4 w-4" aria-hidden="true" />Add another item</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-2">
            <ReviewBlock title="Supplier" onEdit={() => steps.go(0)}>
              <p className="font-semibold">{d.supplier?.name}</p>
              <p className="text-ink-2">Ordered {shortDate(d.order_date)}{d.expected_date ? ` · expected ${shortDate(d.expected_date)}` : ""}</p>
            </ReviewBlock>
            <ReviewBlock title="Items" onEdit={() => steps.go(1)}>
              <ul className="space-y-1">
                {filled.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3"><span className="truncate">{l.item_name} · {qty(l.quantity.replace(/,/g, ""), l.unit)}</span><Money value={lineAmount(l) || 0} /></li>
                ))}
              </ul>
            </ReviewBlock>
          </div>
        )}
      </div>
      <StickyFooter>
        {create.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(create.error, "Couldn't create the purchase order. Try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={back}>Back</Button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-ink-2">{filled.length} item{filled.length === 1 ? "" : "s"}</p>
            <Money value={total} className="text-lg font-bold text-ink" />
          </div>
          {step < PO_STEPS.length - 1 ? <Button onClick={steps.next}>Next</Button> : <Button onClick={submit} loading={create.isPending}>Create order</Button>}
        </div>
      </StickyFooter>
      <SupplierPicker open={supplierOpen} onClose={() => setSupplierOpen(false)} onPick={(supplier) => { update({ supplier }); setSupplierOpen(false); }} />
      <ItemPicker open={Boolean(itemFor)} onClose={() => setItemFor(null)} onPick={(it) => { setLine(itemFor, { item_id: it.id, item_name: it.name, unit: it.unit }); setItemFor(null); }} />
      <ConfirmDialog open={confirmLeave} title="Leave without creating the order?" message="What you entered will be lost." confirmLabel="Leave" cancelLabel="Stay" onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </div>
  );
}
