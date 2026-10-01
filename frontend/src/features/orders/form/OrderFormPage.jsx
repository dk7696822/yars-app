import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useOrder, useSizes, usePlates, useSaveOrder } from "../api";
import { useCustomerSummary } from "../../customers/api";
import CustomerStep from "./CustomerStep";
import ItemsStep from "./ItemsStep";
import ExtrasStep from "./ExtrasStep";
import { STEPS, newDraft, draftFromOrder, stepErrors, draftTotals, toPayload } from "./draft";
import { useAssistantAction, reportFinishedInForm } from "../../assistant/api";
import { orderDraftFromAction } from "../../assistant/formPrefill";
import Stepper from "../../../ui/Stepper";
import PageHeader from "../../../ui/PageHeader";
import StickyFooter from "../../../ui/StickyFooter";
import Button from "../../../ui/Button";
import ConfirmDialog from "../../../ui/ConfirmDialog";
import { Money } from "../../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../../ui/States";
import { buttonClass, FORM_PAGE } from "../../../ui/styles";
import useSteps from "../../../ui/useSteps";
import { keys } from "../../../lib/queryKeys";
import { errorText } from "../../../lib/errors";
import { productSizeAPI } from "../../../services/api";
import { backfillMessage } from "../../../utils/formatters";
import { useToast } from "../../../context/ToastContext";

export default function OrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [search] = useSearchParams();
  const presetId = isEdit ? null : search.get("customer");
  const assistantId = isEdit ? null : search.get("assistant");
  const actionQ = useAssistantAction(assistantId);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const orderQ = useOrder(id);
  const presetQ = useCustomerSummary(presetId);
  const sizesQ = useSizes();
  const platesQ = usePlates();
  const save = useSaveOrder(id);

  // An edited order may use a size or plate that has since been archived: keep it selectable here.
  const sizes = useMemo(() => {
    const list = sizesQ.data || [];
    const own = (orderQ.data?.orderProductSizes || []).map((l) => l.productSize).filter((s) => s && !list.some((x) => x.id === s.id));
    return [...list, ...own.map((s) => ({ ...s, size_label: `${s.size_label} (archived)` }))];
  }, [sizesQ.data, orderQ.data]);
  const plates = useMemo(() => {
    const list = platesQ.data || [];
    const own = orderQ.data?.plateType;
    return own && !list.some((p) => p.id === own.id) ? [...list, { ...own, type_name: `${own.type_name} (archived)` }] : list;
  }, [platesQ.data, orderQ.data]);

  const initial = useMemo(() => {
    if (isEdit) return orderQ.data ? draftFromOrder(orderQ.data) : null;
    if (assistantId) return actionQ.data ? orderDraftFromAction(actionQ.data) : actionQ.isError ? newDraft() : null;
    if (!presetId) return newDraft();
    if (presetQ.data) {
      const c = presetQ.data.customer;
      return newDraft({ id: c.id, name: c.name, phone: c.phone, due: presetQ.data.owes });
    }
    return presetQ.isError ? newDraft() : null;
  }, [isEdit, orderQ.data, presetId, presetQ.data, presetQ.isError, assistantId, actionQ.data, actionQ.isError]);
  const [edited, setEdited] = useState(null);
  const draft = edited ?? initial;
  const update = (patch) => setEdited((prev) => {
    const base = prev ?? initial;
    return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
  });

  const steps = useSteps({ count: STEPS.length, errorsFor: (i) => (draft ? stepErrors(draft, i) : {}), start: isEdit ? 2 : 0 });
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!draft || sizesQ.isPending || platesQ.isPending) {
    if (orderQ.isError) {
      return (
        <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
          {orderQ.error?.response?.status === 404
            ? <EmptyState title="This order doesn't exist" action={<Link to="/orders" className={buttonClass({ variant: "secondary" })}>All orders</Link>} />
            : <ErrorState title="Couldn't load this order." onRetry={() => orderQ.refetch()} />}
        </div>
      );
    }
    if (sizesQ.isError || platesQ.isError) return <div className="mx-auto max-w-xl px-4 py-6"><ErrorState title="Couldn't load sizes and plate types." onRetry={() => { sizesQ.refetch(); platesQ.refetch(); }} /></div>;
    return <PageSkeleton />;
  }

  const totals = draftTotals(draft, sizes, plates);
  const errors = steps.shownFor(steps.step) ? stepErrors(draft, steps.step) : {};
  const leave = () => navigate(isEdit ? `/orders/${id}` : "/orders", { replace: true });
  const back = () => (steps.step === 0 ? (edited ? setConfirmLeave(true) : leave()) : steps.back());

  const saveSizeWeight = async (size, weight) => {
    const res = await productSizeAPI.update(size.id, {
      size_label: size.size_label, rate_per_kg: size.rate_per_kg, piece_price_amount: size.piece_price_amount, piece_price_count: size.piece_price_count, ...weight,
    });
    const updated = res.data.data;
    qc.setQueryData(keys.catalog.sizes, (list) => (list || []).map((s) => (s.id === updated.id ? updated : s)));
    const filled = backfillMessage(updated.backfilled_lines);
    if (filled) toast.success(filled);
    return updated;
  };

  const submit = () => {
    if (!steps.validateAll()) return;
    const payload = toPayload(draft, { isEdit });
    save.mutate(payload, {
      onSuccess: (order) => {
        reportFinishedInForm(assistantId, order.id, payload);
        toast.success(isEdit ? "Order updated" : "Order saved");
        navigate(`/orders/${isEdit ? id : order.id}`, { replace: true });
      },
    });
  };

  return (
    <div className={`${FORM_PAGE} pt-3`}>
      <PageHeader title={isEdit ? "Edit order" : "New order"} />
      <Stepper steps={STEPS} current={steps.step} reached={steps.reached} onGo={steps.go} />
      {isEdit && orderQ.data?.invoice_id && (
        <p className="mt-3 rounded-2xl bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          This order is on invoice #{orderQ.data.invoice?.invoice_number || "—"}. Changes here won&apos;t update the invoice — delete and regenerate the invoice to update it.
        </p>
      )}

      <div className="mt-4 pb-6">
        {steps.step === 0 && <CustomerStep draft={draft} update={update} errors={errors} />}
        {steps.step === 1 && <ItemsStep draft={draft} update={update} sizes={sizes} errors={errors} onSaveSizeWeight={saveSizeWeight} />}
        {steps.step === 2 && <ExtrasStep draft={draft} update={update} plates={plates} sizes={sizes} errors={errors} isEdit={isEdit} totals={totals} onGo={steps.go} />}
      </div>

      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save the order. Check your connection and try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={back}>Back</Button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-ink-2">Total</p>
            <Money value={totals.total} className="text-lg font-bold text-ink" />
          </div>
          {steps.step < STEPS.length - 1
            ? <Button onClick={steps.next}>Next</Button>
            : <Button onClick={submit} loading={save.isPending}>{isEdit ? "Save changes" : "Save order"}</Button>}
        </div>
      </StickyFooter>

      <ConfirmDialog open={confirmLeave} title="Leave without saving?" message="What you entered on this order will be lost." confirmLabel="Leave" cancelLabel="Keep editing"
        onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </div>
  );
}
