import PropTypes from "prop-types";
import BarChart from "./BarChart";
import { kgText } from "../../utils/dashboardFormat";

export default function KgChart({ months, topSizes }) {
  const max = Math.max(1, ...topSizes.map((s) => s.kg));
  return (
    <section aria-labelledby="kg-trend">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-5"><h2 id="kg-trend" className="text-sm font-bold text-ink">Kg sold</h2><span className="text-xs text-ink-2">last 6 months</span></div>
      <BarChart title="Kg sold per month" months={months} format={kgText} series={[{ key: "kgSold", label: "Kg sold", fill: "fill-chart-kg", swatch: "bg-chart-kg" }]} />
      {topSizes.length > 0 && (
        <div className="mt-2 rounded-2xl bg-surface p-3.5">
          <h3 className="mb-2 text-xs font-bold text-ink">Top sizes · selected period</h3>
          {topSizes.map((s) => (
            <div key={s.size} className="my-1.5 flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-ink-2">{s.size}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-chart-kg" style={{ width: `${(s.kg / max) * 100}%` }} /></span>
              <span className="w-20 text-right font-semibold tabular-nums text-ink">{kgText(s.kg)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
KgChart.propTypes = { months: PropTypes.array.isRequired, topSizes: PropTypes.array.isRequired };
