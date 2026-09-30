import { describe, expect, test } from "vitest";
import { emptyIssue, newIssueLine, issueErrors, shortfalls, toIssuePayload } from "./issueForm";

const pp = { id: "i1", name: "PP", unit: "KG", in_stock: 100 };
const form = (o, line = {}) => ({ ...emptyIssue("2026-09-30"), lines: [{ ...newIssueLine(pp), key: "a", quantity: "50", ...line }], ...o });

describe("stock issue form", () => {
  test("an issue needs at least one item with a quantity", () => {
    expect(issueErrors(emptyIssue("2026-09-30"))).toEqual({ lines: "Add at least one item" });
    expect(issueErrors(form())).toEqual({});
    expect(issueErrors(form({}, { quantity: "" }))).toEqual({ "qty:a": "Enter the quantity" });
    expect(issueErrors(form({}, { quantity: "1.2345" }))).toEqual({ "qty:a": "Use at most 3 decimals" });
    expect(issueErrors(form({}, { wastage: "-1" }))).toEqual({ "waste:a": "Enter a number" });
  });
  test("adjustments need a reason", () => {
    expect(issueErrors(form({ issue_type: "ADJUSTMENT_OUT" }))).toEqual({ reason: "Say why the count changed" });
    expect(issueErrors(form({ issue_type: "ADJUSTMENT_IN", reason: "Stock count" }))).toEqual({});
  });
  test("shortfall counts wastage and the same item on two lines; adding stock never falls short", () => {
    expect(shortfalls(form({}, { quantity: "90", wastage: "20" }))).toEqual({ a: 10 });
    const two = form();
    two.lines.push({ ...newIssueLine(pp), key: "b", quantity: "60" });
    expect(shortfalls(two)).toEqual({ b: 10 });
    expect(shortfalls(form({ issue_type: "ADJUSTMENT_IN" }, { quantity: "500" }))).toEqual({});
    expect(shortfalls(form({ issue_type: "WASTAGE" }, { quantity: "90", wastage: "20" }))).toEqual({});
  });
  test("payload: wastage only on issues; order only on issue or wastage", () => {
    expect(toIssuePayload(form({ order: { id: "o1" }, notes: " " }, { wastage: "2.5" }))).toEqual({
      issue_date: "2026-09-30", issue_type: "ISSUE", order_id: "o1", reason: null, notes: null, items: [{ item_id: "i1", quantity: 50, wastage_quantity: 2.5 }],
    });
    expect(toIssuePayload(form({ issue_type: "ADJUSTMENT_IN", reason: " Count ", order: { id: "o1" } }, { wastage: "2" }))).toMatchObject({
      order_id: null, reason: "Count", items: [{ item_id: "i1", quantity: 50, wastage_quantity: 0 }],
    });
  });
});
