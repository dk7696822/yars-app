import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useCustomer, useSaveCustomer } from "./api";
import SimilarWarning from "./SimilarWarning";
import { emptyCustomer, formFromCustomer, validateCustomer, toCustomerPayload } from "./customerForm";
import { useAssistantAction, reportFinishedInForm } from "../assistant/api";
import { customerFormFromAction } from "../assistant/formPrefill";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import PhoneInput from "../../ui/PhoneInput";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { INPUT, FORM_PAGE, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useCustomer(id);
  const save = useSaveCustomer(id);
  const presetName = search.get("name") || "";
  const assistantId = isEdit ? null : search.get("assistant");
  const actionQ = useAssistantAction(assistantId);
  const initial = useMemo(
    () => (isEdit ? (existing.data ? formFromCustomer(existing.data) : null) : assistantId && actionQ.data ? customerFormFromAction(actionQ.data) : { ...emptyCustomer(), name: presetName }),
    [isEdit, existing.data, presetName, assistantId, actionQ.data]
  );
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [moreOpen, setMoreOpen] = useState(null); // null = open only if those fields have values

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This customer doesn't exist" action={<Link to="/customers" className={buttonClass({ variant: "secondary" })}>All customers</Link>} />
          : <ErrorState title="Couldn't load this customer." onRetry={() => existing.refetch()} />}
      </div>
    );
  }
  if (assistantId && actionQ.isPending) return <PageSkeleton />;

  const form = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateCustomer(form) : {};
  const showMore = moreOpen ?? Boolean(form.email || form.address || form.gstin);

  const submit = (e) => {
    e.preventDefault();
    const errs = validateCustomer(form);
    if (Object.keys(errs).length) {
      setShown(true);
      if (errs.email || errs.gstin) setMoreOpen(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toCustomerPayload(form), {
      onSuccess: (c) => {
        reportFinishedInForm(assistantId, c.id, toCustomerPayload(form));
        toast.success(isEdit ? "Changes saved" : "Customer added");
        navigate(`/customers/${isEdit ? id : c.id}`, { replace: true });
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit customer" : "New customer"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Shop / customer name" htmlFor="c-name" error={errors.name}>
          <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} autoCapitalize="words" autoComplete="organization" autoFocus={!isEdit} />
        </Field>
        <SimilarWarning name={form.name} excludeId={id} />
        <Field label={<>Mobile <span className="font-normal">(for calls and WhatsApp reminders)</span></>} htmlFor="c-phone">
          <PhoneInput value={form.phone} onChange={(phone) => set({ phone })} />
        </Field>
        <Field label="City / area" htmlFor="c-city" optional>
          <TextInput value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Bidar, Bhalki" autoCapitalize="words" />
        </Field>
        {showMore ? (
          <div className="space-y-5">
            <Field label="Email" htmlFor="c-email" optional error={errors.email}>
              <TextInput type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Full address" htmlFor="c-address" optional>
              <textarea rows={3} value={form.address} onChange={(e) => set({ address: e.target.value })} className={`${INPUT} h-auto py-3`} />
            </Field>
            <Field label="GSTIN" htmlFor="c-gstin" optional error={errors.gstin} hint="Useful for GST invoices">
              <TextInput value={form.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} autoCapitalize="characters" maxLength={15} placeholder="29ABCDE1234F1Z5" className="font-num uppercase" />
            </Field>
          </div>
        ) : (
          <button type="button" onClick={() => setMoreOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2">
            <span>More details · email, full address, GSTIN</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => navigate(isEdit ? `/customers/${id}` : "/customers", { replace: true })}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save customer"}</Button>
        </div>
      </StickyFooter>
    </form>
  );
}
