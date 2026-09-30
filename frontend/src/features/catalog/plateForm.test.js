import { describe, expect, test } from "vitest";
import { validatePlate, toPlatePayload, formFromPlate } from "./plateForm";

describe("plate type form", () => {
  test("name and charge are required; ₹0 is a valid charge", () => {
    expect(validatePlate({ type_name: "", charge: "" })).toEqual({ type_name: "Enter the plate type name", charge: "Enter the charge" });
    expect(validatePlate({ type_name: "Half", charge: "0" })).toEqual({});
    expect(validatePlate({ type_name: "Half", charge: "12.345" })).toEqual({ charge: "Use at most 2 decimals" });
  });
  test("payload and editing", () => {
    expect(toPlatePayload({ type_name: " 2 colour ", charge: "1,500" })).toEqual({ type_name: "2 colour", charge: 1500 });
    expect(formFromPlate({ type_name: "Half", charge: "350.00" })).toEqual({ type_name: "Half", charge: "350" });
  });
});
