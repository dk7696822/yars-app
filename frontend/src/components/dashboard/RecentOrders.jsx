import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { inr, shortDate } from "../../utils/dashboardFormat";

const STATUS = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed", DELIVERED: "Delivered", CANCELLED: "Cancelled" };

export default function RecentOrders({ orders, inProgress }) {
  return (
    <section aria-labelledby="recent">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-5"><h2 id="recent" className="text-sm font-bold text-ink">Recent orders</h2><span className="text-xs text-ink-2">{inProgress} in progress</span></div>
      <ul className="divide-y divide-line rounded-2xl bg-surface px-3.5">
        {orders.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium text-ink">{o.customerName}</span><span className="text-xs text-ink-2">{shortDate(o.orderDate)} · {STATUS[o.status] || o.status}</span></span>
              <span className="font-num font-semibold tabular-nums text-ink">{inr(o.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/orders" className="mt-2 block py-2 text-center text-sm font-semibold text-brass">All orders</Link>
    </section>
  );
}
RecentOrders.propTypes = { orders: PropTypes.array.isRequired, inProgress: PropTypes.number.isRequired };
