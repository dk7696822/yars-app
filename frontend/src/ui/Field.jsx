import { cloneElement, isValidElement } from "react";
import PropTypes from "prop-types";

/** Label + one input + error (or hint). Wires id / aria-invalid / aria-describedby onto the input. */
export default function Field({ label, htmlFor, hint, error, optional = false, children }) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const input = isValidElement(children)
    ? cloneElement(children, { id: htmlFor, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })
    : children;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[0.8rem] font-semibold text-ink-2">
        {label}
        {optional && <span className="font-normal"> (optional)</span>}
      </label>
      {input}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-status-critical">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

Field.propTypes = { label: PropTypes.node.isRequired, htmlFor: PropTypes.string.isRequired, hint: PropTypes.node, error: PropTypes.string, optional: PropTypes.bool, children: PropTypes.node.isRequired };
