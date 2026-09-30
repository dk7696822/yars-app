import PropTypes from "prop-types";
import AnimatedNumber from "./AnimatedNumber";
import { inr, kgText, delta } from "../../utils/dashboardFormat";

const Badge = ({ d, neutral }) => {
  if (!d) return null;
  const tone = neutral || d.dir === "flat" ? "text-ink-2" : d.dir === "up" ? "text-status-good" : "text-status-critical";
  return <span className={`text-xs font-semibold ${tone}`}>{d.text}</span>;
};
Badge.propTypes = { d: PropTypes.object, neutral: PropTypes.bool };

const Tile = ({ label, children, badge, onInfo, note }) => (
  <div className="rounded-2xl bg-surface p-3.5">
    <div className="flex justify-between text-xs text-ink-2"><span>{label}</span><button type="button" onClick={onInfo} aria-label={`How ${label} is calculated`}>ⓘ</button></div>
    <div className="mt-1 text-xl font-bold text-ink">{children}</div>
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-2">{badge}{note && <span>{note}</span>}</div>
  </div>
);
Tile.propTypes = { label: PropTypes.string, children: PropTypes.node, badge: PropTypes.node, onInfo: PropTypes.func, note: PropTypes.node };

export default function KpiGrid({ period, onInfo }) {
  const v = period.volume;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Tile label="Sales" onInfo={() => onInfo("sales")} badge={<Badge d={delta(period.sales.value, period.sales.previous)} />} note={`${period.sales.orders} orders`}>
        <AnimatedNumber value={period.sales.value} format={inr} duration={0.4} />
      </Tile>
      <Tile label="Collected" onInfo={() => onInfo("collected")} badge={<Badge d={delta(period.collected.value, period.collected.previous)} />}>
        <AnimatedNumber value={period.collected.value} format={inr} duration={0.4} />
      </Tile>
      <Tile label="Kg sold" onInfo={() => onInfo("kg")} badge={<Badge d={delta(v.kgSold, v.previousKgSold)} />}
        note={v.piecesTotal > 0 ? `${new Intl.NumberFormat("en-IN").format(v.piecesTotal)} pcs${v.kgFromPieces > 0 ? ` · ≈${kgText(v.kgFromPieces)} from pcs` : ""}` : null}>
        <AnimatedNumber value={v.kgSold} format={kgText} duration={0.4} />
      </Tile>
      <Tile label="Expenses" onInfo={() => onInfo("expenses")} badge={<Badge neutral d={delta(period.expenses.value, period.expenses.previous)} />}>
        <AnimatedNumber value={period.expenses.value} format={inr} duration={0.4} />
      </Tile>
      {v.piecesWithoutWeight > 0 && (
        <p className="col-span-2 text-xs text-status-warn">+ {new Intl.NumberFormat("en-IN").format(v.piecesWithoutWeight)} pcs without weight (not in kg) — set weights in Product Sizes</p>
      )}
    </div>
  );
}

KpiGrid.propTypes = { period: PropTypes.object.isRequired, onInfo: PropTypes.func.isRequired };
