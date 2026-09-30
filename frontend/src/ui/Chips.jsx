import PropTypes from "prop-types";

export default function Chips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
              on ? "border-brass bg-brass text-brass-on" : "border-line bg-surface text-ink-2 hover:text-ink"}`}>
            {o.label}
            {o.count !== undefined && o.count !== null && <span className="ml-1.5 font-num tabular-nums opacity-80">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

Chips.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired, count: PropTypes.number })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
