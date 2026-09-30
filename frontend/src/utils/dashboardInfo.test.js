import { describe, test, expect } from "vitest";
import { infoExtras } from "../components/dashboard/definitions";
import { customRangeError } from "./periodPrefs";

const period = (excluded) => ({
  range: { from: "2026-09-01", to: "2026-09-30" },
  compare: { from: "2026-08-01", to: "2026-08-30" },
  excluded: {
    cancelled: { count: 0, amount: 0 },
    deletedOrderPayments: { count: 0, amount: 0 },
    unlinkedPayments: { count: 0, amount: 0 },
    ...excluded,
  },
});

describe("ⓘ disclosures", () => {
  test("every period figure states the exact dates it covers", () => {
    expect(infoExtras("sales", period())).toEqual(["Period: 01 Sept 2026 – 30 Sept 2026, compared with 01 Aug 2026 – 30 Aug 2026."]);
  });

  test("collected discloses deleted-order and unlinked payments", () => {
    const lines = infoExtras("collected", period({
      deletedOrderPayments: { count: 2, amount: 14456 },
      unlinkedPayments: { count: 1, amount: 250 },
    }));
    expect(lines).toContain("Excludes ₹14,456 from 2 payment(s) on deleted orders.");
    expect(lines).toContain("Excludes ₹250 from 1 payment(s) not linked to any order.");
  });

  test("sales discloses cancelled orders", () => {
    expect(infoExtras("sales", period({ cancelled: { count: 1, amount: 5900 } })))
      .toContain("Excludes 1 cancelled order(s) worth ₹5,900.");
  });

  test("to collect has no period line; missing period data is safe", () => {
    expect(infoExtras("toCollect", period())).toEqual([]);
    expect(infoExtras("sales", null)).toEqual([]);
  });
});

describe("custom range validation (same rules as the server)", () => {
  test.each([
    ["", "2026-09-10", "Choose both dates."],
    ["2026-09-20", "2026-09-10", "From date must be on or before To date."],
    ["2019-01-01", "2026-01-01", "A custom period can be at most 5 years."],
  ])("%s → %s rejected", (from, to, message) => expect(customRangeError(from, to)).toBe(message));

  test("a valid range passes", () => {
    expect(customRangeError("2026-09-01", "2026-09-30")).toBeNull();
    expect(customRangeError("2021-10-01", "2026-09-30")).toBeNull();
  });
});
