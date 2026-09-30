import { describe, expect, test } from "vitest";
import { cleanName } from "./nameList";

describe("cleanName", () => {
  test("trims and collapses spaces", () => {
    expect(cleanName("  Blue   Bags ")).toBe("Blue Bags");
    expect(cleanName("   ")).toBe("");
    expect(cleanName(null)).toBe("");
  });
});
