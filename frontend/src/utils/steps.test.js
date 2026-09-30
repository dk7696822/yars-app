import { describe, expect, test } from "vitest";
import { firstInvalid } from "./steps";

describe("firstInvalid", () => {
  test("the first step with errors, or -1", () => {
    const errs = [{}, { lines: [] }, { plate: "x" }];
    expect(firstInvalid(3, (i) => errs[i])).toBe(1);
    expect(firstInvalid(3, () => ({}))).toBe(-1);
  });
});
