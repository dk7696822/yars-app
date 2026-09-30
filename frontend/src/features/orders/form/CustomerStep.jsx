import { useState } from "react";
import PropTypes from "prop-types";
import { Search } from "lucide-react";
import Field from "../../../ui/Field";
import DateField from "../../../ui/DateField";
import { INPUT, INPUT_INVALID } from "../../../ui/styles";
import CustomerPicker from "../../customers/CustomerPicker";
import { inr } from "../../../utils/dashboardFormat";

export default function CustomerStep({ draft, update, errors }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="space-y-5">
      <Field label="Customer" htmlFor="order-customer" error={errors.customer}>
        <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.customer ? INPUT_INVALID : ""}`}>
          {draft.customer ? <span className="truncate font-semibold">{draft.customer.name}</span> : <span className="text-ink-2">Choose a customer</span>}
          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        </button>
      </Field>
      {draft.customer?.due > 0 && <p className="-mt-3 text-xs text-status-critical">Already owes {inr(draft.customer.due)}</p>}
      <Field label="Order date" htmlFor="order-date" error={errors.orderDate}>
        <DateField value={draft.orderDate} onChange={(orderDate) => update({ orderDate })} />
      </Field>
      <CustomerPicker open={picking} onClose={() => setPicking(false)} onPick={(customer) => { update({ customer }); setPicking(false); }} />
    </div>
  );
}

CustomerStep.propTypes = { draft: PropTypes.object.isRequired, update: PropTypes.func.isRequired, errors: PropTypes.object.isRequired };
