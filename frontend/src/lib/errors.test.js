import { describe, expect, test } from "vitest";
import { errorText } from "./errors";

describe("errorText", () => {
  test("server message first, then the fallback", () => {
    expect(errorText({ response: { data: { message: "Customer name is required" } } }, "Couldn't save")).toBe("Customer name is required");
    expect(errorText(new Error("Network Error"), "Couldn't save")).toBe("Couldn't save");
  });
});
