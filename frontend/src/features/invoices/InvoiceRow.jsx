import { memo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { DueText } from "../../ui/Money";
import { inr, shortDate } from "../../utils/dashboardFormat";

function InvoiceRow({ row }) {
  const cancelled = row.derivedStatus === "CANCELLED";
  return (
    <li className="border-b border-line/60 last:border-0">
      <Link to={`/invoices/${row.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">#{row.number} · {row.customer.name}</p>
          <p className="truncate text-xs text-ink-2">
            {shortDate(row.invoiceDate)} ·{" "}
            {row.derivedStatus === "OVERDUE"
              ? <span className="font-semibold text-status-critical">overdue {row.overdueDays} day{row.overdueDays === 1 ? "" : "s"}</span>
              : row.dueDate ? `due ${shortDate(row.dueDate)}` : "no due date"}
            {row.taxPercent > 0 && ` · ${row.taxPercent}% GST`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-num text-sm font-bold tabular-nums ${cancelled ? "text-ink-2 line-through" : "text-ink"}`}>{inr(row.finalAmount)}</p>
          {cancelled ? <span className="text-xs text-ink-2">Cancelled</span> : <DueText due={row.amountDue > 0 ? row.amountDue : -row.amountExtra} />}
        </div>
      </Link>
    </li>
  );
}

InvoiceRow.propTypes = { row: PropTypes.object.isRequired };

export default memo(InvoiceRow);
