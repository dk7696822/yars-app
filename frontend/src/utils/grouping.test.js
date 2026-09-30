import { describe, expect, test } from "vitest";
import { groupByDay } from "./dayGroups";
import { letterOf, groupByLetter } from "./alphaIndex";
import { itemsText, itemsFromLines } from "./itemsText";
import { shortDate } from "./dashboardFormat";

describe("groupByDay", () => {
  test("keeps order; Today / Yesterday / date labels", () => {
    const rows = [{ id: 1, orderDate: "2026-09-30" }, { id: 2, orderDate: "2026-09-30" }, { id: 3, orderDate: "2026-09-29" }, { id: 4, orderDate: "2026-09-01" }];
    expect(groupByDay(rows, "2026-09-30")).toEqual([
      { date: "2026-09-30", label: "Today", rows: [rows[0], rows[1]] },
      { date: "2026-09-29", label: "Yesterday", rows: [rows[2]] },
      { date: "2026-09-01", label: shortDate("2026-09-01"), rows: [rows[3]] },
    ]);
  });
});

describe("letters", () => {
  test("A–Z or # (same rule as the server)", () => {
    expect([letterOf("alpha"), letterOf("  zed"), letterOf("12 Star"), letterOf("")]).toEqual(["A", "Z", "#", "#"]);
  });
  test("groups consecutive names", () => {
    const rows = [{ name: "12 Star" }, { name: "Alpha" }, { name: "anand" }, { name: "Beta" }];
    expect(groupByLetter(rows).map((g) => [g.letter, g.rows.length])).toEqual([["#", 1], ["A", 2], ["B", 1]]);
  });
});

describe("itemsText", () => {
  test("first item and how many more", () => {
    expect(itemsText([{ size: "14x18", unit: "KG", quantity: 30 }])).toBe("14x18 · 30 kg");
    expect(itemsText([{ size: "14x18", unit: "KG", quantity: 12.25 }, { size: "16x20", unit: "PIECES", quantity: 10000 }])).toBe("14x18 · 12.25 kg +1 more");
    expect(itemsText([{ size: "16x20", unit: "PIECES", quantity: 10000 }])).toBe("16x20 · 10,000 pcs");
    expect(itemsText([])).toBe("No items");
  });
  test("from saved order lines", () => {
    expect(itemsFromLines([
      { unit: "KG", quantity_kg: "12.25", productSize: { size_label: "14x18" } },
      { unit: "PIECES", quantity_pieces: 500, productSize: null },
    ])).toEqual([{ size: "14x18", unit: "KG", quantity: 12.25 }, { size: "Unknown size", unit: "PIECES", quantity: 500 }]);
  });
});
