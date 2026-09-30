import { useState } from "react";
import PropTypes from "prop-types";
import InfoSheet from "./InfoSheet";
import { customRangeError } from "../../utils/periodPrefs";

const CHIPS = [["all", "All time"], ["this_month", "This month"], ["last_month", "Last month"], ["this_fy", "This FY"], ["custom", "Custom…"]];

export default function PeriodBar({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from || "");
  const [to, setTo] = useState(value.to || "");
  const rangeError = customRangeError(from, to);

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-canvas/90 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl">
      <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Period" style={{ scrollbarWidth: "none" }}>
        {CHIPS.map(([key, label]) => {
          const on = value.preset === key;
          return (
            <button key={key} type="button" role="radio" aria-checked={on}
              onClick={() => (key === "custom" ? setOpen(true) : onChange({ preset: key }))}
              className={`flex-none rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${on ? "border-brass bg-brass text-brass-on" : "border-line bg-surface text-ink-2 hover:text-ink"}`}>
              {key === "custom" && on ? `${value.from} → ${value.to}` : label}
            </button>
          );
        })}
      </div>
      <InfoSheet open={open} title="Custom period" onClose={() => setOpen(false)}>
        <label className="block text-ink">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-ink" /></label>
        <label className="block text-ink">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-ink" /></label>
        {from && to && rangeError && <p className="text-status-critical">{rangeError}</p>}
        <button type="button" disabled={Boolean(rangeError)} onClick={() => { onChange({ preset: "custom", from, to }); setOpen(false); }}
          className="mt-2 w-full rounded-xl bg-brass py-2.5 font-semibold text-brass-on disabled:opacity-40">Show this period</button>
      </InfoSheet>
    </div>
  );
}

PeriodBar.propTypes = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
