import PropTypes from "prop-types";
import { TONE_CLASS } from "../utils/statusMeta";

/** A small status badge: tone is good | warn | critical | info | muted. */
export default function Tag({ label, tone = "muted" }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone] || TONE_CLASS.muted}`}>{label}</span>;
}

Tag.propTypes = { label: PropTypes.node.isRequired, tone: PropTypes.string };
