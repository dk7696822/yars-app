import PropTypes from "prop-types";

export default function Tabs({ label, tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-2xl bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" id={`tab-${t.value}`} aria-selected={t.value === value} aria-controls={`panel-${t.value}`}
          onClick={() => onChange(t.value)}
          className={`h-9 flex-1 rounded-xl text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${
            t.value === value ? "bg-raised text-ink" : "text-ink-2 hover:text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

Tabs.propTypes = {
  label: PropTypes.string.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.node.isRequired })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export function TabPanel({ value, children }) {
  return <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} className="mt-3">{children}</div>;
}

TabPanel.propTypes = { value: PropTypes.string.isRequired, children: PropTypes.node };
