# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard with a mobile-first, dark-by-default "Midnight Forest & Brass" screen whose every number is defined, computed server-side by the shared order math, and reconciled to the paisa — plus a Dues screen with call/WhatsApp reminders.

**Architecture:** Three read-only endpoints (`/api/dashboard/overview|period|trends`) backed by pure, unit-tested modules (`dateRanges`, `metrics`) over one ledger read. Frontend: theme tokens as CSS variables mapped into Tailwind, one component per dashboard section, Motion for the open sequence and responsive transitions, hand-built SVG charts.

**Tech Stack:** Node 20 / Express 5 / Sequelize 6 / Postgres; Jest 30 (Docker test DB). React 19 / Vite 6 / Tailwind 3 / Vitest 3 / `motion` 13.

**Spec:** `docs/superpowers/specs/2026-09-30-dashboard-redesign-design.md`

## Global Constraints

- **No incorrect data.** Every figure follows spec §1 exactly. Order totals/remainders only via `backend/src/services/orderMath.js`. Sums in integer paise. If `checks.ok` is false the UI shows the red banner, never the figures.
- Scope: live orders (`is_archived = false`), all lines (never inner-joined away), `CANCELLED` excluded and reported. Payments on deleted orders excluded from Collected and reported.
- All date boundaries in **Asia/Kolkata**; dates are `YYYY-MM-DD` strings; the server resolves presets.
- Endpoints are read-only and behind the existing JWT middleware.
- Theme tokens (exact values): dark bg `#06110d`, surface `#0e1f19`, raised `#123126`, line `#173229`, ink `#eaf6f0`, ink-2 `#93b3a5`, brass `#d9b25f`, on-brass `#1c1606`, status `#37c98f #f0c248 #f08a45 #ff6a5e`, chart sales `#ad8733`, collected `#4a90e2`, kg `#857ce0`, expense `#8a93a8`. Light bg `#f4f7f5`, surface `#ffffff`, raised `#eef3f0`, line `#dde6e1`, ink `#10201a`, ink-2 `#55706a`, brass `#8a6a1f`, on-brass `#ffffff`, status `#1f8a5f #b7860b #c4611c #d23b31`, chart sales `#9a7426`, collected `#2f78d0`, kg `#6b5fd0`, expense `#66708a`. (Validated 2026-09-30 with the dataviz validator.)
- Dark by default; stored user choice wins. `prefers-reduced-motion` → no animation, final values immediately.
- Typography: Sora (numbers/headings, tabular nums), DM Sans (body).
- Never touch secrets; stage by explicit path; GitHub repo is public.
- UI changes update `backend/knowledge/*.md` in the same task that changes the UI (Task 12 does the dashboard KB; Task 11 adds `/dues`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A payment dated in one month for an order dated in an earlier month** — expect it in that month's Collected, not the order's month. → Task 2 test "payment on an old order counts in the month received".
2. **Opening the app just after midnight IST (server in UTC)** — expect the new day/month. → Task 1 test "IST midnight".
3. **"This month" on the 31st** — expect comparison to clamp to the previous month's last day. → Task 1 test "31 Mar compares to 28/29 Feb".
4. **A customer with no/landline/garbled phone** — expect Call/WhatsApp hidden, no broken link. → Task 6 test "invalid numbers give null".
5. **Switching period quickly several times** — expect the last choice's numbers, not a stale response overwriting them. → Task 8 uses a request-sequence guard; tested via `latestOnly` unit test.

---

## File Structure

**Backend — create**
- `backend/src/services/dashboard/dateRanges.js` — pure IST date helpers, presets, comparison ranges, aging bands.
- `backend/src/services/dashboard/metrics.js` — pure dues/period/trends/checks over a ledger.
- `backend/src/services/dashboard/ledger.js` — one read of live orders (+lines, plate charge, payments), deleted-order payments, expenses.
- `backend/src/controllers/dashboardController.js`, `backend/src/routes/dashboardRoutes.js`
- `backend/scripts/dashboard-verify.js` — read-only production cross-check.
- Tests: `dashboardDateRanges.test.js`, `dashboardMetrics.test.js`, `dashboardController.test.js`, `dashboardVerify.test.js`

**Backend — modify:** `backend/src/routes/index.js`, `backend/knowledge/dashboard.md`, `backend/knowledge/routes.md`, `HANDOFF.md`

**Frontend — create**
- `frontend/src/utils/dashboardFormat.js`, `phone.js`, `whatsappReminder.js`, `periodPrefs.js`, `duesFilter.js`, `latestOnly.js` (+ tests)
- `frontend/src/services/dashboardAPI.js`
- `frontend/src/components/dashboard/`: `AnimatedNumber.jsx`, `InfoSheet.jsx`, `definitions.js`, `HeroDues.jsx`, `CustomerRow.jsx`, `CollectList.jsx`, `PeriodBar.jsx`, `KpiGrid.jsx`, `BarChart.jsx`, `SalesCollectedChart.jsx`, `KgChart.jsx`, `ExpenseCategories.jsx`, `RecentOrders.jsx`, `DashboardStates.jsx`
- `frontend/src/pages/Dues.jsx`

**Frontend — modify:** `package.json` (`motion`), `index.html` (Sora), `tailwind.config.js`, `src/assets/styles/index.css` (tokens), `src/components/theme/ThemeProvider.jsx` (dark default), `src/pages/Dashboard.jsx` (rewrite), `src/App.jsx` (`/dues` route)

---

### Task 1: IST date ranges (pure)

**Files:** Create `backend/src/services/dashboard/dateRanges.js`; Test `backend/tests/dashboardDateRanges.test.js`

**Interfaces — Produces:** `todayIST(now?) → "YYYY-MM-DD"`, `addDays(d, n)`, `daysBetween(a, b)`, `monthStart(d)`, `monthEnd(d)`, `lastMonths(today, n) → ["YYYY-MM", …]`, `agingBand(days) → "0-30"|"31-60"|"61-90"|"90+"`, `resolvePeriod({preset, from, to}, today, earliest) → { range:{from,to,label}, compare:{from,to}|null }`, `class PeriodError extends Error`, `BANDS`.

- [ ] **Step 1: Failing tests** — `backend/tests/dashboardDateRanges.test.js`:

```js
"use strict";

const d = require("../src/services/dashboard/dateRanges");

describe("dashboard date ranges (IST)", () => {
  test("IST midnight: 18:30 UTC on 30 Sep is already 1 Oct in India", () => {
    expect(d.todayIST(new Date("2026-09-30T18:29:59Z"))).toBe("2026-09-30");
    expect(d.todayIST(new Date("2026-09-30T18:30:00Z"))).toBe("2026-10-01");
  });

  test("date arithmetic", () => {
    expect(d.addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(d.addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(d.daysBetween("2026-09-01", "2026-09-30")).toBe(29);
    expect(d.monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(d.monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(d.lastMonths("2026-09-30", 6)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(d.lastMonths("2026-02-15", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  test.each([[0, "0-30"], [30, "0-30"], [31, "31-60"], [60, "31-60"], [61, "61-90"], [90, "61-90"], [91, "90+"]])(
    "aging band %i days → %s", (days, band) => expect(d.agingBand(days)).toBe(band));

  test("all time: earliest → today, no comparison", () => {
    expect(d.resolvePeriod({ preset: "all" }, "2026-09-30", "2025-03-24"))
      .toEqual({ range: { from: "2025-03-24", to: "2026-09-30", label: "All time" }, compare: null });
    expect(d.resolvePeriod({}, "2026-09-30", null).range.from).toBe("2026-09-30");
  });

  test("this month compares with the same days last month", () => {
    expect(d.resolvePeriod({ preset: "this_month" }, "2026-09-30", null))
      .toEqual({ range: { from: "2026-09-01", to: "2026-09-30", label: "This month" }, compare: { from: "2026-08-01", to: "2026-08-30" } });
  });

  test("31 Mar compares to 28/29 Feb", () => {
    expect(d.resolvePeriod({ preset: "this_month" }, "2026-03-31", null).compare).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(d.resolvePeriod({ preset: "this_month" }, "2028-03-31", null).compare).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  test("this month on the 1st is a one-day window vs the 1st of last month", () => {
    expect(d.resolvePeriod({ preset: "this_month" }, "2026-10-01", null))
      .toEqual({ range: { from: "2026-10-01", to: "2026-10-01", label: "This month" }, compare: { from: "2026-09-01", to: "2026-09-01" } });
  });

  test("last month is the full previous month vs the month before", () => {
    expect(d.resolvePeriod({ preset: "last_month" }, "2026-03-15", null))
      .toEqual({ range: { from: "2026-02-01", to: "2026-02-28", label: "Last month" }, compare: { from: "2026-01-01", to: "2026-01-31" } });
  });

  test("financial year starts 1 April", () => {
    expect(d.resolvePeriod({ preset: "this_fy" }, "2026-09-30", null))
      .toEqual({ range: { from: "2026-04-01", to: "2026-09-30", label: "This financial year" }, compare: { from: "2025-04-01", to: "2025-09-30" } });
    expect(d.resolvePeriod({ preset: "this_fy" }, "2027-01-10", null).range.from).toBe("2026-04-01");
    expect(d.resolvePeriod({ preset: "this_fy" }, "2028-02-29", null).compare).toEqual({ from: "2026-04-01", to: "2027-02-28" });
  });

  test("custom compares with the equal-length window just before it", () => {
    expect(d.resolvePeriod({ preset: "custom", from: "2026-09-11", to: "2026-09-20" }, "2026-09-30", null))
      .toEqual({ range: { from: "2026-09-11", to: "2026-09-20", label: "Custom" }, compare: { from: "2026-09-01", to: "2026-09-10" } });
  });

  test.each([
    [{ preset: "weekly" }, /unknown period/i],
    [{ preset: "custom", from: "2026-09-20", to: "2026-09-11" }, /on or before/i],
    [{ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, /YYYY-MM-DD/],
    [{ preset: "custom", from: "2019-01-01", to: "2026-01-01" }, /5 years/],
  ])("rejects %o", (input, message) => {
    expect(() => d.resolvePeriod(input, "2026-09-30", null)).toThrow(d.PeriodError);
    expect(() => d.resolvePeriod(input, "2026-09-30", null)).toThrow(message);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing): `cd backend && npx cross-env NODE_ENV=test jest tests/dashboardDateRanges.test.js`

- [ ] **Step 3: Implement** `backend/src/services/dashboard/dateRanges.js`:

```js
"use strict";

/**
 * Dashboard dates. Everything is a "YYYY-MM-DD" string in India time (the
 * server runs in UTC, so "today" must never come from the server clock's date).
 * Arithmetic runs on UTC midnights, which has no DST and no timezone drift.
 */

class PeriodError extends Error {}

const DAY_MS = 86400000;
const BANDS = ["0-30", "31-60", "61-90", "90+"];
const LABELS = { all: "All time", this_month: "This month", last_month: "Last month", this_fy: "This financial year", custom: "Custom" };
const MAX_SPAN_DAYS = 5 * 366;

const todayIST = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const toMs = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromMs(toMs(s)) === s;

const addDays = (d, n) => fromMs(toMs(d) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY_MS);
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const monthEnd = (d) => {
  const [y, m] = d.split("-").map(Number);
  return fromMs(Date.UTC(y, m, 0));
};
/** First day of the month `n` months from d's month. */
const shiftMonth = (d, n) => {
  const [y, m] = d.split("-").map(Number);
  return fromMs(Date.UTC(y, m - 1 + n, 1));
};
/** The given day in a month, clamped to that month's last day (31 → 28/29 Feb). */
const clampDay = (firstOfMonth, day) => {
  const last = Number(monthEnd(firstOfMonth).slice(8));
  return `${firstOfMonth.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
};

const lastMonths = (today, n) => Array.from({ length: n }, (_, i) => shiftMonth(today, i - (n - 1)).slice(0, 7));

const agingBand = (days) => (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");

const resolvePeriod = ({ preset = "all", from, to } = {}, today, earliest) => {
  const day = Number(today.slice(8));
  switch (preset) {
    case "all": {
      const start = earliest && earliest < today ? earliest : today;
      return { range: { from: start, to: today, label: LABELS.all }, compare: null };
    }
    case "this_month": {
      const prev = shiftMonth(today, -1);
      return { range: { from: monthStart(today), to: today, label: LABELS.this_month }, compare: { from: prev, to: clampDay(prev, day) } };
    }
    case "last_month": {
      const m1 = shiftMonth(today, -1);
      const m2 = shiftMonth(today, -2);
      return { range: { from: m1, to: monthEnd(m1), label: LABELS.last_month }, compare: { from: m2, to: monthEnd(m2) } };
    }
    case "this_fy": {
      const year = Number(today.slice(0, 4));
      const fyYear = Number(today.slice(5, 7)) >= 4 ? year : year - 1;
      const sameMonthLastYear = `${year - 1}${today.slice(4, 8)}01`;
      return {
        range: { from: `${fyYear}-04-01`, to: today, label: LABELS.this_fy },
        compare: { from: `${fyYear - 1}-04-01`, to: clampDay(sameMonthLastYear, day) },
      };
    }
    case "custom": {
      if (!isDate(from) || !isDate(to)) throw new PeriodError("Custom period needs from and to dates as YYYY-MM-DD");
      if (from > to) throw new PeriodError("From date must be on or before To date");
      const span = daysBetween(from, to) + 1;
      if (span > MAX_SPAN_DAYS) throw new PeriodError("Custom period can be at most 5 years");
      const compareTo = addDays(from, -1);
      return { range: { from, to, label: LABELS.custom }, compare: { from: addDays(compareTo, -(span - 1)), to: compareTo } };
    }
    default:
      throw new PeriodError(`Unknown period "${preset}"`);
  }
};

module.exports = { PeriodError, BANDS, todayIST, addDays, daysBetween, monthStart, monthEnd, lastMonths, agingBand, resolvePeriod };
```

- [ ] **Step 4: Run — expect PASS**, then **Step 5: commit**:

```bash
git add backend/src/services/dashboard/dateRanges.js backend/tests/dashboardDateRanges.test.js
git commit -m "feat(dashboard): IST date ranges, presets and comparison periods

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dashboard metrics (pure)

**Files:** Create `backend/src/services/dashboard/metrics.js`; Test `backend/tests/dashboardMetrics.test.js`

**Interfaces**
- Consumes: `orderMath` (`orderTotal`, `paymentPosition`, `volumeSummary`, `lineKg`), Task 1.
- Ledger shape (produced by Task 3): `{ orders:[{ id, customer_id, customerName, customerPhone, order_date, created_at, status, custom_plate_charge, round_off_amount, advance_received, plateType:{charge}, orderProductSizes:[…line fields, productSize:{rate_per_kg,size_label}], payments:[{amount,payment_type,payment_date}] }], deletedOrderPayments:[{amount,payment_date}], expenses:[{bill_date,total_cost,categoryName}], earliest }`
- Produces: `computeOverview(ledger, today)`, `computePeriod(ledger, range, compare)`, `computeTrends(ledger, today, months=6)`, `reconcile({...paise})`, `toPaise(x)` — response shapes exactly as spec §4.

- [ ] **Step 1: Failing tests** — `backend/tests/dashboardMetrics.test.js`:

```js
"use strict";

const m = require("../src/services/dashboard/metrics");

const TODAY = "2026-09-30";
const kgLine = (kg, rate) => ({ unit: "KG", quantity_kg: String(kg), rate_per_kg: String(rate), productSize: { rate_per_kg: String(rate), size_label: "14 x 18" } });
const order = (o) => ({
  customer_id: "c1", customerName: "Alpha", customerPhone: "09876543210", created_at: new Date("2026-01-01T00:00:00Z"),
  status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00", advance_received: "0.00",
  plateType: { charge: "0.00" }, payments: [], orderProductSizes: [kgLine(10, 100)], ...o,
});
const pay = (amount, payment_date, payment_type = "PARTIAL") => ({ amount: String(amount), payment_date, payment_type });
const ledger = (orders, extra = {}) => ({ orders, deletedOrderPayments: [], expenses: [], earliest: "2026-01-01", ...extra });

describe("computeOverview", () => {
  const base = ledger([
    order({ id: "o1", order_date: "2026-09-20", payments: [pay(400, "2026-09-21")] }),                                   // owes 600, 10 d
    order({ id: "o2", order_date: "2026-05-01", payments: [] }),                                                         // owes 1000, 152 d
    order({ id: "o3", customer_id: "c2", customerName: "Beta", customerPhone: null, order_date: "2026-08-15", payments: [pay(1000, "2026-08-20")] }), // settled
    order({ id: "o4", customer_id: "c2", customerName: "Beta", order_date: "2026-07-20", payments: [pay(1250, "2026-07-21")] }), // credit 250
    order({ id: "o5", order_date: "2026-09-25", status: "CANCELLED" }),                                                  // excluded
  ]);
  const out = m.computeOverview(base, TODAY);

  test("to collect, credit and counts", () => {
    expect(out.toCollect).toBe(1600);
    expect(out.credit).toBe(250);
    expect(out.ordersOwing).toBe(2);
    expect(out.customersOwing).toBe(1);
  });

  test("aging bands sum to to-collect", () => {
    expect(out.aging).toEqual([
      { band: "0-30", amount: 600, orders: 1 }, { band: "31-60", amount: 0, orders: 0 },
      { band: "61-90", amount: 0, orders: 0 }, { band: "90+", amount: 1000, orders: 1 },
    ]);
  });

  test("customer list: oldest first, with unpaid orders oldest first", () => {
    expect(out.customers).toEqual([{
      id: "c1", name: "Alpha", phone: "09876543210", amount: 1600, orders: 2, oldestOrderDate: "2026-05-01", oldestDays: 152,
      unpaidOrders: [{ id: "o2", orderDate: "2026-05-01", remaining: 1000 }, { id: "o1", orderDate: "2026-09-20", remaining: 600 }],
    }]);
  });

  test("cancelled orders excluded and reported; recent orders and in-progress", () => {
    expect(out.excluded.cancelled).toEqual({ count: 1, amount: 1000 });
    expect(out.recentOrders.map((r) => r.id)).toEqual(["o5", "o1", "o3", "o4", "o2"]);
    expect(out.inProgress).toBe(0);
  });

  test("checks pass", () => {
    expect(out.checks).toEqual({ ok: true, allTime: true, agingSum: true, customersSum: true });
  });

  test("float kg math stays paise-exact", () => {
    const o = m.computeOverview(ledger([order({ id: "f", order_date: "2026-09-01", orderProductSizes: [kgLine("12.35", "181.25")] })]), TODAY);
    expect(o.toCollect).toBe(2238.44);
    expect(o.checks.ok).toBe(true);
  });
});

describe("reconcile", () => {
  test("flags any disagreement", () => {
    const good = { salesPaise: 1000, receivedPaise: 400, toCollectPaise: 700, creditPaise: 100, agingPaise: [700], customersPaise: [700] };
    expect(m.reconcile(good).ok).toBe(true);
    expect(m.reconcile({ ...good, agingPaise: [699] })).toMatchObject({ ok: false, agingSum: false });
    expect(m.reconcile({ ...good, customersPaise: [701] })).toMatchObject({ ok: false, customersSum: false });
    expect(m.reconcile({ ...good, receivedPaise: 401 })).toMatchObject({ ok: false, allTime: false });
  });
});

describe("computePeriod", () => {
  const L = ledger([
    order({ id: "old", order_date: "2026-06-10", payments: [pay(300, "2026-09-05")] }),              // payment received in Sep on a June order
    order({ id: "sep", order_date: "2026-09-10", payments: [pay(200, "2026-09-12"), pay(100, "2026-08-30")] }),
    order({ id: "aug", order_date: "2026-08-10", orderProductSizes: [kgLine(5, 100), { unit: "PIECES", quantity_pieces: 1000, price_amount: "375", price_pieces_count: 1000, weight_kg: "10", weight_pieces_count: 1000, weight_source: "SIZE", productSize: { size_label: "10 x 12" } }] }),
    order({ id: "legacy", order_date: "2026-09-02", advance_received: "50.00", payments: [] }),       // column-only advance
    order({ id: "cx", order_date: "2026-09-03", status: "CANCELLED", payments: [pay(999, "2026-09-03")] }),
  ], {
    deletedOrderPayments: [{ amount: "70.00", payment_date: "2026-09-09" }, { amount: "5.00", payment_date: "2026-08-01" }],
    expenses: [{ bill_date: "2026-09-01", total_cost: "120.50", categoryName: "Ink" }, { bill_date: "2026-09-02", total_cost: "300.00", categoryName: "Raw Material" }, { bill_date: "2026-08-02", total_cost: "80.00", categoryName: "Ink" }],
  });
  const sep = { from: "2026-09-01", to: "2026-09-30" };
  const aug = { from: "2026-08-01", to: "2026-08-30" };
  const out = m.computePeriod(L, { ...sep, label: "This month" }, aug);

  test("sales by order date (cancelled excluded)", () => {
    expect(out.sales).toEqual({ value: 2000, previous: 875, orders: 2 });
  });

  test("payment on an old order counts in the month received; legacy advance at order date", () => {
    expect(out.collected.value).toBe(300 + 200 + 50);
    expect(out.collected.previous).toBe(100);
    expect(out.collected.payments).toBe(2);
  });

  test("volume, top sizes, expenses by category", () => {
    expect(out.volume).toMatchObject({ kgSold: 20, kgFromKgLines: 20, kgFromPieces: 0, previousKgSold: 15 });
    expect(out.topSizes).toEqual([{ size: "14 x 18", kg: 20, pieces: 0 }]);
    expect(out.expenses).toEqual({ value: 420.5, previous: 80, byCategory: [{ name: "Raw Material", amount: 300 }, { name: "Ink", amount: 120.5 }] });
  });

  test("exclusions reported", () => {
    expect(out.excluded).toEqual({ cancelled: { count: 1, amount: 1000 }, deletedOrderPayments: { count: 1, amount: 70 } });
    expect(out.checks.ok).toBe(true);
  });

  test("all time has no comparison", () => {
    const all = m.computePeriod(L, { from: "2026-01-01", to: TODAY, label: "All time" }, null);
    expect(all.sales.previous).toBeNull();
    expect(all.volume.previousKgSold).toBeNull();
  });
});

describe("computeTrends", () => {
  test("six calendar months, current one partial", () => {
    const t = m.computeTrends(ledger([order({ id: "a", order_date: "2026-09-02", payments: [pay(1000, "2026-09-03")] })]), TODAY, 6);
    expect(t.months).toHaveLength(6);
    expect(t.months[5]).toEqual({ month: "2026-09", sales: 1000, collected: 1000, kgSold: 10, partial: false });
    expect(m.computeTrends(ledger([]), "2026-09-15", 6).months[5].partial).toBe(true);
    expect(t.months[0]).toEqual({ month: "2026-04", sales: 0, collected: 0, kgSold: 0, partial: false });
  });
});
```

(Note: 30 Sep is the month's last day, so September is complete → `partial: false`; on 15 Sep it's partial.)

- [ ] **Step 2: Run — expect FAIL**: `cd backend && npx cross-env NODE_ENV=test jest tests/dashboardMetrics.test.js`

- [ ] **Step 3: Implement** `backend/src/services/dashboard/metrics.js`:

```js
"use strict";

/**
 * Dashboard figures — spec §1. Pure functions over a ledger (see ledger.js).
 * Money is summed in integer paise so every total reconciles exactly; order
 * totals come only from orderMath (the same code as the Orders screen).
 */

const { orderTotal, paymentPosition, volumeSummary, lineKg } = require("../orderMath");
const { BANDS, agingBand, daysBetween, lastMonths, monthEnd } = require("./dateRanges");

const toPaise = (x) => Math.round(Number(x) * 100);
const rupees = (p) => p / 100;
const inRange = (d, r) => Boolean(d) && d >= r.from && d <= r.to;
const isCounted = (o) => o.status !== "CANCELLED";
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

/** Paise facts for one order. remaining = rounded total − received, so sums reconcile by construction. */
const orderFacts = (order) => {
  const total = orderTotal(order);
  const totalPaise = toPaise(total);
  const receivedPaise = toPaise(paymentPosition(order, total).totalReceived);
  return { totalPaise, receivedPaise, remainingPaise: totalPaise - receivedPaise };
};

const hasAdvanceRows = (order) => sum((order.payments || []).filter((p) => p.payment_type === "ADVANCE"), (p) => Number(p.amount)) > 0;

/** Money received for this order inside the range: dated payments + a legacy column-only advance at the order date. */
const receivedInRange = (order, range) => {
  let paise = sum((order.payments || []).filter((p) => inRange(p.payment_date, range)), (p) => toPaise(p.amount));
  if (!hasAdvanceRows(order) && Number(order.advance_received || 0) > 0 && inRange(order.order_date, range)) {
    paise += toPaise(order.advance_received);
  }
  return paise;
};

const reconcile = ({ salesPaise, receivedPaise, toCollectPaise, creditPaise, agingPaise, customersPaise }) => {
  const checks = {
    allTime: salesPaise - receivedPaise === toCollectPaise - creditPaise,
    agingSum: agingPaise.reduce((s, x) => s + x, 0) === toCollectPaise,
    customersSum: customersPaise.reduce((s, x) => s + x, 0) === toCollectPaise,
  };
  return { ok: checks.allTime && checks.agingSum && checks.customersSum, ...checks };
};

const computeOverview = ({ orders }, today) => {
  const counted = orders.filter(isCounted);
  const cancelled = orders.filter((o) => !isCounted(o));
  const bands = Object.fromEntries(BANDS.map((b) => [b, { paise: 0, orders: 0 }]));
  const customers = new Map();
  let salesPaise = 0;
  let receivedPaise = 0;
  let toCollectPaise = 0;
  let creditPaise = 0;
  let ordersOwing = 0;

  for (const o of counted) {
    const f = orderFacts(o);
    salesPaise += f.totalPaise;
    receivedPaise += f.receivedPaise;
    if (f.remainingPaise < 0) creditPaise += -f.remainingPaise;
    if (f.remainingPaise <= 0) continue;

    toCollectPaise += f.remainingPaise;
    ordersOwing += 1;
    const band = bands[agingBand(Math.max(0, daysBetween(o.order_date, today)))];
    band.paise += f.remainingPaise;
    band.orders += 1;

    const c = customers.get(o.customer_id) || { id: o.customer_id, name: o.customerName, phone: o.customerPhone || null, paise: 0, unpaid: [] };
    c.paise += f.remainingPaise;
    c.unpaid.push({ id: o.id, orderDate: o.order_date, remaining: rupees(f.remainingPaise) });
    customers.set(o.customer_id, c);
  }

  const list = [...customers.values()]
    .map((c) => {
      const unpaidOrders = [...c.unpaid].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
      const oldestOrderDate = unpaidOrders[0].orderDate;
      return { paise: c.paise, row: { id: c.id, name: c.name, phone: c.phone, amount: rupees(c.paise), orders: unpaidOrders.length, oldestOrderDate, oldestDays: Math.max(0, daysBetween(oldestOrderDate, today)), unpaidOrders } };
    })
    .sort((a, b) => b.row.oldestDays - a.row.oldestDays || b.paise - a.paise);

  const recentOrders = [...orders]
    .sort((a, b) => b.order_date.localeCompare(a.order_date) || new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map((o) => ({ id: o.id, customerName: o.customerName, orderDate: o.order_date, status: o.status, total: rupees(orderFacts(o).totalPaise) }));

  return {
    asOf: today,
    toCollect: rupees(toCollectPaise),
    credit: rupees(creditPaise),
    customersOwing: list.length,
    ordersOwing,
    aging: BANDS.map((b) => ({ band: b, amount: rupees(bands[b].paise), orders: bands[b].orders })),
    customers: list.map((x) => x.row),
    recentOrders,
    inProgress: orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length,
    excluded: { cancelled: { count: cancelled.length, amount: rupees(sum(cancelled, (o) => orderFacts(o).totalPaise)) } },
    checks: reconcile({
      salesPaise, receivedPaise, toCollectPaise, creditPaise,
      agingPaise: BANDS.map((b) => bands[b].paise), customersPaise: list.map((x) => x.paise),
    }),
  };
};

const periodFigures = ({ orders, expenses }, range) => {
  const counted = orders.filter(isCounted);
  const dated = counted.filter((o) => inRange(o.order_date, range));
  const exp = expenses.filter((e) => inRange(e.bill_date, range));
  return {
    dated,
    exp,
    salesPaise: sum(dated, (o) => orderFacts(o).totalPaise),
    collectedPaise: sum(counted, (o) => receivedInRange(o, range)),
    payments: sum(counted, (o) => (o.payments || []).filter((p) => inRange(p.payment_date, range)).length),
    volume: volumeSummary(dated),
    expensesPaise: sum(exp, (e) => toPaise(e.total_cost)),
  };
};

const computePeriod = (ledger, range, compare) => {
  const cur = periodFigures(ledger, range);
  const prev = compare ? periodFigures(ledger, compare) : null;

  const byCategory = new Map();
  for (const e of cur.exp) byCategory.set(e.categoryName, (byCategory.get(e.categoryName) || 0) + toPaise(e.total_cost));

  const sizes = new Map();
  for (const o of cur.dated) {
    for (const line of o.orderProductSizes || []) {
      const size = line.productSize?.size_label || "Unknown size";
      const s = sizes.get(size) || { size, kg: 0, pieces: 0 };
      const kg = lineKg(line);
      if (kg !== null) s.kg += kg;
      if (line.unit === "PIECES") s.pieces += Number(line.quantity_pieces);
      sizes.set(size, s);
    }
  }

  const cancelled = ledger.orders.filter((o) => !isCounted(o) && inRange(o.order_date, range));
  const deleted = ledger.deletedOrderPayments.filter((p) => inRange(p.payment_date, range));
  const categoriesPaise = [...byCategory.values()];

  return {
    range,
    compare,
    sales: { value: rupees(cur.salesPaise), previous: prev ? rupees(prev.salesPaise) : null, orders: cur.dated.length },
    collected: { value: rupees(cur.collectedPaise), previous: prev ? rupees(prev.collectedPaise) : null, payments: cur.payments },
    volume: { ...cur.volume, previousKgSold: prev ? prev.volume.kgSold : null },
    expenses: {
      value: rupees(cur.expensesPaise),
      previous: prev ? rupees(prev.expensesPaise) : null,
      byCategory: [...byCategory].map(([name, p]) => ({ name, amount: rupees(p) })).sort((a, b) => b.amount - a.amount),
    },
    topSizes: [...sizes.values()]
      .map((s) => ({ ...s, kg: Math.round(s.kg * 1000) / 1000 }))
      .sort((a, b) => b.kg - a.kg || b.pieces - a.pieces)
      .slice(0, 5),
    excluded: {
      cancelled: { count: cancelled.length, amount: rupees(sum(cancelled, (o) => orderFacts(o).totalPaise)) },
      deletedOrderPayments: { count: deleted.length, amount: rupees(sum(deleted, (p) => toPaise(p.amount))) },
    },
    checks: { ok: categoriesPaise.reduce((s, x) => s + x, 0) === cur.expensesPaise },
  };
};

const computeTrends = (ledger, today, months = 6) => ({
  months: lastMonths(today, months).map((month) => {
    const from = `${month}-01`;
    const end = monthEnd(from);
    const range = { from, to: end < today ? end : today };
    const f = periodFigures(ledger, range);
    return { month, sales: rupees(f.salesPaise), collected: rupees(f.collectedPaise), kgSold: f.volume.kgSold, partial: month === today.slice(0, 7) && today !== end };
  }),
});

module.exports = { toPaise, reconcile, computeOverview, computePeriod, computeTrends };
```

- [ ] **Step 4: Run — expect PASS**; full `npm test` green. **Step 5: commit**

```bash
git add backend/src/services/dashboard/metrics.js backend/tests/dashboardMetrics.test.js
git commit -m "feat(dashboard): paise-exact dues, period and trend metrics with reconciliation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ledger read, endpoints, integration tests

**Files:** Create `backend/src/services/dashboard/ledger.js`, `backend/src/controllers/dashboardController.js`, `backend/src/routes/dashboardRoutes.js`; Modify `backend/src/routes/index.js`; Test `backend/tests/dashboardController.test.js`

**Interfaces — Produces:** `loadLedger(models) → ledger` (shape in Task 2); `GET /api/dashboard/overview|period|trends` (200 with `data` = Task 2 outputs; 400 `PeriodError` message).

- [ ] **Step 1: Failing tests** — `backend/tests/dashboardController.test.js`:

```js
"use strict";

const fs = require("fs");
const path = require("path");
const db = require("../src/models");
const { overview, period, trends } = require("../src/controllers/dashboardController");
const { getAllOrders } = require("../src/controllers/orderController");
const { todayIST, addDays, monthStart } = require("../src/services/dashboard/dateRanges");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req = {}) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

const canonicalPending = () => {
  const md = fs.readFileSync(path.join(__dirname, "../knowledge/schema.md"), "utf8");
  return md.match(/<!-- canonical:pending -->([\s\S]*?)<!-- \/canonical:pending -->/)[1].trim();
};

describe("dashboard endpoints", () => {
  const today = todayIST();
  let alpha;
  let beta;

  beforeEach(async () => {
    alpha = await createCustomer("Alpha");
    beta = await createCustomer("Beta");
    const plate = await createPlateType("500.00");
    const size = await createSize({ rate_per_kg: "150.00" });
    const line = (kg) => ({ product_size_id: size.id, unit: "KG", quantity_kg: String(kg), rate_per_kg: "150.00" });

    const old = await createOrderWithLines({ customer: alpha, plateType: plate, order_date: addDays(today, -120), lines: [line(10)] }); // 2000
    const recent = await createOrderWithLines({ customer: alpha, plateType: plate, order_date: monthStart(today), lines: [line(4)] }); // 1100
    const paid = await createOrderWithLines({ customer: beta, plateType: plate, order_date: addDays(today, -40), lines: [line(2)] }); // 800
    await db.Payment.create({ order_id: old.id, customer_id: alpha.id, amount: "500.00", payment_type: "PARTIAL", payment_date: today });
    await db.Payment.create({ order_id: paid.id, customer_id: beta.id, amount: "800.00", payment_type: "FINAL", payment_date: addDays(today, -39) });
    void recent;

    const gone = await createOrderWithLines({ customer: beta, plateType: plate, order_date: today, lines: [line(1)] });
    await db.Payment.create({ order_id: gone.id, customer_id: beta.id, amount: "650.00", payment_type: "FINAL", payment_date: today });
    await gone.update({ is_archived: true });
  });

  test("overview reconciles with the Orders screen and Jarvis's pending query", async () => {
    const { status, body } = await call(overview);
    expect(status).toBe(200);
    const o = body.data;
    expect(o.checks.ok).toBe(true);

    const orders = (await call(getAllOrders)).body.data;
    const positive = orders.reduce((s, x) => s + Math.max(0, x.payment_summary.remaining_balance), 0);
    expect(o.toCollect).toBeCloseTo(positive, 2);
    expect(o.toCollect).toBe(1500 + 1100);

    const [rows] = await db.sequelize.query(canonicalPending());
    const sqlByName = Object.fromEntries(rows.map((r) => [r.name, Number(r.pending)]));
    for (const c of o.customers) expect(sqlByName[c.name]).toBeCloseTo(c.amount, 2);

    expect(o.customers[0]).toMatchObject({ name: "Alpha", orders: 2, oldestDays: 120 });
    expect(o.aging.find((b) => b.band === "90+").amount).toBe(1500);
  });

  test("period: this month counts the payment received today on an old order; deleted-order payment reported", async () => {
    const { status, body } = await call(period, { query: { preset: "this_month" } });
    expect(status).toBe(200);
    const p = body.data;
    expect(p.range).toEqual({ from: monthStart(today), to: today, label: "This month" });
    expect(p.collected.value).toBe(500 + (addDays(today, -39) >= monthStart(today) ? 800 : 0));
    expect(p.excluded.deletedOrderPayments).toEqual({ count: 1, amount: 650 });
    expect(p.sales.value).toBeGreaterThanOrEqual(1100);
  });

  test("period: bad input is a 400 with a clear message", async () => {
    const { status, body } = await call(period, { query: { preset: "custom", from: "2026-09-20", to: "2026-09-01" } });
    expect(status).toBe(400);
    expect(body.message).toMatch(/on or before/);
  });

  test("trends: six months ending this month", async () => {
    const { body } = await call(trends);
    expect(body.data.months).toHaveLength(6);
    expect(body.data.months[5].month).toBe(today.slice(0, 7));
  });

  test("all-time period matches overview (sales − collected = to collect − credit)", async () => {
    const o = (await call(overview)).body.data;
    const p = (await call(period, { query: { preset: "all" } })).body.data;
    expect(Math.round((p.sales.value - p.collected.value) * 100)).toBe(Math.round((o.toCollect - o.credit) * 100));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (controller missing).

- [ ] **Step 3: Implement**

`backend/src/services/dashboard/ledger.js`:

```js
"use strict";

/**
 * One read of everything the dashboard needs. Every include is required:false
 * so no order line is ever dropped because a size/customer/plate was archived.
 */
const loadLedger = async (models) => {
  const { Order, Customer, PlateType, OrderProductSize, ProductSize, Payment, Expense, ExpenseCategory } = models;

  const rows = await Order.findAll({
    where: { is_archived: false },
    attributes: ["id", "customer_id", "order_date", "created_at", "status", "custom_plate_charge", "round_off_amount", "advance_received"],
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "metadata"], required: false },
      { model: PlateType, as: "plateType", attributes: ["charge"], required: false },
      {
        model: OrderProductSize, as: "orderProductSizes", required: false,
        include: [{ model: ProductSize, as: "productSize", attributes: ["rate_per_kg", "size_label"], required: false }],
      },
      { model: Payment, as: "payments", attributes: ["amount", "payment_type", "payment_date"], required: false },
    ],
  });
  const orders = rows.map((r) => {
    const o = r.toJSON();
    return { ...o, customerName: o.customer?.name || "Unknown customer", customerPhone: o.customer?.metadata?.phone || null };
  });

  const deletedOrderPayments = await Payment.findAll({
    attributes: ["amount", "payment_date"],
    include: [{ model: Order, as: "order", attributes: [], where: { is_archived: true }, required: true }],
    raw: true,
  });

  const expenses = (
    await Expense.findAll({
      where: { is_archived: false },
      attributes: ["bill_date", "total_cost"],
      include: [{ model: ExpenseCategory, as: "category", attributes: ["name"], required: false }],
    })
  ).map((e) => {
    const x = e.toJSON();
    return { bill_date: x.bill_date, total_cost: x.total_cost, categoryName: x.category?.name || "Uncategorised" };
  });

  const dates = [
    ...orders.map((o) => o.order_date),
    ...orders.flatMap((o) => (o.payments || []).map((p) => p.payment_date)),
    ...expenses.map((e) => e.bill_date),
  ].filter(Boolean).sort();

  return { orders, deletedOrderPayments, expenses, earliest: dates[0] || null };
};

module.exports = { loadLedger };
```

`backend/src/controllers/dashboardController.js`:

```js
"use strict";

const models = require("../models");
const { success, error } = require("../utils/response");
const { loadLedger } = require("../services/dashboard/ledger");
const { computeOverview, computePeriod, computeTrends } = require("../services/dashboard/metrics");
const { todayIST, resolvePeriod, PeriodError } = require("../services/dashboard/dateRanges");

const overview = async (req, res) => {
  try {
    return success(res, 200, "Dashboard overview", computeOverview(await loadLedger(models), todayIST()));
  } catch (err) {
    console.error("Error loading dashboard overview:", err);
    return error(res, 500, "Failed to load dashboard", err.message);
  }
};

const period = async (req, res) => {
  try {
    const today = todayIST();
    const ledger = await loadLedger(models);
    const { range, compare } = resolvePeriod(req.query, today, ledger.earliest);
    return success(res, 200, "Dashboard period", computePeriod(ledger, range, compare));
  } catch (err) {
    if (err instanceof PeriodError) return error(res, 400, err.message);
    console.error("Error loading dashboard period:", err);
    return error(res, 500, "Failed to load dashboard", err.message);
  }
};

const trends = async (req, res) => {
  try {
    return success(res, 200, "Dashboard trends", computeTrends(await loadLedger(models), todayIST(), 6));
  } catch (err) {
    console.error("Error loading dashboard trends:", err);
    return error(res, 500, "Failed to load dashboard", err.message);
  }
};

module.exports = { overview, period, trends };
```

`backend/src/routes/dashboardRoutes.js`:

```js
"use strict";

const express = require("express");
const { overview, period, trends } = require("../controllers/dashboardController");

const router = express.Router();
router.get("/overview", overview);
router.get("/period", period);
router.get("/trends", trends);

module.exports = router;
```

`backend/src/routes/index.js`: add `const dashboardRoutes = require("./dashboardRoutes");` with the other requires, and `router.use("/dashboard", dashboardRoutes);` after `router.use(authMiddleware);` (next to the other mounts).

- [ ] **Step 4: Run — expect PASS**; full suite green. **Step 5: commit**

```bash
git add backend/src/services/dashboard/ledger.js backend/src/controllers/dashboardController.js backend/src/routes/dashboardRoutes.js backend/src/routes/index.js backend/tests/dashboardController.test.js
git commit -m "feat(dashboard): overview, period and trends endpoints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Read-only production verification script

**Files:** Create `backend/scripts/dashboard-verify.js`; Test `backend/tests/dashboardVerify.test.js`

**Interfaces — Produces:** `verifyDashboard(sequelize, models, today) → { ok, problems:string[], summary }`. CLI prints the summary and exits 1 on problems.

Independent checks (plain SQL, not metrics.js): canonical pending query per customer (from `schema.md`, with cancelled orders filtered out by wrapping) vs `customers[]`; Σ payments on live non-cancelled orders vs all-time Collected; Σ expenses vs all-time expenses; `checks.ok`.

- [ ] **Step 1: Failing test** — `backend/tests/dashboardVerify.test.js`:

```js
"use strict";

const db = require("../src/models");
const { verifyDashboard } = require("../scripts/dashboard-verify");
const { todayIST, addDays } = require("../src/services/dashboard/dateRanges");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

test("verification agrees with independent SQL on consistent data", async () => {
  const today = todayIST();
  const c = await createCustomer("Gamma");
  const plate = await createPlateType("100.00");
  const size = await createSize({ rate_per_kg: "50.00" });
  const o = await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, -10), lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "3.00", rate_per_kg: "50.00" }] });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "100.00", payment_type: "PARTIAL", payment_date: today });

  const result = await verifyDashboard(db.sequelize, db, today);
  expect(result.problems).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.summary.toCollect).toBe(150);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `backend/scripts/dashboard-verify.js`:

```js
#!/usr/bin/env node
"use strict";

/**
 * READ-ONLY cross-check of the dashboard maths against independent SQL.
 *   NODE_ENV=production node scripts/dashboard-verify.js
 * Exit 1 if anything disagrees. Run before every dashboard release.
 */

const fs = require("fs");
const path = require("path");
const { loadLedger } = require("../src/services/dashboard/ledger");
const { computeOverview, computePeriod } = require("../src/services/dashboard/metrics");
const { resolvePeriod, todayIST } = require("../src/services/dashboard/dateRanges");

const paise = (x) => Math.round(Number(x) * 100);

const canonicalPending = () => {
  const md = fs.readFileSync(path.join(__dirname, "../knowledge/schema.md"), "utf8");
  return md.match(/<!-- canonical:pending -->([\s\S]*?)<!-- \/canonical:pending -->/)[1].trim();
};

const verifyDashboard = async (sequelize, models, today = todayIST()) => {
  const q = (sql) => sequelize.query(sql).then(([rows]) => rows);
  const ledger = await loadLedger(models);
  const overview = computeOverview(ledger, today);
  const { range, compare } = resolvePeriod({ preset: "all" }, today, ledger.earliest);
  const all = computePeriod(ledger, range, compare);
  const problems = [];

  if (!overview.checks.ok) problems.push(`overview checks failed: ${JSON.stringify(overview.checks)}`);

  // Jarvis's canonical per-customer pending (includes cancelled orders, so only compare when none exist).
  if (overview.excluded.cancelled.count === 0) {
    const sql = Object.fromEntries((await q(canonicalPending())).map((r) => [r.name, paise(r.pending)]));
    const app = {};
    for (const c of overview.customers) app[c.name] = (app[c.name] || 0) + paise(c.amount);
    for (const name of new Set([...Object.keys(sql), ...Object.keys(app)])) {
      if ((sql[name] || 0) !== (app[name] || 0)) problems.push(`customer "${name}": SQL ₹${(sql[name] || 0) / 100} vs dashboard ₹${(app[name] || 0) / 100}`);
    }
  }

  const [{ collected }] = await q(`SELECT COALESCE(SUM(p.amount),0) AS collected FROM payments p JOIN orders o ON o.id = p.order_id
                                   WHERE NOT o.is_archived AND o.status <> 'CANCELLED'`);
  const [{ legacy }] = await q(`SELECT COALESCE(SUM(o.advance_received),0) AS legacy FROM orders o
                                WHERE NOT o.is_archived AND o.status <> 'CANCELLED' AND COALESCE(o.advance_received,0) > 0
                                  AND COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE'),0) = 0`);
  if (paise(collected) + paise(legacy) !== paise(all.collected.value)) problems.push(`all-time collected: SQL ₹${Number(collected) + Number(legacy)} vs dashboard ₹${all.collected.value}`);

  const [{ spent }] = await q(`SELECT COALESCE(SUM(total_cost),0) AS spent FROM expenses WHERE NOT is_archived`);
  if (paise(spent) !== paise(all.expenses.value)) problems.push(`all-time expenses: SQL ₹${spent} vs dashboard ₹${all.expenses.value}`);

  if (paise(all.sales.value) - paise(all.collected.value) !== paise(overview.toCollect) - paise(overview.credit)) {
    problems.push("sales − collected ≠ to collect − credit");
  }

  return {
    ok: problems.length === 0,
    problems,
    summary: { asOf: today, sales: all.sales.value, collected: all.collected.value, toCollect: overview.toCollect, credit: overview.credit,
               customersOwing: overview.customersOwing, aging: overview.aging, expenses: all.expenses.value },
  };
};

if (require.main === module) {
  const models = require("../src/models");
  verifyDashboard(models.sequelize, models)
    .then((r) => {
      console.log(JSON.stringify(r.summary, null, 2));
      if (r.ok) console.log("✅ Dashboard figures agree with independent SQL.");
      else console.error(`❌ ${r.problems.length} problem(s):\n${r.problems.join("\n")}`);
      return models.sequelize.close().then(() => process.exit(r.ok ? 0 : 1));
    })
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { verifyDashboard };
```

- [ ] **Step 4: Run — expect PASS.** **Step 5: commit**

```bash
git add backend/scripts/dashboard-verify.js backend/tests/dashboardVerify.test.js
git commit -m "chore(dashboard): read-only verification against independent SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Theme tokens, dark default, fonts, Motion

**Files:** Modify `frontend/package.json`, `frontend/index.html`, `frontend/tailwind.config.js`, `frontend/src/assets/styles/index.css`, `frontend/src/components/theme/ThemeProvider.jsx`

- [ ] **Step 1: Install Motion** — `cd frontend && npm install motion@^13.4.6`; check `git diff --stat package-lock.json` shows only motion's tree.

- [ ] **Step 2: Sora font** — in `index.html` change the Google Fonts `href` family list to add `&family=Sora:wght@500;600;700` before `&display=swap`.

- [ ] **Step 3: Tokens** — append to `src/assets/styles/index.css`:

```css
/* Midnight Forest & Brass — RGB channels so Tailwind alpha works. Validated 2026-09-30. */
@layer base {
  :root {
    --c-canvas: 244 247 245; --c-surface: 255 255 255; --c-raised: 238 243 240; --c-line: 221 230 225;
    --c-ink: 16 32 26; --c-ink-2: 85 112 106; --c-brass: 138 106 31; --c-on-brass: 255 255 255;
    --c-good: 31 138 95; --c-warn: 183 134 11; --c-serious: 196 97 28; --c-critical: 210 59 49;
    --c-sales: 154 116 38; --c-collected: 47 120 208; --c-kg: 107 95 208; --c-expense: 102 112 138;
  }
  .dark {
    --c-canvas: 6 17 13; --c-surface: 14 31 25; --c-raised: 18 49 38; --c-line: 23 50 41;
    --c-ink: 234 246 240; --c-ink-2: 147 179 165; --c-brass: 217 178 95; --c-on-brass: 28 22 6;
    --c-good: 55 201 143; --c-warn: 240 194 72; --c-serious: 240 138 69; --c-critical: 255 106 94;
    --c-sales: 173 135 51; --c-collected: 74 144 226; --c-kg: 133 124 224; --c-expense: 138 147 168;
  }
}
```

- [ ] **Step 4: Tailwind mapping** — in `tailwind.config.js` `theme.extend`:

```js
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        num: ['Sora', 'system-ui', 'sans-serif'],
      },
```
and inside `colors` add:
```js
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        raised: "rgb(var(--c-raised) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", 2: "rgb(var(--c-ink-2) / <alpha-value>)" },
        brass: { DEFAULT: "rgb(var(--c-brass) / <alpha-value>)", on: "rgb(var(--c-on-brass) / <alpha-value>)" },
        status: {
          good: "rgb(var(--c-good) / <alpha-value>)", warn: "rgb(var(--c-warn) / <alpha-value>)",
          serious: "rgb(var(--c-serious) / <alpha-value>)", critical: "rgb(var(--c-critical) / <alpha-value>)",
        },
        chart: {
          sales: "rgb(var(--c-sales) / <alpha-value>)", collected: "rgb(var(--c-collected) / <alpha-value>)",
          kg: "rgb(var(--c-kg) / <alpha-value>)", expense: "rgb(var(--c-expense) / <alpha-value>)",
        },
```

- [ ] **Step 5: Dark by default** — in `ThemeProvider.jsx` replace the initial-state function body with:

```jsx
    // Stored choice wins; otherwise the app opens in dark mode (Midnight Forest).
    try {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
    } catch {
      /* storage unavailable — fall through */
    }
    return 'dark';
```
and wrap the `localStorage.setItem` in the effect in `try { … } catch { /* ignore */ }`.

- [ ] **Step 6: Validate the chart/status palettes (both modes)** using the dataviz validator (`node <dataviz>/scripts/validate_palette.js`):
  - `"#ad8733,#4a90e2" --mode dark --surface "#0e1f19"` → ALL PASS
  - `"#9a7426,#2f78d0" --mode light --surface "#ffffff"` → ALL PASS
  - Contrast lines PASS for `"#857ce0,#8a93a8"` (dark) and `"#6b5fd0,#66708a"` (light); status sets PASS contrast in both.
  Paste the result lines into the commit message body.

- [ ] **Step 7: Build + lint** — `npx vite build`; `npx eslint src/components/theme/ThemeProvider.jsx tailwind.config.js`. **Commit:**

```bash
git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/tailwind.config.js frontend/src/assets/styles/index.css frontend/src/components/theme/ThemeProvider.jsx
git commit -m "feat(theme): Midnight Forest & Brass tokens, dark by default, Sora, Motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend helpers (formatting, phone, WhatsApp, prefs, dues filter, latest-only)

**Files:** Create `frontend/src/utils/dashboardFormat.js`, `phone.js`, `whatsappReminder.js`, `periodPrefs.js`, `duesFilter.js`, `latestOnly.js`, `frontend/src/services/dashboardAPI.js`; Test `frontend/src/utils/dashboardHelpers.test.js`

**Interfaces — Produces:** `inr(n)`, `axisInr(n)`, `kgText(n)`, `delta(cur, prev) → {text, dir}|null`, `shortDate(d)`, `monthLabel(ym)`, `rangeText({from,to})`; `toIndianMobile(raw)`, `telHref(raw)`, `whatsappHref(raw, text)`; `buildReminder({name, amount, unpaidOrders})`; `loadPeriod()`, `savePeriod(p)`; `ageBandOf(orderDate, asOf)`, `filterByBand(customers, band, asOf)`; `latestOnly()` → wrap(promise) resolving only for the newest call; `dashboardAPI.{overview,period,trends}`.

- [ ] **Step 1: Failing tests** — `frontend/src/utils/dashboardHelpers.test.js`:

```js
import { describe, test, expect, vi } from "vitest";
import { inr, axisInr, kgText, delta, shortDate, monthLabel } from "./dashboardFormat";
import { toIndianMobile, telHref, whatsappHref } from "./phone";
import { buildReminder } from "./whatsappReminder";
import { loadPeriod, savePeriod } from "./periodPrefs";
import { ageBandOf, filterByBand } from "./duesFilter";
import { latestOnly } from "./latestOnly";

describe("format", () => {
  test("exact rupees in Indian grouping", () => {
    expect(inr(233320)).toBe("₹2,33,320");
    expect(inr(1006.01)).toBe("₹1,006.01");
    expect(inr(0)).toBe("₹0");
  });
  test("axis labels only are compact", () => {
    expect(axisInr(100000)).toBe("₹1L");
    expect(axisInr(250000)).toBe("₹2.5L");
    expect(axisInr(50000)).toBe("₹50k");
  });
  test("kg and dates", () => {
    expect(kgText(558)).toBe("558 kg");
    expect(kgText(62.5)).toBe("62.5 kg");
    expect(shortDate("2026-02-28")).toBe("28 Feb 2026");
    expect(monthLabel("2026-03")).toBe("Mar");
  });
  test("delta", () => {
    expect(delta(164850, 82640)).toEqual({ text: "▲ 99%", dir: "up" });
    expect(delta(50, 100)).toEqual({ text: "▼ 50%", dir: "down" });
    expect(delta(100, 0)).toEqual({ text: "new", dir: "up" });
    expect(delta(0, 0)).toEqual({ text: "no change", dir: "flat" });
    expect(delta(100, null)).toBeNull();
  });
});

describe("phone", () => {
  test.each([["09876543210", "9876543210"], ["9876543210", "9876543210"], ["+91 98765 43210", "9876543210"], ["919876543210", "9876543210"]])(
    "%s → %s", (raw, out) => expect(toIndianMobile(raw)).toBe(out));
  test("invalid numbers give null (buttons hidden)", () => {
    for (const raw of [null, "", "08482-234567", "12345", "5876543210", "0987654321"]) {
      expect(toIndianMobile(raw)).toBeNull();
      expect(telHref(raw)).toBeNull();
      expect(whatsappHref(raw, "hi")).toBeNull();
    }
  });
  test("links", () => {
    expect(telHref("09876543210")).toBe("tel:+919876543210");
    expect(whatsappHref("09876543210", "a b")).toBe("https://wa.me/919876543210?text=a%20b");
  });
});

describe("WhatsApp reminder", () => {
  test("lists unpaid orders with exact amounts", () => {
    expect(buildReminder({ name: "Sri Balaji Traders", amount: 32700, unpaidOrders: [
      { orderDate: "2026-02-28", remaining: 18000 }, { orderDate: "2026-03-12", remaining: 14700 },
    ] })).toBe([
      "Namaste Sri Balaji Traders, this is a gentle reminder from YARS Industries.",
      "Pending balance: ₹32,700",
      "• Order of 28 Feb 2026 — ₹18,000",
      "• Order of 12 Mar 2026 — ₹14,700",
      "Kindly arrange the payment at your convenience. Thank you!",
    ].join("\n"));
  });
  test("caps the list at 10 orders", () => {
    const orders = Array.from({ length: 12 }, (_, i) => ({ orderDate: `2026-01-${String(i + 1).padStart(2, "0")}`, remaining: 1 }));
    expect(buildReminder({ name: "X", amount: 12, unpaidOrders: orders })).toMatch(/…and 2 more orders/);
  });
});

describe("period prefs", () => {
  test("defaults to all time and survives missing storage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadPeriod()).toEqual({ preset: "all" });
    expect(() => savePeriod({ preset: "this_month" })).not.toThrow();
    const store = {};
    vi.stubGlobal("localStorage", { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });
    savePeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-10" });
    expect(loadPeriod()).toEqual({ preset: "custom", from: "2026-09-01", to: "2026-09-10" });
    vi.unstubAllGlobals();
  });
});

describe("dues filter", () => {
  const asOf = "2026-09-30";
  test.each([["2026-08-31", "0-30"], ["2026-08-30", "31-60"], ["2026-07-02", "61-90"], ["2026-07-01", "90+"]])(
    "%s → %s", (d, band) => expect(ageBandOf(d, asOf)).toBe(band));
  test("keeps only the band's orders and re-sums", () => {
    const customers = [{ id: "a", amount: 1600, unpaidOrders: [{ orderDate: "2026-05-01", remaining: 1000 }, { orderDate: "2026-09-20", remaining: 600 }] }];
    expect(filterByBand(customers, "90+", asOf)).toEqual([{ id: "a", amount: 1000, orders: 1, unpaidOrders: [{ orderDate: "2026-05-01", remaining: 1000 }] }]);
    expect(filterByBand(customers, "31-60", asOf)).toEqual([]);
    expect(filterByBand(customers, "all", asOf)).toBe(customers);
  });
});

describe("latestOnly", () => {
  test("a slow older response never overwrites a newer one", async () => {
    const latest = latestOnly();
    let resolveSlow;
    const slow = latest(new Promise((r) => { resolveSlow = r; }));
    const fast = latest(Promise.resolve("new"));
    await expect(fast).resolves.toBe("new");
    resolveSlow("old");
    await expect(slow).resolves.toBe(latestOnly.STALE);
  });
});
```

(`ageBandOf` table: 30 days → 0-30, 31 → 31-60, 90 → 61-90, 91 → 90+.)

- [ ] **Step 2: Run — expect FAIL** (`cd frontend && npm test`).

- [ ] **Step 3: Implement**

`src/utils/dashboardFormat.js`:
```js
const exact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const one = (x) => String(Math.round(x * 10) / 10);

/** Exact rupees — the only format used for figures. */
export const inr = (n) => `₹${exact.format(Number(n))}`;
/** Compact rupees for chart axis ticks only (figures always use inr). */
export const axisInr = (n) => {
  const v = Number(n);
  if (Math.abs(v) >= 1e7) return `₹${one(v / 1e7)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${one(v / 1e5)}L`;
  if (Math.abs(v) >= 1e3) return `₹${one(v / 1e3)}k`;
  return inr(v);
};
export const kgText = (n) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(Number(n))} kg`;
export const delta = (cur, prev) => {
  if (prev === null || prev === undefined) return null;
  if (Number(prev) === 0) return Number(cur) === 0 ? { text: "no change", dir: "flat" } : { text: "new", dir: "up" };
  const pct = Math.round(((Number(cur) - Number(prev)) / Number(prev)) * 100);
  if (pct === 0) return { text: "no change", dir: "flat" };
  return { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`, dir: pct > 0 ? "up" : "down" };
};
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const shortDate = (d) => dateFmt.format(new Date(`${d}T00:00:00Z`));
export const monthLabel = (ym) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));
export const rangeText = ({ from, to }) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);
```
(Indian short month names: September prints as "Sept", matching the rest of the app. Tests use Feb/Mar.)

`src/utils/phone.js`:
```js
/** Stored numbers are never changed; links are built from a normalised copy. */
export const toIndianMobile = (raw) => {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};
export const telHref = (raw) => {
  const m = toIndianMobile(raw);
  return m ? `tel:+91${m}` : null;
};
export const whatsappHref = (raw, text) => {
  const m = toIndianMobile(raw);
  return m ? `https://wa.me/91${m}?text=${encodeURIComponent(text)}` : null;
};
```

`src/utils/whatsappReminder.js`:
```js
import { inr, shortDate } from "./dashboardFormat";

const MAX_ORDERS = 10;

export const buildReminder = ({ name, amount, unpaidOrders }) => {
  const lines = [`Namaste ${name}, this is a gentle reminder from YARS Industries.`, `Pending balance: ${inr(amount)}`];
  for (const o of unpaidOrders.slice(0, MAX_ORDERS)) lines.push(`• Order of ${shortDate(o.orderDate)} — ${inr(o.remaining)}`);
  if (unpaidOrders.length > MAX_ORDERS) lines.push(`…and ${unpaidOrders.length - MAX_ORDERS} more orders`);
  lines.push("Kindly arrange the payment at your convenience. Thank you!");
  return lines.join("\n");
};
```

`src/utils/periodPrefs.js`:
```js
const KEY = "yars_dashboard_period";
const PRESETS = ["all", "this_month", "last_month", "this_fy", "custom"];

export const loadPeriod = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && PRESETS.includes(v.preset)) return v;
  } catch {
    /* unavailable or corrupt — use the default */
  }
  return { preset: "all" };
};
export const savePeriod = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
};
```

`src/utils/duesFilter.js`:
```js
const DAY = 86400000;
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export const ageBandOf = (orderDate, asOf) => {
  const d = Math.max(0, days(orderDate, asOf));
  return d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
};

/** Customers with unpaid orders in `band`, amounts re-summed in paise from those orders only. */
export const filterByBand = (customers, band, asOf) => {
  if (band === "all") return customers;
  return customers
    .map((c) => {
      const unpaidOrders = c.unpaidOrders.filter((o) => ageBandOf(o.orderDate, asOf) === band);
      const paise = unpaidOrders.reduce((s, o) => s + Math.round(o.remaining * 100), 0);
      return { ...c, amount: paise / 100, orders: unpaidOrders.length, unpaidOrders };
    })
    .filter((c) => c.orders > 0);
};
```
(Adjust the test's expected object to include every field of the input customer — `{ id, amount, orders, unpaidOrders }` — which it does.)

`src/utils/latestOnly.js`:
```js
const STALE = Symbol("stale");

/** Wrap promises so only the most recent call's result is used (period switching). */
export const latestOnly = () => {
  let seq = 0;
  return (promise) => {
    const mine = ++seq;
    return promise.then((v) => (mine === seq ? v : STALE));
  };
};
latestOnly.STALE = STALE;
```

`src/services/dashboardAPI.js`:
```js
import api from "./api";

export const dashboardAPI = {
  overview: () => api.get("/dashboard/overview"),
  period: (params) => api.get("/dashboard/period", { params }),
  trends: () => api.get("/dashboard/trends"),
};
```

- [ ] **Step 4: Run — expect PASS**; lint the new files. **Step 5: commit**

```bash
git add frontend/src/utils/dashboardFormat.js frontend/src/utils/phone.js frontend/src/utils/whatsappReminder.js frontend/src/utils/periodPrefs.js frontend/src/utils/duesFilter.js frontend/src/utils/latestOnly.js frontend/src/utils/dashboardHelpers.test.js frontend/src/services/dashboardAPI.js
git commit -m "feat(dashboard-ui): formatting, phone links, WhatsApp reminder, period prefs, dues filter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hero, customer rows, info sheet, states

**Files:** Create `frontend/src/components/dashboard/AnimatedNumber.jsx`, `InfoSheet.jsx`, `definitions.js`, `HeroDues.jsx`, `CustomerRow.jsx`, `CollectList.jsx`, `DashboardStates.jsx`

- [ ] **Step 1: `AnimatedNumber.jsx`** — counts from the previous value; the **final frame is always the exact value**:

```jsx
import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { animate, useReducedMotion } from "motion/react";

export default function AnimatedNumber({ value, format, duration = 0.9, className = "" }) {
  const ref = useRef(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const target = Number(value);
    if (reduce || from.current === target) {
      el.textContent = format(target);
      from.current = target;
      return undefined;
    }
    const controls = animate(from.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = format(Math.round(v * 100) / 100); },
      onComplete: () => { el.textContent = format(target); },
    });
    from.current = target;
    return () => { controls.stop(); el.textContent = format(target); };
  }, [value, format, duration, reduce]);

  return <span ref={ref} className={`font-num tabular-nums ${className}`} aria-label={format(value)}>{format(value)}</span>;
}

AnimatedNumber.propTypes = { value: PropTypes.number.isRequired, format: PropTypes.func.isRequired, duration: PropTypes.number, className: PropTypes.string };
```

- [ ] **Step 2: `InfoSheet.jsx`** — bottom sheet (dialog semantics, Esc/backdrop close, focus the close button):

```jsx
import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "motion/react";

export default function InfoSheet({ open, title, onClose, children }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-surface text-ink p-5 pb-8 shadow-2xl"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-num text-lg font-semibold">{title}</h2>
              <button ref={closeRef} type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-ink-2 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">Close</button>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

InfoSheet.propTypes = { open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired, children: PropTypes.node };
```

- [ ] **Step 3: `definitions.js`** — exact wording from spec §1 (keys: `toCollect`, `sales`, `collected`, `kg`, `expenses`):

```js
export const DEFINITIONS = {
  toCollect: { title: "To collect", body: ["Everything customers still owe today, across all orders: each order's total minus what has been received (the advance is counted once).", "The age bands group the same amounts by how old the order is, and always add up to this total.", "Orders marked Cancelled and deleted orders are not included."] },
  sales: { title: "Sales", body: ["Total value of orders dated in the selected period — the same order totals as the Orders screen.", "Cancelled and deleted orders are not included."] },
  collected: { title: "Collected", body: ["Money received in the selected period (by payment date), including payments on older orders.", "Payments on deleted orders are not included."] },
  kg: { title: "Kg sold", body: ["Kg from orders taken in kg, plus estimated kg (≈) for orders taken in pieces whose size has a weight. Each order line is counted once.", "Pieces without a weight are listed separately and are not in the kg."] },
  expenses: { title: "Expenses", body: ["Bills dated in the selected period, from the Expenses screen.", "Shown on its own, not as profit: large raw-material purchases are used over many months."] },
};
```

- [ ] **Step 4: `HeroDues.jsx`** — hero card, aging bar (bands fill in order), band tap → `onBand(band)`, ⓘ → `onInfo()`:

```jsx
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
```

- [ ] **Step 5: `CustomerRow.jsx`**:

```jsx
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { inr } from "../../utils/dashboardFormat";
import { telHref, whatsappHref } from "../../utils/phone";
import { buildReminder } from "../../utils/whatsappReminder";

const PhoneIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></svg>);
const ChatIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-4-1.1z" /></svg>);

export default function CustomerRow({ customer, index = 0 }) {
  const call = telHref(customer.phone);
  const wa = whatsappHref(customer.phone, buildReminder(customer));
  const old = customer.oldestDays > 90;
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 + index * 0.06, duration: 0.4 }}
      className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
      <Link to={`/customers/${customer.id}`} className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
        <p className="truncate text-sm font-semibold text-ink">{customer.name}</p>
        <p className="text-xs text-ink-2">
          <span className={old ? "font-semibold text-status-critical" : ""}>{customer.oldestDays} days</span> · {customer.orders} order{customer.orders === 1 ? "" : "s"}
        </p>
      </Link>
      <span className="font-num text-[0.95rem] font-bold tabular-nums text-ink">{inr(customer.amount)}</span>
      {call && <a href={call} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-brass" aria-label={`Call ${customer.name}`}><PhoneIcon /></a>}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-raised text-status-good" aria-label={`WhatsApp reminder to ${customer.name}`}><ChatIcon /></a>}
    </motion.li>
  );
}

CustomerRow.propTypes = { customer: PropTypes.object.isRequired, index: PropTypes.number };
```

- [ ] **Step 6: `CollectList.jsx`**:

```jsx
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import CustomerRow from "./CustomerRow";

export default function CollectList({ customers, limit = 5 }) {
  if (customers.length === 0) {
    return <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">✓ Nothing to collect — all customers are paid up.</p>;
  }
  return (
    <section aria-labelledby="collect-from">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-4">
        <h2 id="collect-from" className="text-sm font-bold text-ink">Collect from</h2>
        <span className="text-xs text-ink-2">oldest first</span>
      </div>
      <ul className="space-y-2">{customers.slice(0, limit).map((c, i) => <CustomerRow key={c.id} customer={c} index={i} />)}</ul>
      {customers.length > limit && (
        <Link to="/dues" className="mt-2 block rounded-xl py-2 text-center text-sm font-semibold text-brass">See all {customers.length} customers</Link>
      )}
    </section>
  );
}

CollectList.propTypes = { customers: PropTypes.array.isRequired, limit: PropTypes.number };
```

- [ ] **Step 7: `DashboardStates.jsx`** — `Skeleton`, `LoadError({onRetry})`, `ChecksFailed()`:

```jsx
import PropTypes from "prop-types";

export const Skeleton = () => (
  <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-44 rounded-3xl bg-surface" />
    {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-surface" />)}
    <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface" />)}</div>
  </div>
);

export const LoadError = ({ onRetry }) => (
  <div className="rounded-2xl bg-surface p-5 text-sm text-ink" role="alert">
    <p className="font-semibold">Couldn&apos;t load the dashboard.</p>
    <p className="mt-1 text-ink-2">Check your connection and try again.</p>
    <button type="button" onClick={onRetry} className="mt-3 rounded-xl bg-brass px-4 py-2 font-semibold text-brass-on">Try again</button>
  </div>
);
LoadError.propTypes = { onRetry: PropTypes.func.isRequired };

export const ChecksFailed = () => (
  <div className="rounded-2xl border border-status-critical/60 bg-status-critical/10 p-5 text-sm text-ink" role="alert">
    <p className="font-semibold text-status-critical">These figures don&apos;t add up — not showing them until this is fixed.</p>
    <p className="mt-1 text-ink-2">Nothing in your data has changed. Please report this so it can be checked.</p>
  </div>
);
```

- [ ] **Step 8: Lint + build**, then **commit**:

```bash
git add frontend/src/components/dashboard/AnimatedNumber.jsx frontend/src/components/dashboard/InfoSheet.jsx frontend/src/components/dashboard/definitions.js frontend/src/components/dashboard/HeroDues.jsx frontend/src/components/dashboard/CustomerRow.jsx frontend/src/components/dashboard/CollectList.jsx frontend/src/components/dashboard/DashboardStates.jsx
git commit -m "feat(dashboard-ui): dues hero, collect-from rows with call/WhatsApp, info sheet, states

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Period bar and number tiles

**Files:** Create `frontend/src/components/dashboard/PeriodBar.jsx`, `KpiGrid.jsx`

- [ ] **Step 1: `PeriodBar.jsx`** — sticky chips; Custom opens a sheet with two date inputs (validated from ≤ to):

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import InfoSheet from "./InfoSheet";

const CHIPS = [["all", "All time"], ["this_month", "This month"], ["last_month", "Last month"], ["this_fy", "This FY"], ["custom", "Custom…"]];

export default function PeriodBar({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from || "");
  const [to, setTo] = useState(value.to || "");
  const invalid = !from || !to || from > to;

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
        {from && to && from > to && <p className="text-status-critical">From date must be on or before To date.</p>}
        <button type="button" disabled={invalid} onClick={() => { onChange({ preset: "custom", from, to }); setOpen(false); }}
          className="mt-2 w-full rounded-xl bg-brass py-2.5 font-semibold text-brass-on disabled:opacity-40">Show this period</button>
      </InfoSheet>
    </div>
  );
}

PeriodBar.propTypes = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
```

- [ ] **Step 2: `KpiGrid.jsx`** — four tiles, animated numbers, comparison badges (expenses neutral), ⓘ per tile, pieces line:

```jsx
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
```

- [ ] **Step 3: Lint + build; commit**

```bash
git add frontend/src/components/dashboard/PeriodBar.jsx frontend/src/components/dashboard/KpiGrid.jsx
git commit -m "feat(dashboard-ui): sticky period bar with custom range and number tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Charts

**Files:** Create `frontend/src/components/dashboard/BarChart.jsx`, `SalesCollectedChart.jsx`, `KgChart.jsx`, `ExpenseCategories.jsx`

Chart rules (dataviz): one axis; thin bars with 4px rounded tops anchored to the baseline; 2px gap between grouped bars; recessive grid (one mid line + label); legend for ≥ 2 series, direct label on the latest month; tap/hover tooltip with exact values; bars grow from the baseline once when scrolled into view; reduced motion → static.

- [ ] **Step 1: `BarChart.jsx`** — generic grouped bars:

```jsx
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

export default function BarChart({ months, series, format, title }) {
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
        <text x="2" y={BASE - scale(mid) - 4} className="fill-ink-2" fontSize="9">{axisInr(mid)}</text>
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
};
```
The figcaption doubles as the always-visible tooltip/table value for the selected month (identity never colour-only; exact values always readable).

- [ ] **Step 2: `SalesCollectedChart.jsx`**:

```jsx
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
```

- [ ] **Step 3: `KgChart.jsx`** — 6-month kg bars + the period's top sizes:

```jsx
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
```

- [ ] **Step 4: `ExpenseCategories.jsx`** — top 4 + expandable rest; empty state:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { inr } from "../../utils/dashboardFormat";

export default function ExpenseCategories({ categories }) {
  const [all, setAll] = useState(false);
  const shown = all ? categories : categories.slice(0, 4);
  const max = Math.max(1, ...categories.map((c) => c.amount));
  return (
    <section aria-labelledby="expense-cats">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-5"><h2 id="expense-cats" className="text-sm font-bold text-ink">Expenses by category</h2><span className="text-xs text-ink-2">selected period</span></div>
      <div className="rounded-2xl bg-surface p-3.5">
        {categories.length === 0 ? <p className="text-sm text-ink-2">No expenses in this period.</p> : shown.map((c) => (
          <div key={c.name} className="my-1.5 flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-ink-2">{c.name}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-chart-expense" style={{ width: `${(c.amount / max) * 100}%` }} /></span>
            <span className="w-20 text-right font-semibold tabular-nums text-ink">{inr(c.amount)}</span>
          </div>
        ))}
        {categories.length > 4 && (
          <button type="button" onClick={() => setAll(!all)} className="mt-1 text-xs font-semibold text-brass">{all ? "Show fewer" : `+${categories.length - 4} more`}</button>
        )}
      </div>
    </section>
  );
}
ExpenseCategories.propTypes = { categories: PropTypes.array.isRequired };
```

- [ ] **Step 5: Lint + build; commit**

```bash
git add frontend/src/components/dashboard/BarChart.jsx frontend/src/components/dashboard/SalesCollectedChart.jsx frontend/src/components/dashboard/KgChart.jsx frontend/src/components/dashboard/ExpenseCategories.jsx
git commit -m "feat(dashboard-ui): SVG trend charts with grow-in, exact-value captions, category bars

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Assemble the Dashboard page

**Files:** Create `frontend/src/components/dashboard/RecentOrders.jsx`; Rewrite `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: `RecentOrders.jsx`**:

```jsx
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { inr, shortDate } from "../../utils/dashboardFormat";

const STATUS = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed", DELIVERED: "Delivered", CANCELLED: "Cancelled" };

export default function RecentOrders({ orders, inProgress }) {
  return (
    <section aria-labelledby="recent">
      <div className="flex items-baseline justify-between px-1 pb-2 pt-5"><h2 id="recent" className="text-sm font-bold text-ink">Recent orders</h2><span className="text-xs text-ink-2">{inProgress} in progress</span></div>
      <ul className="divide-y divide-line rounded-2xl bg-surface px-3.5">
        {orders.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium text-ink">{o.customerName}</span><span className="text-xs text-ink-2">{shortDate(o.orderDate)} · {STATUS[o.status] || o.status}</span></span>
              <span className="font-num font-semibold tabular-nums text-ink">{inr(o.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/orders" className="mt-2 block py-2 text-center text-sm font-semibold text-brass">All orders</Link>
    </section>
  );
}
RecentOrders.propTypes = { orders: PropTypes.array.isRequired, inProgress: PropTypes.number.isRequired };
```

- [ ] **Step 2: Rewrite `pages/Dashboard.jsx`** (replaces the whole file; old stat-card components and client-side money math are removed):

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      <Link to="/orders/new" className="fixed bottom-24 left-4 z-30 rounded-2xl bg-brass px-4 py-3 text-sm font-bold text-brass-on shadow-lg shadow-brass/30 sm:hidden">＋ New order</Link>
      <InfoSheet open={Boolean(info)} title={infoContent?.title || ""} onClose={() => setInfo(null)}>
        {infoContent?.body.map((p) => <p key={p}>{p}</p>)}
      </InfoSheet>
    </main>
  );
}
```
Also in `frontend/src/components/layout/MainLayout.jsx` line 14, replace `bg-gray-50 dark:bg-[#0d1210]` with `bg-canvas` (the token background; near-identical to the old colours, so other screens don't shift) and add that file to the commit. The Jarvis button already sits bottom-right (`bottom-24 right-4`), so the New-order pill goes bottom-**left**.

- [ ] **Step 3: Lint + build; commit**

```bash
git add frontend/src/components/dashboard/RecentOrders.jsx frontend/src/pages/Dashboard.jsx frontend/src/components/layout/MainLayout.jsx
git commit -m "feat(dashboard-ui): assemble the new dashboard (dues first, period section, charts)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Dues screen

**Files:** Create `frontend/src/pages/Dues.jsx`; Modify `frontend/src/App.jsx`, `backend/knowledge/routes.md`

- [ ] **Step 1: `pages/Dues.jsx`**:

```jsx
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
```
Note: in the Dues list, amounts, order counts and the WhatsApp message reflect the selected band (the filtered `unpaidOrders`).

- [ ] **Step 2: Route** — in `App.jsx` add `import Dues from "./pages/Dues";` and, next to `<Route path="history" …/>`, `<Route path="dues" element={<Dues />} />`.

- [ ] **Step 3: Jarvis routes** — in `backend/knowledge/routes.md` replace the `/` row with
`| \`/\` | Dashboard | To collect (dues by age, customers to chase with call/WhatsApp), period figures (sales, collected, kg/pcs, expenses) with charts, recent orders |`
add after it
`| \`/dues\` | Dues | Every customer who owes, oldest dues first; filter by age (\`/dues?age=90+\`, \`61-90\`, \`31-60\`, \`0-30\`); call/WhatsApp reminder |`
and update the Product Sizes row purpose to `Master list of bag sizes (label, rate per kg and/or piece price, optional weight)`.

- [ ] **Step 4: Lint + build + `cd backend && npx cross-env NODE_ENV=test jest tests/knowledgeLoader.test.js`; commit**

```bash
git add frontend/src/pages/Dues.jsx frontend/src/App.jsx backend/knowledge/routes.md
git commit -m "feat(dues): Dues screen with age filters and reminders; Jarvis routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Jarvis dashboard knowledge + HANDOFF

**Files:** Modify `backend/knowledge/dashboard.md`, `HANDOFF.md`

- [ ] **Step 1: Replace `backend/knowledge/dashboard.md`** with:

```markdown
# Dashboard

What it is: the home screen at [/](/), dark "Midnight Forest" theme. Every figure
is computed on the server by the same order math as the Orders screen and is
reconciled (Sales − Collected = To collect − Credit, to the paisa). If a check
ever fails the screen shows a red "These figures don't add up" banner instead
of numbers.

## Top: money to collect (always all-time, as of today)
- **To collect** — sum of every order's unpaid remainder (cancelled and deleted
  orders excluded). ⓘ explains the definition.
- **Age bar** — 0–30 / 31–60 / 61–90 / 90+ days by order date; the bands add up
  to To collect. Tap a band to open [Dues](/dues) filtered to it.
- **Collect from** — top 5 customers, oldest dues first: amount, age of oldest
  unpaid order, number of orders. Tap the name for the customer page; phone icon
  calls them; chat icon opens WhatsApp with a pre-written reminder listing their
  unpaid orders (the user sends it). Icons appear only when a valid mobile is
  saved. **See all N customers** opens [Dues](/dues).

## Period section
- Chips: **All time · This month · Last month · This FY · Custom…** (sticky; the
  last choice is remembered on the phone; opens on All time the first time).
- Tiles: **Sales** (orders dated in the period), **Collected** (payments received
  in the period, including on older orders), **Kg sold** (+ pieces, ≈ kg from
  pieces), **Expenses** (bills dated in the period). Badges compare with the
  same-length period before (e.g. same days last month); none for All time.
- Charts: **Sales vs collected** and **Kg sold** for the last 6 months (tap a
  month for exact values; the current month is marked "so far"); **Top sizes**
  and **Expenses by category** follow the chosen period.
- **Recent orders** (read-only) with the number in progress.
- There is no profit figure on purpose: big raw-material bills are used over
  many months.

## Answering "why is the dashboard different from …"
- Dashboard excludes orders with status Cancelled; the Orders list includes them.
- Collected excludes payments recorded on deleted orders.
- For kg/pieces and dues SQL, use the canonical queries in schema.md.
```

- [ ] **Step 2: HANDOFF** — under Modules add a "Dashboard (2026-09-30)" paragraph: endpoints, pure modules, reconciliation banner, `scripts/dashboard-verify.js` (run before each release), theme tokens in `index.css`/`tailwind.config.js` (Phase 2 = migrate other screens), dark default.

- [ ] **Step 3: `cd backend && npm test` (knowledge tests) and commit**

```bash
git add backend/knowledge/dashboard.md HANDOFF.md
git commit -m "docs: Jarvis knows the new dashboard; handoff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verification, production cross-check, walkthrough, review

- [ ] **Step 1:** `cd backend && npm test`; `cd frontend && npm test && npx vite build` — all green.
- [ ] **Step 2: Production read-only cross-check** (owner's go-ahead not needed — read-only; it uses production credentials locally):
  `cd backend && NODE_ENV=production node scripts/dashboard-verify.js` → must print ✅ and a summary with Sales ₹26,14,607 (or later values if new orders were added today — then compare with the canonical SQL numbers it prints), Collected, To collect ₹2,33,320-or-current, 18-or-current customers. Any ❌ blocks release.
- [ ] **Step 3: Local walkthrough** (backend `NODE_ENV=test PORT=5055`, frontend `VITE_API_URL=http://localhost:5055/api npx vite --port 5173`; seed a few customers/orders/payments/expenses with phones via the API): 390px (iframe method) and desktop; dark and light; reduced motion on/off (DevTools emulation via `matchMedia` override); every chip incl. custom; tap a band → Dues filtered; call/WhatsApp hrefs correct; skeleton/error states (stop backend → error + retry).
- [ ] **Step 4: Final review** — review package + fresh reviewer on the most capable model (Fable 5) with spec, plan, Review Focus.

---

### Task 14: Production rollout (owner's go-ahead per step)

1. `NODE_ENV=production node scripts/dashboard-verify.js` → ✅ (again, just before deploy).
2. Backend: `gcloud builds submit backend/ --tag asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend --project yars-dashboard --account dk7696822@gmail.com` then `gcloud run deploy yars-backend --image … --region asia-south1 --project yars-dashboard --account dk7696822@gmail.com`; health check.
3. Frontend: `cd frontend && npm run build && npx firebase-tools deploy --only hosting --project yars-dashboard`.
4. Verify on https://yars-dashboard.web.app: To collect and all-time Sales/Collected equal the verify script's summary.
5. Merge `feature/dashboard-redesign` → `main`, push (fast-forward).
Rollback: Cloud Run previous revision; Firebase previous release.
