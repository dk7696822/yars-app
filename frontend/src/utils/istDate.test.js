import { describe, expect, test } from "vitest";
import { todayIST, addDays, daysBetween, isISODate } from "./istDate";

describe("istDate", () => {
  test("today is India's date, not UTC's", () => {
    expect(todayIST(new Date("2026-09-30T19:00:00Z"))).toBe("2026-10-01");
    expect(todayIST(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09-30");
  });
  test("day arithmetic across months", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-07-01", "2026-09-30")).toBe(91);
  });
  test("only real calendar dates are dates", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("30/09/2026")).toBe(false);
  });
});
