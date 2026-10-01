import { useState } from "react";
import PropTypes from "prop-types";
import Sheet from "../../ui/Sheet";
import Field from "../../ui/Field";
import NumberInput from "../../ui/NumberInput";
import TextInput from "../../ui/TextInput";
import DateField from "../../ui/DateField";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import { Money } from "../../ui/Money";
import { useSavePayment } from "./api";
import { validatePayment, initialPaymentForm, SHEET_TEXT } from "./paymentForm";
import { PAYMENT_METHODS, PAYMENT_TYPE_LABEL } from "../../utils/paymentType";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";
import { INVOICE_ONLY, defaultInvoiceChoice } from "../invoices/paymentChoices";

const METHOD_OPTIONS = PAYMENT_METHODS.map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(PAYMENT_TYPE_LABEL).map(([value, label]) => ({ value, label }));

/**
 * Record or edit one payment. Give it a new `key` each time it opens so it starts
 * fresh. `orderChoices` (invoice page): which of the invoice's orders it is for.
 */
export default function PaymentSheet({ open, onClose, mode, orderId, invoiceId, due = 0, received = 0, payment = null, orderChoices = null, prefill = null, onSaved }) {
  const toast = useToast();
  const save = useSavePayment();
  const [form, setForm] = useState(() => initialPaymentForm(payment || prefill));
  const [choice, setChoice] = useState(() => (orderChoices ? defaultInvoiceChoice(orderChoices) : orderId));
  const [errors, setErrors] = useState({});
  const [overpay, setOverpay] = useState(0);
  const [more, setMore] = useState(Boolean((payment || prefill)?.reference || (payment || prefill)?.notes));

  // On an invoice, "due" is the invoice's due (GST included); the chosen order only decides where the money is saved.
  const picked = orderChoices?.find((o) => o.id === choice);
  const currentDue = due;
  const currentReceived = picked ? picked.received : received;
  const text = SHEET_TEXT[mode];
  const check = () => validatePayment({ mode, form, due: currentDue, received: currentReceived });
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setOverpay(0);
  };

  const submit = () => {
    const result = check();
    setErrors(result.errors);
    if (!result.payload) return;
    if (result.overpay > 0 && overpay === 0) {
      setOverpay(result.overpay);
      return;
    }
    // Money for the invoice as a whole (e.g. GST) is saved without an order.
    const body = { ...result.payload, ...(choice === INVOICE_ONLY ? {} : { order_id: choice }), ...(invoiceId ? { invoice_id: invoiceId } : {}) };
    save.mutate({ id: payment?.id, body }, {
      onSuccess: (saved) => {
        onSaved?.(saved, body);
        toast.success(text.done);
        onClose();
      },
    });
  };

  const preview = mode === "payment" ? check().payload : null;

  return (
    <Sheet open={open} title={text.title} onClose={onClose}
      footer={
        <div className="space-y-2">
          {overpay > 0 && <p role="alert" className="rounded-2xl bg-status-warn/10 px-3 py-2 text-sm text-status-warn">That&apos;s {inr(overpay)} more than the due. It will show as extra received.</p>}
          {save.isError && <p role="alert" className="text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
          <Button block size="lg" loading={save.isPending} onClick={submit}>{overpay > 0 ? "Save anyway" : text.save}</Button>
        </div>
      }>
      <div className="space-y-4">
        {orderChoices && (
          <fieldset>
            <legend className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Money is for</legend>
            <div role="radiogroup" className="space-y-1.5">
              {orderChoices.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={o.id === choice} onClick={() => { setChoice(o.id); setOverpay(0); }}
                  className={`flex w-full justify-between rounded-2xl border px-3 py-2.5 text-sm ${o.id === choice ? "border-brass bg-brass/10 text-ink" : "border-line text-ink-2"}`}>
                  <span>{shortDate(o.orderDate)}</span>
                  {o.due > 0 ? <span>due <Money value={o.due} /></span> : <span>paid</span>}
                </button>
              ))}
              <button type="button" role="radio" aria-checked={choice === INVOICE_ONLY} onClick={() => { setChoice(INVOICE_ONLY); setOverpay(0); }}
                className={`flex w-full justify-between rounded-2xl border px-3 py-2.5 text-left text-sm ${choice === INVOICE_ONLY ? "border-brass bg-brass/10 text-ink" : "border-line text-ink-2"}`}>
                <span>The invoice itself</span>
                <span>e.g. GST, not on an order</span>
              </button>
            </div>
          </fieldset>
        )}

        <Field label="Amount" htmlFor="pay-amount" error={errors.amount} hint={mode === "refund" ? `Received so far ${inr(currentReceived)}` : undefined}>
          <NumberInput autoFocus value={form.amount} onChange={(amount) => set({ amount })} prefix="₹" />
        </Field>
        {mode === "payment" && currentDue > 0 && (
          <button type="button" onClick={() => set({ amount: String(currentDue) })}
            className="-mt-2 h-8 rounded-full border border-line px-3 text-xs font-semibold text-ink-2 hover:text-ink">
            Full due {inr(currentDue)}
          </button>
        )}
        {preview && <p className="text-xs text-ink-2">Saved as <span className="font-semibold text-ink">{PAYMENT_TYPE_LABEL[preview.payment_type]}</span></p>}

        {mode === "edit" && (
          <div>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Type</p>
            <Chips label="Payment type" options={TYPE_OPTIONS} value={form.type} onChange={(type) => set({ type })} />
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Paid by</p>
          <Chips label="Payment method" options={METHOD_OPTIONS} value={form.method} onChange={(method) => set({ method })} />
        </div>
        <Field label="Date" htmlFor="pay-date" error={errors.date}>
          <DateField value={form.date} onChange={(date) => set({ date })} />
        </Field>
        {more ? (
          <>
            <Field label="Reference" htmlFor="pay-ref" optional><TextInput value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="UPI ref, cheque no." /></Field>
            <Field label="Note" htmlFor="pay-note" optional><TextInput value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-brass">＋ Add reference or note</button>
        )}
      </div>
    </Sheet>
  );
}

PaymentSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  prefill: PropTypes.object,
  onSaved: PropTypes.func,
  mode: PropTypes.oneOf(["payment", "advance", "refund", "edit"]).isRequired,
  orderId: PropTypes.string,
  invoiceId: PropTypes.string,
  due: PropTypes.number,
  received: PropTypes.number,
  payment: PropTypes.object,
  orderChoices: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, orderDate: PropTypes.string.isRequired, due: PropTypes.number.isRequired, received: PropTypes.number.isRequired })),
};
