import { memo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { Phone } from "lucide-react";
import { Money } from "../../ui/Money";
import { initials } from "../../utils/alphaIndex";
import { shortDate } from "../../utils/dashboardFormat";
import { telHref } from "../../utils/phone";

function CustomerRow({ customer: c, oweView = false }) {
  const call = telHref(c.phone);
  const meta = oweView
    ? <><span className={c.oldestUnpaidDays > 90 ? "font-semibold text-status-critical" : ""}>{c.oldestUnpaidDays} days</span> since the oldest unpaid order</>
    : c.lastOrderDate ? `Last order ${shortDate(c.lastOrderDate)} · ${c.ordersCount} order${c.ordersCount === 1 ? "" : "s"}` : "No orders yet";
  return (
    <li className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
      <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold text-brass" aria-hidden="true">{initials(c.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
          <span className="block truncate text-xs text-ink-2">{meta}</span>
        </span>
        <span className="shrink-0 text-right">
          {c.due > 0 ? <Money value={c.due} className="text-sm font-bold text-status-critical" /> : <span className="text-xs font-semibold text-status-good">Paid up</span>}
        </span>
      </Link>
      {call && <a href={call} aria-label={`Call ${c.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-brass"><Phone className="h-4 w-4" /></a>}
    </li>
  );
}

CustomerRow.propTypes = { customer: PropTypes.object.isRequired, oweView: PropTypes.bool };

export default memo(CustomerRow);
