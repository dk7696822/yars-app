import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { inr } from "../../utils/dashboardFormat";
import { telHref, whatsappHref } from "../../utils/phone";
import { buildReminder } from "../../utils/whatsappReminder";

const PhoneIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></svg>);
const ChatIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-4-1.1z" /></svg>);

export default function CustomerRow({ customer, index = 0 }) {
  const call = telHref(customer.phone);
  const wa = whatsappHref(customer.phone, buildReminder(customer));
  const old = customer.oldestDays > 90;
  return (
    <motion.li initial={{ y: 10 }} animate={{ y: 0 }} transition={{ delay: 1.05 + index * 0.06, duration: 0.4 }}
      className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
      <Link to={`/customers/${customer.id}`} className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
        <p className="truncate text-sm font-semibold text-ink">{customer.name}</p>
        <p className="text-xs text-ink-2">
          <span className={old ? "font-semibold text-status-critical" : ""}>{customer.oldestDays} days</span> · {customer.orders} order{customer.orders === 1 ? "" : "s"}
        </p>
      </Link>
      <span className="font-num text-[0.95rem] font-bold tabular-nums text-ink">{inr(customer.amount)}</span>
      {call && <a href={call} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-brass" aria-label={`Call ${customer.name}`}><PhoneIcon /></a>}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-raised text-status-good" aria-label={`WhatsApp reminder to ${customer.name}`}><ChatIcon /></a>}
    </motion.li>
  );
}

CustomerRow.propTypes = { customer: PropTypes.object.isRequired, index: PropTypes.number };
