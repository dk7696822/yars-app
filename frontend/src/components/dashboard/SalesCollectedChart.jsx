import PropTypes from "prop-types";
import BarChart from "./BarChart";
import { inr } from "../../utils/dashboardFormat";

export default function SalesCollectedChart({ months }) {
  return (
    <section aria-labelledby="money-trend">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-5"><h2 id="money-trend" className="text-sm font-bold text-ink">Sales vs collected</h2><span className="text-xs text-ink-2">last 6 months</span></div>
      <BarChart title="Sales and collections per month" months={months} format={inr}
        series={[{ key: "sales", label: "Sales", fill: "fill-chart-sales", swatch: "bg-chart-sales" }, { key: "collected", label: "Collected", fill: "fill-chart-collected", swatch: "bg-chart-collected" }]} />
    </section>
  );
}
SalesCollectedChart.propTypes = { months: PropTypes.array.isRequired };
