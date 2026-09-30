import PropTypes from "prop-types";

export default function Switch({ checked, onChange, label, description }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-2">{description}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brass" : "bg-line"}`} aria-hidden="true">
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-canvas transition-all ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

Switch.propTypes = { checked: PropTypes.bool.isRequired, onChange: PropTypes.func.isRequired, label: PropTypes.string.isRequired, description: PropTypes.node };
