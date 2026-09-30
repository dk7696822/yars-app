import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupplier, refreshStock } from "./api";
import { emptySupplier, formFromSupplier, validateSupplier, toSupplierPayload } from "./supplierForm";
import { supplierAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import PhoneInput from "../../ui/PhoneInput";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function SupplierFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const existing = useSupplier(id);
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromSupplier(existing.data) : null) : emptySupplier()), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const save = useMutation({
    mutationFn: (payload) => (isEdit ? supplierAPI.update(id, payload) : supplierAPI.create(payload)).then((r) => r.data.data),
    onSuccess: () => refreshStock(qc),
  });

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This supplier doesn't exist" action={<Link to="/suppliers" className={buttonClass({ variant: "secondary" })}>All suppliers</Link>} />
          : <ErrorState title="Couldn't load this supplier." onRetry={() => existing.refetch()} />}
      </div>
    );
  }
  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateSupplier(f, existing.data) : {};
  const back = () => navigate(isEdit ? `/suppliers/${id}` : "/suppliers", { replace: true });
  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateSupplier(f, existing.data)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toSupplierPayload(f), { onSuccess: (s) => { toast.success(isEdit ? "Changes saved" : "Supplier added"); navigate(`/suppliers/${s?.id || id}`, { replace: true }); } });
  };
  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit supplier" : "New supplier"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Name" htmlFor="sp-name" error={errors.name}><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Business name" /></Field>
        <Field label="Mobile" htmlFor="sp-phone" optional><PhoneInput value={f.phone} onChange={(phone) => set({ phone })} /></Field>
        <Field label="Email" htmlFor="sp-email" optional error={errors.email}><TextInput type="email" inputMode="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="GSTIN" htmlFor="sp-gst" optional error={errors.gst_number}><TextInput value={f.gst_number} onChange={(e) => set({ gst_number: e.target.value })} autoCapitalize="characters" /></Field>
        <Field label="Address" htmlFor="sp-address" optional><textarea rows={3} value={f.address} onChange={(e) => set({ address: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save supplier"}</Button>
        </div>
      </StickyFooter>
    </form>
  );
}
