import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { motion, useInView, useReducedMotion } from "motion/react";
import { axisInr, monthLabel } from "../../utils/dashboardFormat";

const W = 320;
const H = 150;
const BASE = 124;

/** Rounded-top bar path anchored to the baseline. */
const barPath = (x, w, h) => {
  const r = Math.min(4, h, w / 2);
  const y = BASE - h;
  return `M${x},${BASE}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${BASE}Z`;
};

export default function BarChart({ months, series, format, title, axisFormat = axisInr }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(months.length - 1);
  const max = Math.max(1, ...months.flatMap((m) => series.map((s) => m[s.key])));
  const step = W / months.length;
  const barW = Math.min(16, (step - 14 - (series.length - 1) * 2) / series.length);
  const scale = (v) => (v / max) * (BASE - 18);
  const mid = max / 2;
  const current = months[active];

  return (
    <figure ref={ref} className="rounded-2xl bg-surface p-3.5" aria-label={title}>
      {series.length > 1 && (
        <div className="mb-1 flex gap-4 text-xs text-ink-2">
          {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${s.swatch}`} />{s.label}</span>)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-hidden="true">
        <line x1="0" x2={W} y1={BASE - scale(mid)} y2={BASE - scale(mid)} className="stroke-line" strokeDasharray="3 4" />
        <text x="2" y={BASE - scale(mid) - 4} className="fill-ink-2" fontSize="9">{axisFormat(mid)}</text>
        <line x1="0" x2={W} y1={BASE} y2={BASE} className="stroke-line" />
        {months.map((m, i) => (
          <g key={m.month} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} className="cursor-pointer">
            <rect x={i * step} y="0" width={step} height={H} fill="transparent" />
            {series.map((s, j) => {
              const h = Math.max(0, scale(m[s.key]));
              const x = i * step + (step - (barW * series.length + 2 * (series.length - 1))) / 2 + j * (barW + 2);
              return (
                <motion.path key={s.key} d={barPath(x, barW, h)} className={s.fill} style={{ transformBox: "view-box", transformOrigin: `0px ${BASE}px`, opacity: active === i ? 1 : 0.55 }}
                  initial={reduce ? false : { scaleY: 0 }} animate={inView || reduce ? { scaleY: 1 } : { scaleY: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }} />
              );
            })}
            <text x={i * step + step / 2} y={H - 6} textAnchor="middle" fontSize="10" className={active === i ? "fill-ink font-semibold" : "fill-ink-2"}>
              {monthLabel(m.month)}{m.partial ? "*" : ""}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-2" aria-live="polite">
        <span className="font-semibold text-ink">{monthLabel(current.month)}{current.partial ? " (so far)" : ""}</span>
        {series.map((s) => <span key={s.key}>{s.label}: <span className="font-semibold text-ink tabular-nums">{format(current[s.key])}</span></span>)}
      </figcaption>
    </figure>
  );
}

BarChart.propTypes = {
  months: PropTypes.array.isRequired,
  series: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, fill: PropTypes.string, swatch: PropTypes.string })).isRequired,
  format: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  axisFormat: PropTypes.func,
};
