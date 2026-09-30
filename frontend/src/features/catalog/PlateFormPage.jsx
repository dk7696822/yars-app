import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePlate, useSavePlate, useDeletePlate } from "./api";
import { emptyPlate, formFromPlate, validatePlate, toPlatePayload } from "./plateForm";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function PlateFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const existing = usePlate(id);
  const save = useSavePlate(id);
  const remove = useDeletePlate();
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromPlate(existing.data) : null) : emptyPlate()), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This plate type doesn't exist" action={<Link to="/plate-types" className={buttonClass({ variant: "secondary" })}>All plate types</Link>} />
          : <ErrorState title="Couldn't load this plate type." onRetry={() => existing.refetch()} />}
      </div>
    );
  }

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validatePlate(f) : {};
  const back = () => navigate("/plate-types", { replace: true });

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validatePlate(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toPlatePayload(f), { onSuccess: () => { toast.success(isEdit ? "Plate type updated" : "Plate type added"); back(); } });
  };

  const deletePlate = () =>
    remove.mutate(id, {
      onSuccess: () => { toast.success("Plate type deleted"); back(); },
      onError: (err) => toast.error(errorText(err, "Couldn't delete the plate type. Try again.")),
    });

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit plate type" : "New plate type"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Name" htmlFor="pl-name" error={errors.type_name}>
          <TextInput value={f.type_name} onChange={(e) => set({ type_name: e.target.value })} placeholder="e.g. 2 colour" autoFocus={!isEdit} />
        </Field>
        <Field label="Charge" htmlFor="pl-charge" error={errors.charge}
          hint={isEdit
            ? "Orders that use this plate type without their own plate charge will show the new charge too — including past orders."
            : "Added once to each order that uses this plate type (an order can override it)."}>
          <NumberInput prefix="₹" value={f.charge} onChange={(v) => set({ charge: v })} />
        </Field>
        {isEdit && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete plate type</Button>}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save plate type"}</Button>
        </div>
      </StickyFooter>
      <ConfirmDialog open={confirmDelete} title={`Delete ${f.type_name || "this plate type"}?`} confirmLabel="Delete plate type" cancelLabel="Keep it" busy={remove.isPending}
        message="It won't be offered for new orders. Past orders keep it." onConfirm={deletePlate} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
