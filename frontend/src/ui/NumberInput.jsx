import PropTypes from "prop-types";
import { INPUT, INPUT_INVALID } from "./styles";

/**
 * Keeps exactly what was typed (text) — parse it with parseNumber. A text box
 * with a number keypad: no spinner and no browser `step` rules, so 12.25 kg
 * is never refused.
 */
export default function NumberInput({ value, onChange, prefix, suffix, whole = false, signed = false, className = "", ...rest }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2">{prefix}</span>}
      <input type="text" inputMode={signed ? "text" : whole ? "numeric" : "decimal"} autoComplete="off" value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} font-num tabular-nums ${prefix ? "pl-8" : ""} ${suffix ? "pr-14" : ""} ${rest["aria-invalid"] ? INPUT_INVALID : ""} ${className}`} {...rest} />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-2">{suffix}</span>}
    </div>
  );
}

NumberInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  whole: PropTypes.bool,
  signed: PropTypes.bool,
  className: PropTypes.string,
};
