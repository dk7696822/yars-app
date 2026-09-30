import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ellipsis, Phone, MessageCircle } from "lucide-react";
import { useOrder, useOrderStatus, useDeleteOrder } from "./api";
import PaymentSheet from "../payments/PaymentSheet";
import PaymentList from "../payments/PaymentList";
import { useDeletePayment } from "../payments/api";
import { toPaymentRow } from "../payments/paymentForm";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Chips from "../../ui/Chips";
import Tabs, { TabPanel } from "../../ui/Tabs";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import StatusBadge from "../../ui/StatusBadge";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { ORDER_FLOW, ORDER_STATUS } from "../../utils/statusMeta";
import { plateCharge } from "../../utils/orderMath";
import { formatLineQuantity, formatLineRate, formatLineKg } from "../../utils/formatters";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { todayIST } from "../../utils/istDate";
import { telHref, whatsappHref, toIndianMobile, formatMobile } from "../../utils/phone";
import { buildReminder } from "../../utils/whatsappReminder";
import { PAYMENT_TYPE_LABEL } from "../../utils/paymentType";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const STATUS_OPTIONS = ORDER_FLOW.map((s) => ({ value: s, label: ORDER_STATUS[s].label }));
const signed = (p) => (p.type === "REFUND" ? -p.amount : p.amount);

export default function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: order, isPending, isError, error, refetch } = useOrder(id);
  const setStatus = useOrderStatus(id);
  const deleteOrder = useDeleteOrder();
  const deletePayment = useDeletePayment();
  const [tab, setTab] = useState("items");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState({ open: false, mode: "payment", payment: null, key: 0 });
  const [confirm, setConfirm] = useState(null);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error?.response?.status === 404 ? (
          <EmptyState title="This order doesn't exist" body="It may have been deleted." action={<Link to="/orders" className={buttonClass({ variant: "secondary" })}>All orders</Link>} />
        ) : (
          <ErrorState title="Couldn't load this order." onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  const { total, received, due } = order.money;
  const cancelled = order.status === "CANCELLED";
  const name = order.customer?.name || "Unknown customer";
  const phone = order.customer?.metadata?.phone || null;
  const mobile = toIndianMobile(phone);
  const call = telHref(phone);
  const remind = due > 0 ? whatsappHref(phone, buildReminder({ name, amount: due, unpaidOrders: [{ orderDate: order.order_date, remaining: due }] })) : null;
  const payments = (order.payments || []).map(toPaymentRow).sort((a, b) => b.date.localeCompare(a.date));
  const hasAdvanceRows = payments.some((p) => p.type === "ADVANCE" && p.amount > 0);
  const legacyAdvances = !hasAdvanceRows && Number(order.advance_received) > 0 ? [{ orderId: order.id, orderDate: order.order_date, amount: Number(order.advance_received) }] : [];
  const roundOff = parseFloat(order.round_off_amount || 0);
  const openSheet = (mode, payment = null) => setSheet({ open: true, mode, payment, key: Date.now() });
  const fail = (err) => toast.error(errorText(err, "That didn't work. Try again."));
  const busy = setStatus.isPending || deleteOrder.isPending || deletePayment.isPending;

  const runConfirm = () => {
    if (confirm.kind === "cancel-order") {
      setStatus.mutate("CANCELLED", { onSuccess: () => { setConfirm(null); toast.success("Order cancelled"); }, onError: fail });
    } else if (confirm.kind === "delete-order") {
      deleteOrder.mutate(id, { onSuccess: () => { toast.success("Order deleted"); navigate("/orders", { replace: true }); }, onError: fail });
    } else if (confirm.kind === "delete-payment") {
      deletePayment.mutate(confirm.payment.id, { onSuccess: () => { setConfirm(null); toast.success("Payment deleted"); }, onError: fail });
    }
  };

  const CONFIRM_TEXT = {
    "cancel-order": { title: "Cancel this order?", message: "It stays in the list marked Cancelled, and stops counting in totals and dues. You can restore it later.", confirmLabel: "Cancel order", cancelLabel: "Keep order" },
    "delete-order": { title: "Delete this order?", message: `The order${payments.length ? ` and its ${payments.length} payment${payments.length === 1 ? "" : "s"}` : ""} will no longer count anywhere. This can't be undone in the app.`, confirmLabel: "Delete order", cancelLabel: "Keep order" },
    "delete-payment": confirm?.payment && { title: "Delete this payment?", message: `${PAYMENT_TYPE_LABEL[confirm.payment.type]} of ${inr(confirm.payment.amount)} on ${shortDate(confirm.payment.date)}. The order's due changes by this amount.`, confirmLabel: "Delete payment", cancelLabel: "Keep payment" },
  };
  const confirmText = confirm ? CONFIRM_TEXT[confirm.kind] : null;

  const actions = [
    { label: "Edit order", onSelect: () => navigate(`/orders/edit/${id}`) },
    !order.invoice_id && !cancelled && { label: "Create invoice", onSelect: () => navigate(`/invoices/new?customer=${order.customer_id}`) },
    !cancelled && { label: "Record advance", onSelect: () => openSheet("advance") },
    received > 0 && { label: "Record refund", onSelect: () => openSheet("refund") },
    !cancelled && { label: "Cancel order", tone: "danger", onSelect: () => setConfirm({ kind: "cancel-order" }) },
    { label: "Delete order", tone: "danger", onSelect: () => setConfirm({ kind: "delete-order" }) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-num text-xl font-semibold text-ink">{name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">{shortDate(order.order_date)} <StatusBadge status={order.status} /></p>
        </div>
        <IconButton label="More actions for this order" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
      </div>

      {cancelled && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3 text-sm text-ink-2">
          <span>Cancelled — not counted in totals or dues.</span>
          <Button size="sm" variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate("PENDING", { onSuccess: () => toast.success("Order restored"), onError: fail })}>Restore</Button>
        </div>
      )}
      {order.invoice && (
        <Link to={`/invoices/${order.invoice.id}`} className="block rounded-2xl bg-surface px-4 py-3 text-sm text-ink hover:bg-raised">On invoice #{order.invoice.invoice_number} →</Link>
      )}

      <section aria-label="Money" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-2"><dt>Total</dt><dd><Money value={total} className="font-semibold text-ink" /></dd></div>
          <div className="flex justify-between text-ink-2"><dt>Received</dt><dd><Money value={received} className="font-semibold text-ink" /></dd></div>
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          {cancelled ? (
            <span className="text-sm text-ink-2">Not counted</span>
          ) : due > 0 ? (
            <><span className="text-sm font-semibold text-ink-2">Due</span><Money value={due} className="text-3xl font-bold text-status-critical" /></>
          ) : (
            <><span className="text-sm font-semibold text-status-good">Paid in full ✓</span>{due < 0 && <span className="text-sm text-ink-2"><Money value={-due} /> extra received</span>}</>
          )}
        </div>
        {total > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-status-good" style={{ width: `${Math.min(100, Math.max(0, (received / total) * 100))}%` }} />
          </div>
        )}
        {!cancelled && <Button block size="lg" className="mt-4" variant={due > 0 ? "primary" : "secondary"} onClick={() => openSheet("payment")}>＋ Record payment</Button>}
      </section>

      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link to={`/customers/${order.customer_id}`} className="block truncate font-semibold text-ink hover:underline">{name}</Link>
          <p className="text-xs text-ink-2">{mobile ? formatMobile(mobile) : phone || "No mobile number"}</p>
        </div>
        {call && <a href={call} aria-label={`Call ${name}`} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-brass"><Phone className="h-4 w-4" /></a>}
        {remind && <a href={remind} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp reminder to ${name}`} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-status-good"><MessageCircle className="h-4 w-4" /></a>}
      </div>

      {!cancelled && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-2">Status</p>
          <Chips label="Order status" options={STATUS_OPTIONS} value={order.status} onChange={(s) => s !== order.status && setStatus.mutate(s, { onError: fail })} />
        </div>
      )}

      <Tabs label="Order sections" value={tab} onChange={setTab}
        tabs={[{ value: "items", label: "Items" }, { value: "payments", label: `Payments (${payments.length + legacyAdvances.length})` }, { value: "details", label: "Details" }]} />

      {tab === "items" && (
        <TabPanel value="items">
          <ul className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
            {order.orderProductSizes.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{line.productSize?.size_label || "Unknown size"} · {formatLineQuantity(line)}</p>
                  <p className="text-xs text-ink-2">{formatLineRate(line)}{formatLineKg(line) ? ` · ${formatLineKg(line)}` : ""}</p>
                </div>
                <Money value={line.line_amount} className="text-sm font-semibold" />
              </li>
            ))}
            <li className="flex justify-between gap-3 py-3 text-sm">
              <span className="text-ink-2">Plate · {order.plateType?.type_name || "—"}{order.custom_plate_charge ? " (custom)" : ""}</span>
              <Money value={plateCharge(order)} className="font-semibold" />
            </li>
            {roundOff !== 0 && (
              <li className="flex justify-between gap-3 py-3 text-sm">
                <span className="text-ink-2">Round off</span>
                <span className="font-num font-semibold tabular-nums">{roundOff > 0 ? "−" : "+"}{inr(Math.abs(roundOff))}</span>
              </li>
            )}
            <li className="flex justify-between gap-3 py-3"><span className="font-semibold text-ink">Total</span><Money value={total} className="font-bold" /></li>
          </ul>
        </TabPanel>
      )}

      {tab === "payments" && (
        <TabPanel value="payments">
          <PaymentList payments={payments} legacyAdvances={legacyAdvances}
            onEdit={(p) => openSheet("edit", p)} onDelete={(p) => setConfirm({ kind: "delete-payment", payment: p })} />
        </TabPanel>
      )}

      {tab === "details" && (
        <TabPanel value="details">
          <dl className="divide-y divide-line/60 rounded-2xl bg-surface px-4 text-sm">
            {[
              ["Order date", shortDate(order.order_date)],
              ["Status", ORDER_STATUS[order.status]?.label || order.status],
              ["Plate type", order.plateType?.type_name || "—"],
              ["Invoice", order.invoice ? `#${order.invoice.invoice_number}` : "Not invoiced yet"],
              ["Entered on", shortDate(todayIST(new Date(order.created_at)))],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-ink-2">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
            ))}
          </dl>
        </TabPanel>
      )}

      <ActionSheet open={menuOpen} title="Order" onClose={() => setMenuOpen(false)} actions={actions} />
      {confirmText && <ConfirmDialog open title={confirmText.title} message={confirmText.message} confirmLabel={confirmText.confirmLabel} cancelLabel={confirmText.cancelLabel} busy={busy} onConfirm={runConfirm} onClose={() => setConfirm(null)} />}
      <PaymentSheet key={sheet.key} open={sheet.open} mode={sheet.mode} payment={sheet.payment} orderId={id}
        received={sheet.payment ? received - signed(sheet.payment) : received}
        due={sheet.payment ? due + signed(sheet.payment) : due} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}
