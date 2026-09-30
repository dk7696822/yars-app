import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import { Ellipsis, Phone, MessageCircle, Plus } from "lucide-react";
import { useCustomerSummary, useDeleteCustomer } from "./api";
import OrderRow from "../orders/OrderRow";
import PaymentList from "../payments/PaymentList";
import IconButton from "../../ui/IconButton";
import Tabs, { TabPanel } from "../../ui/Tabs";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { telHref, whatsappHref, toIndianMobile, formatMobile } from "../../utils/phone";
import { buildReminder } from "../../utils/whatsappReminder";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const since = (iso) => (iso ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : null);

function OrderGroup({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section className="mb-3">
      <h3 className="px-1 pb-1.5 text-xs font-semibold text-ink-2">{title}</h3>
      <ul className="overflow-hidden rounded-2xl bg-surface">{rows.map((r) => <OrderRow key={r.id} row={r} showCustomer={false} />)}</ul>
    </section>
  );
}

OrderGroup.propTypes = { title: PropTypes.string.isRequired, rows: PropTypes.array.isRequired };

export default function CustomerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: s, isPending, isError, error, refetch } = useCustomerSummary(id);
  const del = useDeleteCustomer();
  const [tab, setTab] = useState("orders");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error?.response?.status === 404
          ? <EmptyState title="This customer doesn't exist" body="They may have been deleted." action={<Link to="/customers" className={buttonClass({ variant: "secondary" })}>All customers</Link>} />
          : <ErrorState title="Couldn't load this customer." onRetry={() => refetch()} />}
      </div>
    );
  }

  const { customer } = s;
  const unpaid = s.orders.filter((o) => !o.cancelled && o.due > 0);
  const paid = s.orders.filter((o) => !o.cancelled && o.due <= 0);
  const cancelledOrders = s.orders.filter((o) => o.cancelled);
  const mobile = toIndianMobile(customer.phone);
  const call = telHref(customer.phone);
  const remind = s.owes > 0
    ? whatsappHref(customer.phone, buildReminder({
        name: customer.name, amount: s.owes,
        unpaidOrders: [...unpaid].sort((a, b) => a.orderDate.localeCompare(b.orderDate)).map((o) => ({ orderDate: o.orderDate, remaining: o.due })),
      }))
    : null;

  const remove = () =>
    del.mutate(id, {
      onSuccess: () => { toast.success("Customer deleted"); navigate("/customers", { replace: true }); },
      onError: (err) => toast.error(errorText(err, "Couldn't delete. Try again.")),
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-num text-xl font-semibold text-ink">{customer.name}</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {mobile ? formatMobile(mobile) : customer.phone || "No mobile number"}
            {customer.city && ` · ${customer.city}`}
            {since(customer.createdAt) && ` · customer since ${since(customer.createdAt)}`}
          </p>
        </div>
        <IconButton label="More actions for this customer" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
      </div>

      <section aria-label="Money" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <p className="text-sm text-ink-2">Owes</p>
        {s.owes > 0 ? (
          <>
            <Money value={s.owes} className="block text-3xl font-bold text-status-critical" />
            <p className="text-sm text-ink-2">oldest unpaid order {s.oldestUnpaidDays} days</p>
          </>
        ) : (
          <p className="text-2xl font-semibold text-status-good">Paid up ✓</p>
        )}
        {s.credit > 0 && <p className="mt-1 text-sm text-ink-2"><Money value={s.credit} /> received more than billed</p>}
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[["Total business", <Money key="b" value={s.totalBusiness} />], ["Received", <Money key="r" value={s.received} />], ["Orders", <span key="o" className="font-num tabular-nums">{s.ordersCount}</span>]].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-canvas/50 p-2"><dt className="text-[0.7rem] text-ink-2">{label}</dt><dd className="text-sm font-semibold text-ink">{value}</dd></div>
          ))}
        </dl>
        <div className="mt-3 flex gap-2">
          <Link to={`/orders/new?customer=${customer.id}`} className={`${buttonClass({ block: true })} flex-1`}><Plus className="h-4 w-4" aria-hidden="true" />New order</Link>
          {call && <a href={call} className={`${buttonClass({ variant: "secondary" })} flex-1`}><Phone className="h-4 w-4" aria-hidden="true" />Call</a>}
          {remind && <a href={remind} target="_blank" rel="noopener noreferrer" className={`${buttonClass({ variant: "secondary" })} flex-1`}><MessageCircle className="h-4 w-4" aria-hidden="true" />Remind</a>}
        </div>
        {!mobile && <p className="mt-2 text-xs text-ink-2"><Link to={`/customers/edit/${customer.id}`} className="font-semibold text-brass">Add a mobile number</Link> to call or send WhatsApp reminders.</p>}
      </section>

      <Tabs label="Customer sections" value={tab} onChange={setTab}
        tabs={[{ value: "orders", label: `Orders (${s.orders.length})` }, { value: "payments", label: "Payments" }, { value: "details", label: "Details" }]} />

      {tab === "orders" && (
        <TabPanel value="orders">
          {s.orders.length === 0 ? (
            <EmptyState title="No orders yet" action={<Link to={`/orders/new?customer=${customer.id}`} className={buttonClass()}>New order</Link>} />
          ) : (
            <>
              <OrderGroup title="Unpaid" rows={unpaid} />
              <OrderGroup title="Paid" rows={paid} />
              <OrderGroup title="Cancelled — not counted" rows={cancelledOrders} />
            </>
          )}
        </TabPanel>
      )}
      {tab === "payments" && (
        <TabPanel value="payments"><PaymentList payments={s.payments} legacyAdvances={s.legacyAdvances} showOrder /></TabPanel>
      )}
      {tab === "details" && (
        <TabPanel value="details">
          <dl className="divide-y divide-line/60 rounded-2xl bg-surface px-4 text-sm">
            {[
              ["Mobile", mobile ? `+91 ${formatMobile(mobile)}` : customer.phone || "—"],
              ["City / area", customer.city || "—"],
              ["Email", customer.email || "—"],
              ["Address", customer.address || "—"],
              ["GSTIN", customer.gstin || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-ink-2">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
            ))}
          </dl>
          <Link to={`/customers/edit/${customer.id}`} className={`${buttonClass({ variant: "secondary", block: true })} mt-3`}>Edit details</Link>
        </TabPanel>
      )}

      <ActionSheet open={menuOpen} title="Customer" onClose={() => setMenuOpen(false)}
        actions={[{ label: "Edit customer", onSelect: () => navigate(`/customers/edit/${id}`) }, { label: "Delete customer", tone: "danger", onSelect: () => setConfirmDelete(true) }]} />
      <ConfirmDialog open={confirmDelete} title={`Delete ${customer.name}?`} confirmLabel="Delete customer" cancelLabel="Keep customer" busy={del.isPending}
        message={`They will be removed from your customer list. ${s.orders.length ? `Their ${s.orders.length} order${s.orders.length === 1 ? "" : "s"} stay and still count in totals and dues.` : ""}`}
        onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}
