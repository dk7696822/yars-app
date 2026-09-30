import { describe, expect, test } from "vitest";
import { parseNumber } from "./numberInput";

const ok = (value) => ({ value, error: null });
const bad = (error) => ({ value: null, error });

describe("parseNumber", () => {
  test("money / kg: up to 2 decimals", () => {
    expect(parseNumber("12.25")).toEqual(ok(12.25));
    expect(parseNumber("12.255")).toEqual(bad("Use at most 2 decimals"));
    expect(parseNumber("1,250.5")).toEqual(ok(1250.5));
    expect(parseNumber(" 12. ")).toEqual(ok(12));
    expect(parseNumber(".5")).toEqual(ok(0.5));
  });
  test("empty is not an error — the caller decides if it's required", () => {
    expect(parseNumber("")).toEqual(ok(null));
    expect(parseNumber(null)).toEqual(ok(null));
  });
  test("zero, text, too large", () => {
    expect(parseNumber("0")).toEqual(bad("Must be more than 0"));
    expect(parseNumber("0", { allowZero: true })).toEqual(ok(0));
    expect(parseNumber("12kg")).toEqual(bad("Enter a number"));
    expect(parseNumber("100000000")).toEqual(bad("That number is too large"));
  });
  test("whole numbers for pieces", () => {
    expect(parseNumber("10000", { whole: true })).toEqual(ok(10000));
    expect(parseNumber("10.5", { whole: true })).toEqual(bad("Whole numbers only"));
    expect(parseNumber("0", { whole: true })).toEqual(bad("Must be at least 1"));
  });
  test("piece price up to 4 decimals, weight up to 3", () => {
    expect(parseNumber("0.3750", { dp: 4 })).toEqual(ok(0.375));
    expect(parseNumber("0.37501", { dp: 4 })).toEqual(bad("Use at most 4 decimals"));
    expect(parseNumber("1.2345", { dp: 3 })).toEqual(bad("Use at most 3 decimals"));
  });
  test("round off may be negative", () => {
    expect(parseNumber("-5", { signed: true, allowZero: true })).toEqual(ok(-5));
    expect(parseNumber("-5")).toEqual(bad("Enter a number"));
  });
});
