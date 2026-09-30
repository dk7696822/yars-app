import PropTypes from "prop-types";
import { motion, useReducedMotion } from "motion/react";
import AnimatedNumber from "./AnimatedNumber";
import { inr } from "../../utils/dashboardFormat";

const BAND_STYLE = { "0-30": "bg-status-good", "31-60": "bg-status-warn", "61-90": "bg-status-serious", "90+": "bg-status-critical" };
const BAND_LABEL = { "0-30": "0–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "90+ days" };

export default function HeroDues({ overview, onBand, onInfo }) {
  const reduce = useReducedMotion();
  const over90 = overview.aging.find((b) => b.band === "90+");
  const total = overview.toCollect;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-raised to-surface p-5 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]" aria-labelledby="to-collect">
      <div className="flex items-center justify-between">
        <h2 id="to-collect" className="text-sm text-ink-2">To collect</h2>
        <button type="button" onClick={onInfo} className="rounded-full px-2 text-sm text-ink-2 hover:text-ink" aria-label="How To collect is calculated">ⓘ</button>
      </div>
      <AnimatedNumber value={total} format={inr} className="mt-1 block text-[2.6rem] font-bold leading-none tracking-tight text-ink" />
      <p className="mt-2 text-sm text-ink-2">
        {overview.customersOwing} customer{overview.customersOwing === 1 ? "" : "s"}
        {over90 && over90.amount > 0 && <> · <span className="font-semibold text-status-critical">{inr(over90.amount)} over 90 days</span></>}
      </p>
      {total > 0 && (
        <>
          <div className="mt-4 flex h-3.5 gap-[3px]" role="list" aria-label="Dues by age">
            {overview.aging.filter((b) => b.amount > 0).map((b, i) => (
              <motion.button key={b.band} type="button" role="listitem" onClick={() => onBand(b.band)}
                aria-label={`${BAND_LABEL[b.band]}: ${inr(b.amount)}`}
                className={`h-full origin-left rounded-md ${BAND_STYLE[b.band]}`} style={{ flexGrow: b.amount, flexBasis: 0 }}
                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 0.25 + i * 0.17, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-ink-2">
            {overview.aging.map((b) => (
              <li key={b.band}>
                <button type="button" onClick={() => onBand(b.band)} className="flex items-center gap-1.5 hover:text-ink">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${BAND_STYLE[b.band]}`} aria-hidden="true" />
                  {BAND_LABEL[b.band]} <span className="font-semibold text-ink tabular-nums">{inr(b.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {overview.credit > 0 && <p className="mt-3 text-xs text-ink-2">Customer credit (overpaid): <span className="font-semibold text-ink">{inr(overview.credit)}</span></p>}
      {overview.excluded.cancelled.count > 0 && <p className="mt-1 text-xs text-ink-2">Excludes {overview.excluded.cancelled.count} cancelled order(s), {inr(overview.excluded.cancelled.amount)}</p>}
    </section>
  );
}

HeroDues.propTypes = { overview: PropTypes.object.isRequired, onBand: PropTypes.func.isRequired, onInfo: PropTypes.func.isRequired };
