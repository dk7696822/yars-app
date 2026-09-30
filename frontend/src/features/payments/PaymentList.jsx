import { useState } from "react";
import PropTypes from "prop-types";
import { Ellipsis } from "lucide-react";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import { Money } from "../../ui/Money";
import { EmptyState } from "../../ui/States";
import { PAYMENT_METHODS, PAYMENT_TYPE_LABEL } from "../../utils/paymentType";
import { inr, shortDate } from "../../utils/dashboardFormat";

const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS);

export default function PaymentList({ payments, legacyAdvances = [], onEdit, onDelete, showOrder = false }) {
  const [menu, setMenu] = useState(null);
  if (!payments.length && !legacyAdvances.length) return <EmptyState title="No payments yet" body="Payments you record show here." />;
  return (
    <>
      <ul className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{PAYMENT_TYPE_LABEL[p.type] || p.type} · {METHOD_LABEL[p.method] || p.method}</p>
              <p className="truncate text-xs text-ink-2">
                {shortDate(p.date)}
                {showOrder && p.orderDate && ` · order of ${shortDate(p.orderDate)}`}
                {p.orderCancelled && " · cancelled order"}
                {p.reference && ` · Ref ${p.reference}`}
                {p.notes && ` · ${p.notes}`}
              </p>
            </div>
            <span className={`font-num text-sm font-semibold tabular-nums ${p.type === "REFUND" ? "text-ink-2" : "text-ink"}`}>{p.type === "REFUND" ? "−" : ""}{inr(p.amount)}</span>
            {onEdit && (
              <IconButton label={`Actions for the ${inr(p.amount)} payment of ${shortDate(p.date)}`} className="h-9 w-9 bg-transparent" onClick={() => setMenu(p)}>
                <Ellipsis className="h-4 w-4" />
              </IconButton>
            )}
          </li>
        ))}
        {legacyAdvances.map((a) => (
          <li key={`adv-${a.orderId}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Advance</p>
              <p className="text-xs text-ink-2">Noted on the order{showOrder ? ` of ${shortDate(a.orderDate)}` : ""}</p>
            </div>
            <Money value={a.amount} className="text-sm font-semibold" />
          </li>
        ))}
      </ul>
      {onEdit && (
        <ActionSheet open={Boolean(menu)} title="Payment" onClose={() => setMenu(null)}
          actions={menu ? [{ label: "Edit payment", onSelect: () => onEdit(menu) }, { label: "Delete payment", tone: "danger", onSelect: () => onDelete(menu) }] : []} />
      )}
    </>
  );
}

PaymentList.propTypes = {
  payments: PropTypes.array.isRequired,
  legacyAdvances: PropTypes.arrayOf(PropTypes.shape({ orderId: PropTypes.string.isRequired, orderDate: PropTypes.string, amount: PropTypes.number.isRequired })),
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  showOrder: PropTypes.bool,
};
