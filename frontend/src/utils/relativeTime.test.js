import { describe, expect, test } from "vitest";
import { relativeTime } from "./relativeTime";

const now = Date.parse("2026-09-30T12:00:00Z");
describe("relativeTime", () => {
  test("minutes, hours, days", () => {
    expect(relativeTime("2026-09-30T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-09-30T11:15:00Z", now)).toBe("45m ago");
    expect(relativeTime("2026-09-30T07:00:00Z", now)).toBe("5h ago");
    expect(relativeTime("2026-09-27T12:00:00Z", now)).toBe("3d ago");
  });
});
