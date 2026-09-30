import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSize, useSaveSize, useDeleteSize } from "./api";
import { emptySize, formFromSize, validateSize, toSizePayload } from "./sizeForm";
import Field from "../../ui/Field";
import Pair from "../../ui/Pair";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, buttonClass } from "../../ui/styles";
import { parseNumber } from "../../utils/numberInput";
import { perPiecePriceHint, perPieceWeightHint, backfillMessage } from "../../utils/formatters";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function SizeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useSize(id);
  const save = useSaveSize(id);
  const remove = useDeleteSize();
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromSize(existing.data) : null) : emptySize()), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This size doesn't exist" action={<Link to="/product-sizes" className={buttonClass({ variant: "secondary" })}>All sizes</Link>} />
          : <ErrorState title="Couldn't load this size." onRetry={() => existing.refetch()} />}
      </div>
    );
  }

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateSize(f) : {};
  const back = () => navigate("/product-sizes", { replace: true });
  const num = (t, o) => parseNumber(t, o).value;
  const price = { amount: num(f.piece_price_amount, { dp: 4, allowZero: true }), count: num(f.piece_price_count, { whole: true }) };
  const weight = { kg: num(f.weight_kg, { dp: 3 }), count: num(f.weight_pieces_count, { whole: true }) };

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateSize(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toSizePayload(f), {
      onSuccess: (saved) => {
        toast.success(isEdit ? "Size updated" : "Size added");
        const filled = backfillMessage(saved?.backfilled_lines);
        if (filled) toast.success(filled);
        back();
      },
    });
  };

  const deleteSize = () =>
    remove.mutate(id, {
      onSuccess: () => { toast.success("Size deleted"); back(); },
      onError: (err) => toast.error(errorText(err, "Couldn't delete the size. Try again.")),
    });

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit size" : "New size"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Size" htmlFor="sz-label" error={errors.size_label}>
          <TextInput value={f.size_label} onChange={(e) => set({ size_label: e.target.value })} placeholder="e.g. 14 x 18" autoFocus={!isEdit} />
        </Field>
        <Field label="Rate per kg" htmlFor="sz-rate" optional error={errors.rate_per_kg} hint="Leave empty (or 0) if you set the rate on each order">
          <NumberInput prefix="₹" suffix="/kg" value={f.rate_per_kg} onChange={(v) => set({ rate_per_kg: v })} />
        </Field>
        <Pair legend={<>Piece price <span className="font-normal">(optional)</span></>} error={errors.piece_price}
          hint={price.amount !== null && price.count > 1 ? perPiecePriceHint(price.amount, price.count) : "For orders taken in pieces, e.g. 1,000 pcs cost ₹375"}>
          <div className="w-28 shrink-0"><NumberInput whole aria-label="Number of pieces priced" value={f.piece_price_count} onChange={(v) => set({ piece_price_count: v })} /></div>
          <span className="shrink-0 text-sm text-ink-2">pcs cost</span>
          <div className="min-w-0 flex-1"><NumberInput aria-label="Price for those pieces" prefix="₹" value={f.piece_price_amount} onChange={(v) => set({ piece_price_amount: v })} /></div>
        </Pair>
        <Pair legend={<>Weight <span className="font-normal">(optional)</span></>} error={errors.weight}
          hint={weight.kg && weight.count ? perPieceWeightHint(weight.kg, weight.count) : "Used only to estimate kg for orders taken in pieces"}>
          <div className="w-28 shrink-0"><NumberInput whole aria-label="Number of pieces weighed" placeholder="10000" value={f.weight_pieces_count} onChange={(v) => set({ weight_pieces_count: v })} /></div>
          <span className="shrink-0 text-sm text-ink-2">pcs weigh</span>
          <div className="min-w-0 flex-1"><NumberInput aria-label="Weight in kg" suffix="kg" placeholder="100" value={f.weight_kg} onChange={(v) => set({ weight_kg: v })} /></div>
        </Pair>
        {errors.form && <p role="alert" className="text-sm font-medium text-status-critical">{errors.form}</p>}
        <p className="text-xs text-ink-2">Changing prices here affects new orders only — saved orders keep their prices.</p>
        {isEdit && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete size</Button>}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save size"}</Button>
        </div>
      </StickyFooter>
      <ConfirmDialog open={confirmDelete} title={`Delete ${f.size_label || "this size"}?`} confirmLabel="Delete size" cancelLabel="Keep size" busy={remove.isPending}
        message="It won't be offered for new orders. Past orders keep it." onConfirm={deleteSize} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
