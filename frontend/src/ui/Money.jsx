import PropTypes from "prop-types";
import { inr } from "../utils/dashboardFormat";

/** The only way a ₹ figure is printed: exact, Indian grouping, tabular digits. */
export function Money({ value, className = "" }) {
  return <span className={`font-num tabular-nums ${className}`}>{inr(value)}</span>;
}

Money.propTypes = { value: PropTypes.number.isRequired, className: PropTypes.string };

/** A row's due: red "Due ₹X", green "Paid ✓", or "Paid ✓ +₹X extra" when more was received than billed. */
export function DueText({ due, className = "" }) {
  const d = Number(due);
  if (d > 0) return <span className={`text-xs font-semibold text-status-critical ${className}`}>Due <Money value={d} /></span>;
  return (
    <span className={`text-xs font-semibold text-status-good ${className}`}>
      Paid ✓{d < 0 && <span className="font-normal text-ink-2"> +<Money value={-d} /> extra</span>}
    </span>
  );
}

DueText.propTypes = { due: PropTypes.number.isRequired, className: PropTypes.string };
