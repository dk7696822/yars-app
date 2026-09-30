import PropTypes from "prop-types";
import { ORDER_STATUS, INVOICE_STATUS, TONE_CLASS } from "../utils/statusMeta";

export default function StatusBadge({ kind = "order", status }) {
  const meta = (kind === "invoice" ? INVOICE_STATUS : ORDER_STATUS)[status] || { label: status, tone: "muted" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>;
}

StatusBadge.propTypes = { kind: PropTypes.oneOf(["order", "invoice"]), status: PropTypes.string.isRequired };
