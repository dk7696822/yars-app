import { memo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { DueText } from "../../ui/Money";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { itemsText } from "../../utils/itemsText";
import { ORDER_STATUS } from "../../utils/statusMeta";

function OrderRow({ row, showCustomer = true }) {
  const title = showCustomer ? row.customer.name : shortDate(row.orderDate);
  return (
    <li className="border-b border-line/60 last:border-0">
      <Link to={`/orders/${row.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-ink-2">{itemsText(row.items)} · {ORDER_STATUS[row.status]?.label || row.status}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-num text-sm font-bold tabular-nums ${row.cancelled ? "text-ink-2 line-through" : "text-ink"}`}>{inr(row.total)}</p>
          {row.cancelled ? <span className="text-xs text-ink-2">Not counted</span> : <DueText due={row.due} />}
        </div>
      </Link>
    </li>
  );
}

OrderRow.propTypes = {
  row: PropTypes.shape({
    id: PropTypes.string.isRequired, orderDate: PropTypes.string.isRequired, status: PropTypes.string.isRequired, cancelled: PropTypes.bool.isRequired,
    customer: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired, items: PropTypes.array.isRequired,
    total: PropTypes.number.isRequired, due: PropTypes.number.isRequired,
  }).isRequired,
  showCustomer: PropTypes.bool,
};

export default memo(OrderRow);
