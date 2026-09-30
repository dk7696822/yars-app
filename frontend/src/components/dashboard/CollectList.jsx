import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import CustomerRow from "./CustomerRow";

export default function CollectList({ customers, limit = 5 }) {
  if (customers.length === 0) {
    return <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">✓ Nothing to collect — all customers are paid up.</p>;
  }
  return (
    <section aria-labelledby="collect-from">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-4">
        <h2 id="collect-from" className="text-sm font-bold text-ink">Collect from</h2>
        <span className="text-xs text-ink-2">oldest first</span>
      </div>
      <ul className="space-y-2">{customers.slice(0, limit).map((c, i) => <CustomerRow key={c.id} customer={c} index={i} />)}</ul>
      {customers.length > limit && (
        <Link to="/dues" className="mt-2 block rounded-xl py-2 text-center text-sm font-semibold text-brass">See all {customers.length} customers</Link>
      )}
    </section>
  );
}

CollectList.propTypes = { customers: PropTypes.array.isRequired, limit: PropTypes.number };
