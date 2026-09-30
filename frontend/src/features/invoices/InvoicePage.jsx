import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ellipsis, Share2, MessageCircle } from "lucide-react";
import { useInvoice, useInvoiceStatus, useDeleteInvoice } from "./api";
import { sharePdf } from "./sharePdf";
import { invoicePaymentChoices } from "./paymentChoices";
import PaymentSheet from "../payments/PaymentSheet";
import PaymentList from "../payments/PaymentList";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Tabs, { TabPanel } from "../../ui/Tabs";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import StatusBadge from "../../ui/StatusBadge";
import { Money, DueText } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { formatInvoiceQty, formatInvoiceRate } from "../../utils/formatters";
import { shortDate } from "../../utils/dashboardFormat";
import { whatsappHref } from "../../utils/phone";
import { buildInvoiceReminder } from "../../utils/whatsappReminder";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: inv, isPending, isError, error, refetch } = useInvoice(id);
  const setStatus = useInvoiceStatus(id);
  const del = useDeleteInvoice();
  const [tab, setTab] = useState("items");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState({ open: false, key: 0 });
  const [confirm, setConfirm] = useState(null); // "cancel" | "delete"
  const [sharing, setSharing] = useState(false);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error?.response?.status === 404
          ? <EmptyState title="This invoice doesn't exist" body="It may have been deleted." action={<Link to="/invoices" className={buttonClass({ variant: "secondary" })}>All invoices</Link>} />
          : <ErrorState title="Couldn't load this invoice." onRetry={() => refetch()} />}
      </div>
    );
  }

  const m = inv.money;
  const cancelled = m.derivedStatus === "CANCELLED";
  const name = inv.customer?.name || "Unknown customer";
  const choices = invoicePaymentChoices(inv.orderMoney);
  const remind = !cancelled && m.amountDue > 0
    ? whatsappHref(inv.customer?.metadata?.phone, buildInvoiceReminder({ name, number: inv.invoice_number, invoiceDate: inv.invoice_date, amountDue: m.amountDue }))
    : null;
  const items = (inv.invoiceItems || []).filter((i) => parseFloat(i.total_price) >= 0); // advance lines are shown as received, not items
  const fail = (err) => toast.error(errorText(err, "That didn't work. Try again."));

  const share = async () => {
    setSharing(true);
    try {
      if ((await sharePdf(inv)) === "downloaded") toast.success("PDF downloaded");
    } catch (err) {
      fail(err);
    } finally {
      setSharing(false);
    }
  };

  const runConfirm = () => {
    if (confirm === "cancel") setStatus.mutate("CANCELLED", { onSuccess: () => { setConfirm(null); toast.success("Invoice cancelled"); }, onError: fail });
    if (confirm === "delete") del.mutate(id, { onSuccess: () => { toast.success("Invoice deleted"); navigate("/invoices", { replace: true }); }, onError: fail });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">Invoice #{inv.invoice_number}</p>
          <Link to={`/customers/${inv.customer_id}`} className="block truncate font-num text-xl font-semibold text-ink hover:underline">{name}</Link>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            {shortDate(inv.invoice_date)}{inv.payment_due_date && ` · due ${shortDate(inv.payment_due_date)}`} · {inv.orderMoney.length} order{inv.orderMoney.length === 1 ? "" : "s"}
            <StatusBadge kind="invoice" status={m.derivedStatus} />
          </p>
        </div>
        <IconButton label="More actions for this invoice" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
      </div>

      {cancelled && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3 text-sm text-ink-2">
          <span>Cancelled — not counted as unpaid.</span>
          <Button size="sm" variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate("PENDING", { onSuccess: () => toast.success("Invoice restored"), onError: fail })}>Restore</Button>
        </div>
      )}

      <section aria-label="Money" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-2"><dt>Orders total</dt><dd><Money value={Number(inv.total_amount)} className="font-semibold text-ink" /></dd></div>
          <div className="flex justify-between text-ink-2"><dt>GST {Number(inv.tax_percent)}%</dt><dd><Money value={Number(inv.tax_amount)} className="font-semibold text-ink" /></dd></div>
          {Number(inv.tax_amount) > 0 && <div className="flex justify-between text-ink-2"><dt>Invoice total</dt><dd><Money value={Number(inv.final_amount)} className="font-semibold text-ink" /></dd></div>}
          <div className="flex justify-between text-ink-2"><dt>Received on these orders</dt><dd><Money value={m.amountPaid} className="font-semibold text-ink" /></dd></div>
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          {m.amountDue > 0
            ? <><span className="text-sm font-semibold text-ink-2">Due{m.derivedStatus === "OVERDUE" && <span className="text-status-critical"> · overdue {m.overdueDays} days</span>}</span><Money value={m.amountDue} className="text-3xl font-bold text-status-critical" /></>
            : <><span className="text-sm font-semibold text-status-good">Paid in full ✓</span>{m.amountExtra > 0 && <span className="text-sm text-ink-2"><Money value={m.amountExtra} /> extra received</span>}</>}
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" loading={sharing} onClick={share}><Share2 className="h-4 w-4" aria-hidden="true" />Share PDF</Button>
          {!cancelled && m.amountDue > 0 && <Button className="flex-1" variant="secondary" onClick={() => setSheet({ open: true, key: Date.now() })}>＋ Payment</Button>}
          {remind && <a href={remind} target="_blank" rel="noopener noreferrer" className={`${buttonClass({ variant: "secondary" })} flex-1`}><MessageCircle className="h-4 w-4" aria-hidden="true" />Remind</a>}
        </div>
      </section>

      <Tabs label="Invoice sections" value={tab} onChange={setTab}
        tabs={[{ value: "items", label: "Items" }, { value: "payments", label: `Payments (${inv.orderPayments.length})` }, { value: "details", label: "Details" }]} />

      {tab === "items" && (
        <TabPanel value="items">
          <ul className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.description}</p>
                  <p className="text-xs text-ink-2">{formatInvoiceQty(item)} · {formatInvoiceRate(item)}</p>
                </div>
                <Money value={Number(item.total_price)} className="text-sm font-semibold" />
              </li>
            ))}
            <li className="flex justify-between gap-3 py-3"><span className="font-semibold text-ink">Orders total</span><Money value={Number(inv.total_amount)} className="font-bold" /></li>
          </ul>
        </TabPanel>
      )}
      {tab === "payments" && <TabPanel value="payments"><PaymentList payments={inv.orderPayments} showOrder /></TabPanel>}
      {tab === "details" && (
        <TabPanel value="details">
          <dl className="divide-y divide-line/60 rounded-2xl bg-surface px-4 text-sm">
            {[
              ["Invoice date", shortDate(inv.invoice_date)],
              ["Billing period", `${shortDate(inv.billing_period_start)} – ${shortDate(inv.billing_period_end)}`],
              ["Payment due", inv.payment_due_date ? shortDate(inv.payment_due_date) : "—"],
              ["GST", `${Number(inv.tax_percent)}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-ink-2">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
            ))}
          </dl>
          <h3 className="mt-4 px-1 pb-1.5 text-xs font-semibold text-ink-2">Orders on this invoice</h3>
          <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface">
            {inv.orderMoney.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-raised/60">
                  <span className="text-sm text-ink">{shortDate(o.orderDate)}{o.deleted ? " (deleted)" : o.status === "CANCELLED" ? " (cancelled)" : ""}</span>
                  <span className="text-right"><Money value={o.total} className="block text-sm font-semibold" /><DueText due={o.due} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </TabPanel>
      )}

      <ActionSheet open={menuOpen} title={`Invoice #${inv.invoice_number}`} onClose={() => setMenuOpen(false)}
        actions={[
          !cancelled && { label: "Cancel invoice", tone: "danger", onSelect: () => setConfirm("cancel") },
          { label: "Delete invoice", tone: "danger", onSelect: () => setConfirm("delete") },
        ]} />
      <ConfirmDialog open={confirm === "cancel"} title={`Cancel invoice #${inv.invoice_number}?`} confirmLabel="Cancel invoice" cancelLabel="Keep invoice" busy={setStatus.isPending}
        message="It stays in the list marked Cancelled and no longer counts as unpaid. Payments on its orders don't change. You can restore it."
        onConfirm={runConfirm} onClose={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "delete"} title={`Delete invoice #${inv.invoice_number}?`} confirmLabel="Delete invoice" cancelLabel="Keep invoice" busy={del.isPending}
        message="Its orders become un-invoiced so you can bill them again. Payments stay on the orders."
        onConfirm={runConfirm} onClose={() => setConfirm(null)} />
      <PaymentSheet key={sheet.key} open={sheet.open} mode="payment" invoiceId={id} due={m.amountDue} orderChoices={choices} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}
