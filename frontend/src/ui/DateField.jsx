import PropTypes from "prop-types";
import { INPUT } from "./styles";
import { todayIST, addDays } from "../utils/istDate";

/** Native date picker (value "YYYY-MM-DD", India dates) with Today / Yesterday shortcuts. */
export default function DateField({ value, onChange, quick = true, ...rest }) {
  const today = todayIST();
  const chips = [["Today", today], ["Yesterday", addDays(today, -1)]];
  return (
    <div className="space-y-2">
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} font-num [color-scheme:light] dark:[color-scheme:dark]`} {...rest} />
      {quick && (
        <div className="flex gap-2">
          {chips.map(([label, d]) => (
            <button key={label} type="button" aria-pressed={value === d} onClick={() => onChange(d)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold ${value === d ? "border-brass text-brass" : "border-line text-ink-2"}`}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

DateField.propTypes = { value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, quick: PropTypes.bool };
