import { describe, expect, test } from "vitest";
import { isPathActive, TABS, MORE_ITEMS, NAV_GROUPS } from "./navItems";

describe("navigation", () => {
  test("a section stays highlighted on its sub-pages, but /stock-issues is not /stock", () => {
    expect(isPathActive("/orders/abc", "/orders")).toBe(true);
    expect(isPathActive("/stock-issues", "/stock")).toBe(false);
    expect(isPathActive("/orders", "/")).toBe(false);
    expect(isPathActive("/", "/")).toBe(true);
  });
  test("phone tabs: Home, Orders, Customers, Expenses (+ More)", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Home", "Orders", "Customers", "Expenses"]);
    expect(MORE_ITEMS.map((t) => t.to)).toEqual(expect.arrayContaining(["/dues", "/invoices", "/stock"]));
  });
  test("every screen is reachable from the sidebar", () => {
    expect(NAV_GROUPS.map((g) => g.title)).toEqual(["Sales", "Money", "Stock", "Setup"]);
  });
});
