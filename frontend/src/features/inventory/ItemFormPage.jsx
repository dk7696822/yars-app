import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useItem, useInvCategories, useAttributes, refreshStock } from "./api";
import { emptyItem, formFromItem, validateItem, toItemPayload } from "./itemForm";
import { UNITS, UNIT_LABEL } from "./labels";
import { inventoryItemAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function ItemFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const existing = useItem(id);
  const categories = useInvCategories();
  const attributes = useAttributes();
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromItem(existing.data) : null) : emptyItem()), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useMutation({
    mutationFn: (payload) => (isEdit ? inventoryItemAPI.update(id, payload) : inventoryItemAPI.create(payload)),
    onSuccess: () => refreshStock(qc),
  });
  const remove = useMutation({ mutationFn: () => inventoryItemAPI.delete(id), onSuccess: () => refreshStock(qc) });

  if ((isEdit && existing.isPending) || categories.isPending || attributes.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This item doesn't exist" body="It may have been deleted." action={<Link to="/inventory-items" className={buttonClass({ variant: "secondary" })}>All items</Link>} />
          : <ErrorState title="Couldn't load this item." onRetry={() => existing.refetch()} />}
      </div>
    );
  }
  if (categories.isError || attributes.isError) return <div className="px-4 py-6"><ErrorState title="Couldn't load categories." onRetry={() => { categories.refetch(); attributes.refetch(); }} /></div>;

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateItem(f) : {};
  const back = () => navigate("/inventory-items", { replace: true });
  const unitWord = UNIT_LABEL[f.unit]?.[1] || "";

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateItem(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toItemPayload(f), { onSuccess: () => { toast.success(isEdit ? "Item updated" : "Item added"); back(); } });
  };
  const deleteItem = () => remove.mutate(undefined, {
    onSuccess: () => { toast.success("Item deleted"); back(); },
    onError: (err) => { setConfirmDelete(false); toast.error(errorText(err, "Couldn't delete the item. Try again.")); },
  });
  const catOptions = (categories.data || []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit item" : "New item"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Name" htmlFor="it-name" error={errors.name}><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. PP granules" /></Field>
        <Field label="Code" htmlFor="it-code" optional><TextInput value={f.item_code} onChange={(e) => set({ item_code: e.target.value })} placeholder="Your own short code" /></Field>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Category</p>
          {catOptions.length ? <Chips label="Category" options={catOptions} value={f.category_id} onChange={(category_id) => set({ category_id })} />
            : <p className="text-sm text-ink-2">No categories yet. <Link to="/inventory-categories" className="font-semibold text-brass">Add one</Link></p>}
          {errors.category_id && <p role="alert" className="mt-1.5 text-xs font-medium text-status-critical">{errors.category_id}</p>}
        </div>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Counted in</p>
          <Chips label="Unit" options={UNITS} value={f.unit} onChange={(unit) => set({ unit })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reorder at" htmlFor="it-reorder" error={errors.reorder_level} hint="Shown as low stock at or below this">
            <NumberInput value={f.reorder_level} onChange={(reorder_level) => set({ reorder_level })} suffix={unitWord} placeholder="0" />
          </Field>
          <Field label="Order up to" htmlFor="it-target" optional error={errors.reorder_target}>
            <NumberInput value={f.reorder_target} onChange={(reorder_target) => set({ reorder_target })} suffix={unitWord} />
          </Field>
        </div>
        {(attributes.data || []).filter((a) => a.values.length).map((a) => (
          <div key={a.id}>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">{a.name} <span className="font-normal">(optional)</span></p>
            <Chips label={a.name} options={[{ value: "", label: "None" }, ...a.values.map((v) => ({ value: v.id, label: v.value }))]}
              value={f.selections[a.id] || ""} onChange={(v) => set({ selections: { ...f.selections, [a.id]: v } })} />
          </div>
        ))}
        <Field label="Notes" htmlFor="it-notes" optional>
          <textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} />
        </Field>
        {isEdit && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete item</Button>}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save item"}</Button>
        </div>
      </StickyFooter>
      <ConfirmDialog open={confirmDelete} title="Delete this item?" message="An item with stock on hand or on an open purchase order can't be deleted — you'll see why."
        confirmLabel="Delete item" cancelLabel="Keep it" busy={remove.isPending} onConfirm={deleteItem} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
