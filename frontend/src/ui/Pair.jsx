import PropTypes from "prop-types";

/** Two inputs read as one sentence ("[1000] pcs cost ₹[375]"), with one error or hint below. */
export default function Pair({ legend, error, hint, children }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[0.8rem] font-semibold text-ink-2">{legend}</legend>
      <div className="flex items-center gap-2">{children}</div>
      {error ? <p role="alert" className="text-xs font-medium text-status-critical">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </fieldset>
  );
}

Pair.propTypes = { legend: PropTypes.node.isRequired, error: PropTypes.string, hint: PropTypes.node, children: PropTypes.node };
