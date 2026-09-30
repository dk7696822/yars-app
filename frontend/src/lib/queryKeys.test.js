import { describe, expect, test, vi } from "vitest";
import { invalidateMoney, keys } from "./queryKeys";

describe("invalidateMoney", () => {
  test("after any money change, every list and page with money refreshes", async () => {
    const qc = { invalidateQueries: vi.fn().mockResolvedValue() };
    await invalidateMoney(qc);
    expect(qc.invalidateQueries.mock.calls.map((c) => c[0].queryKey)).toEqual([keys.orders.all, keys.customers.all, keys.invoices.all]);
  });
  test("list keys include their params", () => {
    expect(keys.orders.list({ chip: "due" })).toEqual(["orders", "list", { chip: "due" }]);
  });
});
