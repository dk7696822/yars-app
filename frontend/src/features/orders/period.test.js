import { describe, expect, test } from "vitest";
import { monthRange, periodRange, recentMonths, periodLabel, readPeriod } from "./period";

const TODAY = "2026-10-06";

describe("order list periods", () => {
  test("a month runs from the 1st to its last day", () => {
    expect([monthRange("2026-08"), monthRange("2026-02"), monthRange("2024-02"), monthRange("2025-12")]).toEqual([
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-02-01", to: "2026-02-28" },
      { from: "2024-02-01", to: "2024-02-29" },
      { from: "2025-12-01", to: "2025-12-31" },
    ]);
  });

  test("each period gives the dates the list is filtered by", () => {
    expect(periodRange({ period: "any" }, TODAY)).toEqual({});
    expect(periodRange({ period: "this_month" }, TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange({ period: "last_month" }, "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange({ period: "custom", from: "2026-08-01", to: "2026-08-31" }, TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  test("a custom range that is incomplete or reversed filters nothing", () => {
    expect(periodRange({ period: "custom", from: "2026-08-31", to: "2026-08-01" }, TODAY)).toEqual({});
    expect(periodRange({ period: "custom", from: "2026-08-01" }, TODAY)).toEqual({});
  });

  test("quick months: the last six, newest first", () => {
    const months = recentMonths(TODAY);
    expect(months.map((m) => m.label)).toEqual(["Oct 2026", "Sep 2026", "Aug 2026", "Jul 2026", "Jun 2026", "May 2026"]);
    expect(months[2]).toEqual({ label: "Aug 2026", from: "2026-08-01", to: "2026-08-31" });
  });

  test("the chip says what is shown", () => {
    expect(periodLabel({ period: "this_month" }, TODAY)).toBe("This month");
    expect(periodLabel({ period: "custom", from: "2026-08-01", to: "2026-08-31" }, TODAY)).toBe("Aug 2026");
    expect(periodLabel({ period: "custom", from: "2026-08-10", to: "2026-09-05" }, TODAY)).toBe("10 Aug → 5 Sep");
    expect(periodLabel({ period: "custom", from: "2025-12-20", to: "2026-01-10" }, TODAY)).toBe("20 Dec 2025 → 10 Jan 2026");
  });

  test("the period is read from the address, including old 'This month' links", () => {
    expect(readPeriod(new URLSearchParams("period=custom&from=2026-08-01&to=2026-08-31"))).toEqual({ period: "custom", from: "2026-08-01", to: "2026-08-31" });
    expect(readPeriod(new URLSearchParams("chip=this_month"))).toEqual({ period: "this_month", from: "", to: "" });
    expect(readPeriod(new URLSearchParams(""))).toEqual({ period: "any", from: "", to: "" });
  });
});
