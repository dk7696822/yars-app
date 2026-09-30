import { describe, expect, test } from "vitest";
import { expenseParams, expenseTotals, groupExpenses, cardTotals } from "./expenseList";

describe("expenseParams", () => {
  test("period chips become date ranges (India dates)", () => {
    expect(expenseParams({ chip: "this_month" }, "2026-09-30")).toEqual({ from_date: "2026-09-01", to_date: "2026-09-30" });
    expect(expenseParams({ chip: "last_month" }, "2026-09-30")).toEqual({ from_date: "2026-08-01", to_date: "2026-08-31" });
    expect(expenseParams({ chip: "last_month" }, "2026-01-15")).toEqual({ from_date: "2025-12-01", to_date: "2025-12-31" });
    expect(expenseParams({ chip: "all" }, "2026-09-30")).toEqual({});
  });
  test("unpaid, category and search", () => {
    expect(expenseParams({ chip: "unpaid", categoryId: "c1", search: "  diesel " }, "2026-09-30")).toEqual({ payment_status: "UNPAID", category_id: "c1", search: "diesel" });
  });
});

describe("expenseTotals", () => {
  test("exact paise sums; unpaid separately", () => {
    const e = [{ total_cost: "0.10", payment_status: "PAID" }, { total_cost: "0.20", payment_status: "UNPAID" }, { total_cost: "1500.00", payment_status: "UNPAID" }];
    expect(expenseTotals(e)).toEqual({ total: 1500.3, unpaid: 1500.2, count: 3 });
  });
});

describe("groupExpenses", () => {
  test("grouped by bill date", () => {
    const e = [{ id: 1, bill_date: "2026-09-30" }, { id: 2, bill_date: "2026-09-30" }, { id: 3, bill_date: "2026-09-29" }];
    expect(groupExpenses(e, "2026-09-30").map((g) => [g.label, g.rows.length])).toEqual([["Today", 2], ["Yesterday", 1]]);
  });
});

describe("cardTotals", () => {
  test("no figures while the previous filter's list is still on screen", () => {
    const expenses = [{ total_cost: "100.00", payment_status: "UNPAID" }];
    expect(cardTotals({ expenses, isPlaceholderData: true })).toBeNull();
    expect(cardTotals({ expenses, isPlaceholderData: false })).toEqual({ total: 100, unpaid: 100, count: 1 });
    expect(cardTotals({ expenses: [], isPlaceholderData: false, isPending: true })).toBeNull();
    expect(cardTotals({ expenses: [], isPlaceholderData: false, isPending: false, hasData: false })).toBeNull();
  });
});
