import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { dashboardAPI } from "../services/dashboardAPI";
import { loadPeriod, savePeriod } from "../utils/periodPrefs";
import { latestOnly } from "../utils/latestOnly";
import { rangeText } from "../utils/dashboardFormat";
import { DEFINITIONS } from "../components/dashboard/definitions";
import HeroDues from "../components/dashboard/HeroDues";
import CollectList from "../components/dashboard/CollectList";
import PeriodBar from "../components/dashboard/PeriodBar";
import KpiGrid from "../components/dashboard/KpiGrid";
import SalesCollectedChart from "../components/dashboard/SalesCollectedChart";
import KgChart from "../components/dashboard/KgChart";
import ExpenseCategories from "../components/dashboard/ExpenseCategories";
import RecentOrders from "../components/dashboard/RecentOrders";
import InfoSheet from "../components/dashboard/InfoSheet";
import { Skeleton, LoadError, ChecksFailed } from "../components/dashboard/DashboardStates";

export default function Dashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [periodData, setPeriodData] = useState(null);
  const [period, setPeriod] = useState(loadPeriod);
  const [failed, setFailed] = useState(false);
  const [info, setInfo] = useState(null);
  const latest = useRef(latestOnly()).current;

  const loadNow = useCallback(async () => {
    try {
      setFailed(false);
      const [o, t] = await Promise.all([dashboardAPI.overview(), dashboardAPI.trends()]);
      setOverview(o.data.data);
      setTrends(t.data.data);
    } catch {
      setFailed(true);
    }
  }, []);

  const loadPeriodData = useCallback(async (p) => {
    try {
      const res = await latest(dashboardAPI.period(p));
      if (res !== latestOnly.STALE) setPeriodData(res.data.data);
    } catch {
      setFailed(true);
    }
  }, [latest]);

  useEffect(() => { loadNow(); }, [loadNow]);
  useEffect(() => { loadPeriodData(period); }, [period, loadPeriodData]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && (loadNow(), loadPeriodData(period));
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadNow, loadPeriodData, period]);

  const changePeriod = (p) => { setPeriod(p); savePeriod(p); };
  const checksOk = overview?.checks.ok && periodData?.checks.ok !== false;
  const infoContent = useMemo(() => {
    if (!info) return null;
    const def = DEFINITIONS[info];
    const extra = [];
    if (info !== "toCollect" && periodData) {
      extra.push(`Period: ${rangeText(periodData.range)}${periodData.compare ? `, compared with ${rangeText(periodData.compare)}` : ""}.`);
      if (info === "collected" && periodData.excluded.deletedOrderPayments.count > 0) {
        extra.push(`Excludes ₹${periodData.excluded.deletedOrderPayments.amount.toLocaleString("en-IN")} received on ${periodData.excluded.deletedOrderPayments.count} payment(s) of deleted orders.`);
      }
    }
    return { ...def, body: [...def.body, ...extra] };
  }, [info, periodData]);

  if (failed && !overview) return <main className="mx-auto max-w-6xl bg-canvas px-4 py-4"><LoadError onRetry={() => { loadNow(); loadPeriodData(period); }} /></main>;
  if (!overview || !trends) return <main className="mx-auto max-w-6xl px-4 py-4"><Skeleton /></main>;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-3 text-ink sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
      {!checksOk ? (
        <div className="lg:col-span-2"><ChecksFailed /></div>
      ) : (
        <>
          <div className="space-y-1">
            <HeroDues overview={overview} onInfo={() => setInfo("toCollect")} onBand={(band) => navigate(`/dues?age=${encodeURIComponent(band)}`)} />
            <CollectList customers={overview.customers} />
            <div className="hidden lg:block"><RecentOrders orders={overview.recentOrders} inProgress={overview.inProgress} /></div>
          </div>
          <div className="mt-4 space-y-1 lg:mt-0">
            <PeriodBar value={period} onChange={changePeriod} />
            {periodData ? (
              <>
                <div className="pt-3"><KpiGrid period={periodData} onInfo={setInfo} /></div>
                {periodData.sales.orders === 0 && periodData.collected.value === 0 && periodData.expenses.value === 0 && (
                  <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">No orders in this period.</p>
                )}
                <SalesCollectedChart months={trends.months} />
                <KgChart months={trends.months} topSizes={periodData.topSizes} />
                <ExpenseCategories categories={periodData.expenses.byCategory} />
              </>
            ) : <div className="pt-3"><Skeleton /></div>}
            <div className="lg:hidden"><RecentOrders orders={overview.recentOrders} inProgress={overview.inProgress} /></div>
          </div>
        </>
      )}
      {/* Portal: the transformed page wrapper would otherwise pin this to the page, not the screen. */}
      {createPortal(
        <Link to="/orders/new" className="fixed bottom-24 left-4 z-30 rounded-2xl bg-brass px-4 py-3 text-sm font-bold text-brass-on shadow-lg shadow-brass/30 sm:hidden">＋ New order</Link>,
        document.body
      )}
      <InfoSheet open={Boolean(info)} title={infoContent?.title || ""} onClose={() => setInfo(null)}>
        {infoContent?.body.map((p) => <p key={p}>{p}</p>)}
      </InfoSheet>
    </main>
  );
}
