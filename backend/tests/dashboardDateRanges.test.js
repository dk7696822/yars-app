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
