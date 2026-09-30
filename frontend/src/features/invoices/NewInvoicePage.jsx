import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Search } from "lucide-react";
import { useUnbilledOrders, useGenerateInvoice } from "./api";
import { useCustomerSummary } from "../customers/api";
import CustomerPicker from "../customers/CustomerPicker";
import { INVOICE_STEPS, billableOrders, billingPeriod, invoiceTotals, invoiceErrors, toInvoicePayload } from "./invoiceDraft";
import Stepper from "../../ui/Stepper";
import PageHeader from "../../ui/PageHeader";
import StickyFooter from "../../ui/StickyFooter";
import Button from "../../ui/Button";
import Field from "../../ui/Field";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Switch from "../../ui/Switch";
import ReviewBlock from "../../ui/ReviewBlock";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "../../ui/States";
import { INPUT, INPUT_INVALID, FORM_PAGE } from "../../ui/styles";
import useSteps from "../../ui/useSteps";
import { itemsText, itemsFromLines } from "../../utils/itemsText";
import { ORDER_STATUS } from "../../utils/statusMeta";
import { addDays, todayIST } from "../../utils/istDate";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function NewInvoicePage() {
  const [search] = useSearchParams();
  const presetId = search.get("customer");
  const navigate = useNavigate();
  const toast = useToast();
  const preset = useCustomerSummary(presetId);
  const generate = useGenerateInvoice();

  const initial = useMemo(() => ({
    customer: preset.data ? { id: preset.data.customer.id, name: preset.data.customer.name, due: preset.data.owes } : null,
    selected: null, // null = every billable order (pre-ticked)
    gstOn: false,
    gst: "18",
    dueDate: addDays(todayIST(), 30),
  }), [preset.data]);
  const [edited, setEdited] = useState(null);
  const d = edited ?? initial;
  const update = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));

  const ordersQ = useUnbilledOrders(d.customer?.id);
  const billable = useMemo(() => billableOrders(ordersQ.data || []), [ordersQ.data]);
  const selected = d.selected ?? billable.map((o) => o.id);
  const chosen = billable.filter((o) => selected.includes(o.id));
  const full = { ...d, selected };
  const steps = useSteps({ count: INVOICE_STEPS.length, errorsFor: (i) => invoiceErrors(full, i), start: presetId ? 1 : 0 });
  const [picking, setPicking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (presetId && preset.isPending) return <PageSkeleton />;

  const step = d.customer ? steps.step : 0;
  const errors = steps.shownFor(step) ? invoiceErrors(full, step) : {};
  const totals = invoiceTotals(chosen, d.gstOn, d.gst);
  const period = billingPeriod(chosen);
  const toggle = (id) => update({ selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  const leave = () => navigate("/invoices", { replace: true });
  const back = () => (step === 0 ? (edited ? setConfirmLeave(true) : leave()) : steps.back());

  const submit = () => {
    if (!steps.validateAll()) return;
    generate.mutate(toInvoicePayload(full, chosen), {
      onSuccess: (inv) => {
        toast.success(`Invoice #${inv.invoice_number} created`);
        navigate(`/invoices/${inv.id}`, { replace: true });
      },
    });
  };

  return (
    <div className={`${FORM_PAGE} pt-3`}>
      <PageHeader title="New invoice" />
      <Stepper steps={INVOICE_STEPS} current={step} reached={d.customer ? steps.reached : 0} onGo={steps.go} />

      <div className="mt-4 pb-6">
        {step === 0 && (
          <Field label="Customer" htmlFor="inv-customer" error={errors.customer}>
            <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.customer ? INPUT_INVALID : ""}`}>
              {d.customer ? <span className="truncate font-semibold">{d.customer.name}</span> : <span className="text-ink-2">Choose a customer</span>}
              <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            </button>
          </Field>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="font-num text-lg font-semibold text-ink">{d.customer.name} — which orders?</h2>
            <p className="-mt-2 text-sm text-ink-2">Every order not yet invoiced is ticked.</p>
            {ordersQ.isPending ? (
              <ListSkeleton rows={3} />
            ) : ordersQ.isError ? (
              <ErrorState title="Couldn't load the orders." onRetry={() => ordersQ.refetch()} />
            ) : billable.length === 0 ? (
              <EmptyState title="Nothing to bill" body={`All of ${d.customer.name}'s orders are already on invoices (or cancelled).`} />
            ) : (
              <div className="space-y-2" role="group" aria-label="Orders to include">
                {billable.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <button key={o.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.id)} className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${on ? "bg-brass text-brass-on" : "bg-raised text-transparent"}`} aria-hidden="true"><Check className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{shortDate(o.order_date)} · {itemsText(itemsFromLines(o.orderProductSizes))}</span>
                        <span className="block text-xs text-ink-2">{inr(o.money.total)} · {o.money.due > 0 ? `due ${inr(o.money.due)}` : "paid"} · {ORDER_STATUS[o.status]?.label || o.status}</span>
                      </span>
                    </button>
                  );
                })}
                {errors.orders && <p role="alert" className="text-xs font-medium text-status-critical">{errors.orders}</p>}
              </div>
            )}
            <Switch checked={d.gstOn} onChange={(gstOn) => update({ gstOn })} label="Add GST" description={period ? `Billing period ${shortDate(period.from)} – ${shortDate(period.to)}, from the ticked orders` : undefined} />
            {d.gstOn && (
              <Field label="GST %" htmlFor="inv-gst" error={errors.gst}>
                <NumberInput value={d.gst} onChange={(gst) => update({ gst })} suffix="%" />
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <ReviewBlock title="Customer" onEdit={() => steps.go(0)}><p className="font-semibold">{d.customer.name}</p></ReviewBlock>
            <ReviewBlock title="Orders" onEdit={() => steps.go(1)}>
              <p>{chosen.length} order{chosen.length === 1 ? "" : "s"}{period && ` · ${shortDate(period.from)} – ${shortDate(period.to)}`}</p>
            </ReviewBlock>
            <dl className="space-y-1 rounded-2xl bg-surface px-4 py-3 text-sm">
              <div className="flex justify-between text-ink-2"><dt>Orders total</dt><dd><Money value={totals.subtotal} /></dd></div>
              <div className="flex justify-between text-ink-2"><dt>GST {totals.percent}%</dt><dd><Money value={totals.tax} /></dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink"><dt>Invoice total</dt><dd><Money value={totals.final} /></dd></div>
            </dl>
            <p className="px-1 text-sm text-ink-2">Invoice date: today, {shortDate(todayIST())}</p>
            <Field label="Payment due" htmlFor="inv-due" error={errors.dueDate}>
              <DateField quick={false} value={d.dueDate} onChange={(dueDate) => update({ dueDate })} />
            </Field>
          </div>
        )}
      </div>

      <StickyFooter>
        {generate.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(generate.error, "Couldn't create the invoice. Try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={back}>Back</Button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-ink-2">{chosen.length} order{chosen.length === 1 ? "" : "s"}</p>
            <Money value={totals.final} className="text-lg font-bold text-ink" />
          </div>
          {step < INVOICE_STEPS.length - 1
            ? <Button onClick={steps.next}>Next</Button>
            : <Button onClick={submit} loading={generate.isPending}>Create invoice</Button>}
        </div>
      </StickyFooter>

      <CustomerPicker open={picking} onClose={() => setPicking(false)} onPick={(customer) => { update({ customer, selected: null }); setPicking(false); }} />
      <ConfirmDialog open={confirmLeave} title="Leave without creating the invoice?" message="Your choices will be lost." confirmLabel="Leave" cancelLabel="Stay" onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </div>
  );
}
