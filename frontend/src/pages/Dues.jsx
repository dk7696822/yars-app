import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dashboardAPI } from "../services/dashboardAPI";
import { filterByBand } from "../utils/duesFilter";
import { inr } from "../utils/dashboardFormat";
import CustomerRow from "../components/dashboard/CustomerRow";
import { Skeleton, LoadError, ChecksFailed } from "../components/dashboard/DashboardStates";

const BANDS = [["all", "All"], ["90+", "90+ days"], ["61-90", "61–90"], ["31-60", "31–60"], ["0-30", "0–30"]];

export default function Dues() {
  const [params, setParams] = useSearchParams();
  const band = BANDS.some(([k]) => k === params.get("age")) ? params.get("age") : "all";
  const [overview, setOverview] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = () => { setFailed(false); dashboardAPI.overview().then((r) => setOverview(r.data.data)).catch(() => setFailed(true)); };
  useEffect(load, []);

  if (failed) return <main className="mx-auto max-w-3xl px-4 py-4"><LoadError onRetry={load} /></main>;
  if (!overview) return <main className="mx-auto max-w-3xl px-4 py-4"><Skeleton /></main>;
  if (!overview.checks.ok) return <main className="mx-auto max-w-3xl px-4 py-4"><ChecksFailed /></main>;

  const list = filterByBand(overview.customers, band, overview.asOf);
  const total = list.reduce((s, c) => s + Math.round(c.amount * 100), 0) / 100;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-3 text-ink">
      <h1 className="font-num text-2xl font-bold">Dues</h1>
      <p className="mt-1 text-sm text-ink-2">{list.length} customer{list.length === 1 ? "" : "s"} · <span className="font-semibold text-ink">{inr(total)}</span>{band !== "all" && " in this age band"}</p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Age of dues">
        {BANDS.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={band === k} onClick={() => setParams(k === "all" ? {} : { age: k })}
            className={`flex-none rounded-full border px-3.5 py-1.5 text-xs font-semibold ${band === k ? "border-brass bg-brass text-brass-on" : "border-line bg-surface text-ink-2"}`}>{label}</button>
        ))}
      </div>
      {list.length === 0 ? <p className="mt-4 rounded-2xl bg-surface p-4 text-sm text-ink-2">No dues in this age band.</p>
        : <ul className="mt-3 space-y-2">{list.map((c, i) => <CustomerRow key={c.id} customer={c} index={i} />)}</ul>}
    </main>
  );
}
