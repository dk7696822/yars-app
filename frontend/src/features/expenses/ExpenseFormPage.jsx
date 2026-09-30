import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useExpense, useSaveExpense, useDeleteExpense } from "./api";
import { emptyExpense, formFromExpense, expenseTotal, validateExpense, toExpensePayload } from "./expenseForm";
import CategoryPicker from "./CategoryPicker";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, INPUT_INVALID, buttonClass } from "../../ui/styles";
import { todayIST } from "../../utils/istDate";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const PAID_OPTIONS = [{ value: "UNPAID", label: "Unpaid" }, { value: "PAID", label: "Paid" }];

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useExpense(id);
  const save = useSaveExpense(id);
  const remove = useDeleteExpense();
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromExpense(existing.data) : null) : emptyExpense(todayIST())), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This expense doesn't exist" body="It may have been deleted." action={<Link to="/expenses" className={buttonClass({ variant: "secondary" })}>All expenses</Link>} />
          : <ErrorState title="Couldn't load this expense." onRetry={() => existing.refetch()} />}
      </div>
    );
  }

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateExpense(f) : {};
  const total = expenseTotal(f);
  const back = () => navigate("/expenses", { replace: true });

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateExpense(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toExpensePayload(f), { onSuccess: () => { toast.success(isEdit ? "Expense updated" : "Expense added"); back(); } });
  };

  const deleteExpense = () =>
    remove.mutate(id, {
      onSuccess: () => { toast.success("Expense deleted"); back(); },
      onError: (err) => toast.error(errorText(err, "Couldn't delete the expense. Try again.")),
    });

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit expense" : "New expense"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Bill date" htmlFor="ex-date" error={errors.bill_date}>
          <DateField value={f.bill_date} onChange={(bill_date) => set({ bill_date })} />
        </Field>
        <Field label="Category" htmlFor="ex-category" error={errors.category_id}>
          <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.category_id ? INPUT_INVALID : ""}`}>
            {f.category_id ? <span className="truncate font-semibold">{f.category_name}</span> : <span className="text-ink-2">Choose a category</span>}
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          </button>
        </Field>
        <Field label="What was it for" htmlFor="ex-desc" error={errors.description}>
          <TextInput value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Diesel for the machine" />
        </Field>
        <Field label="Paid to" htmlFor="ex-vendor" error={errors.vendor}>
          <TextInput value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} placeholder="Shop or person" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="ex-qty" error={errors.quantity}>
            <NumberInput whole value={f.quantity} onChange={(quantity) => set({ quantity })} />
          </Field>
          <Field label="Cost each" htmlFor="ex-cost" error={errors.unit_cost}>
            <NumberInput prefix="₹" value={f.unit_cost} onChange={(unit_cost) => set({ unit_cost })} />
          </Field>
        </div>
        <div className="flex items-baseline justify-between rounded-2xl bg-surface px-4 py-3">
          <span className="text-sm text-ink-2">Total (quantity × cost)</span>
          {total === null ? <span className="text-ink-2">—</span> : <Money value={total} className="text-lg font-bold text-ink" />}
        </div>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Payment</p>
          <Chips label="Payment status" options={PAID_OPTIONS} value={f.payment_status} onChange={(payment_status) => set({ payment_status })} />
        </div>
        <Field label="Pay by" htmlFor="ex-due" optional error={errors.due_date} hint={f.due_date ? undefined : "For bills to be paid later"}>
          <DateField quick={false} value={f.due_date} onChange={(due_date) => set({ due_date })} />
        </Field>
        {f.due_date && <button type="button" onClick={() => set({ due_date: "" })} className="-mt-3 text-sm font-semibold text-brass">Clear pay-by date</button>}
        {isEdit && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete expense</Button>}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save expense"}</Button>
        </div>
      </StickyFooter>
      <CategoryPicker open={picking} onClose={() => setPicking(false)} onPick={(c) => { set({ category_id: c.id, category_name: c.name }); setPicking(false); }} />
      <ConfirmDialog open={confirmDelete} title="Delete this expense?" message="It will be removed from your expenses and totals." confirmLabel="Delete expense" cancelLabel="Keep it"
        busy={remove.isPending} onConfirm={deleteExpense} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
