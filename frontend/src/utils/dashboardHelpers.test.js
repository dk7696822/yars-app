import { describe, test, expect, vi } from "vitest";
import { inr, axisInr, kgText, delta, shortDate, monthLabel } from "./dashboardFormat";
import { toIndianMobile, telHref, whatsappHref } from "./phone";
import { buildReminder } from "./whatsappReminder";
import { loadPeriod, savePeriod } from "./periodPrefs";
import { ageBandOf, filterByBand } from "./duesFilter";
import { latestOnly } from "./latestOnly";

describe("format", () => {
  test("exact rupees in Indian grouping", () => {
    expect(inr(233320)).toBe("₹2,33,320");
    expect(inr(1006.01)).toBe("₹1,006.01");
    expect(inr(0)).toBe("₹0");
  });
  test("axis labels only are compact", () => {
    expect(axisInr(100000)).toBe("₹1L");
    expect(axisInr(250000)).toBe("₹2.5L");
    expect(axisInr(50000)).toBe("₹50k");
  });
  test("kg and dates", () => {
    expect(kgText(558)).toBe("558 kg");
    expect(kgText(62.5)).toBe("62.5 kg");
    expect(shortDate("2026-02-28")).toBe("28 Feb 2026");
    expect(monthLabel("2026-03")).toBe("Mar");
  });
  test("delta", () => {
    expect(delta(164850, 82640)).toEqual({ text: "▲ 99%", dir: "up" });
    expect(delta(50, 100)).toEqual({ text: "▼ 50%", dir: "down" });
    expect(delta(100, 0)).toEqual({ text: "new", dir: "up" });
    expect(delta(0, 0)).toEqual({ text: "no change", dir: "flat" });
    expect(delta(100, null)).toBeNull();
  });
});

describe("phone", () => {
  test.each([["09876543210", "9876543210"], ["9876543210", "9876543210"], ["+91 98765 43210", "9876543210"], ["919876543210", "9876543210"]])(
    "%s → %s", (raw, out) => expect(toIndianMobile(raw)).toBe(out));
  test("invalid numbers give null (buttons hidden)", () => {
    for (const raw of [null, "", "08482-234567", "12345", "5876543210", "0987654321"]) {
      expect(toIndianMobile(raw)).toBeNull();
      expect(telHref(raw)).toBeNull();
      expect(whatsappHref(raw, "hi")).toBeNull();
    }
  });
  test("links", () => {
    expect(telHref("09876543210")).toBe("tel:+919876543210");
    expect(whatsappHref("09876543210", "a b")).toBe("https://wa.me/919876543210?text=a%20b");
  });
});

describe("WhatsApp reminder", () => {
  test("lists unpaid orders with exact amounts", () => {
    expect(buildReminder({ name: "Sri Balaji Traders", amount: 32700, unpaidOrders: [
      { orderDate: "2026-02-28", remaining: 18000 }, { orderDate: "2026-03-12", remaining: 14700 },
    ] })).toBe([
      "Namaste Sri Balaji Traders, this is a gentle reminder from YARS Industries.",
      "Pending balance: ₹32,700",
      "• Order of 28 Feb 2026 — ₹18,000",
      "• Order of 12 Mar 2026 — ₹14,700",
      "Kindly arrange the payment at your convenience. Thank you!",
    ].join("\n"));
  });
  test("caps the list at 10 orders", () => {
    const orders = Array.from({ length: 12 }, (_, i) => ({ orderDate: `2026-01-${String(i + 1).padStart(2, "0")}`, remaining: 1 }));
    expect(buildReminder({ name: "X", amount: 12, unpaidOrders: orders })).toMatch(/…and 2 more orders/);
  });
});

describe("period prefs", () => {
  test("defaults to all time and survives missing storage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadPeriod()).toEqual({ preset: "all" });
    expect(() => savePeriod({ preset: "this_month" })).not.toThrow();
    const store = {};
    vi.stubGlobal("localStorage", { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });
    savePeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-10" });
    expect(loadPeriod()).toEqual({ preset: "custom", from: "2026-09-01", to: "2026-09-10" });
    vi.unstubAllGlobals();
  });
});

describe("dues filter", () => {
  const asOf = "2026-09-30";
  test.each([["2026-08-31", "0-30"], ["2026-08-30", "31-60"], ["2026-07-02", "61-90"], ["2026-07-01", "90+"]])(
    "%s → %s", (d, band) => expect(ageBandOf(d, asOf)).toBe(band));
  test("keeps only the band's orders and re-sums", () => {
    const customers = [{ id: "a", amount: 1600, unpaidOrders: [{ orderDate: "2026-05-01", remaining: 1000 }, { orderDate: "2026-09-20", remaining: 600 }] }];
    expect(filterByBand(customers, "90+", asOf)).toEqual([{ id: "a", amount: 1000, orders: 1, unpaidOrders: [{ orderDate: "2026-05-01", remaining: 1000 }] }]);
    expect(filterByBand(customers, "31-60", asOf)).toEqual([]);
    expect(filterByBand(customers, "all", asOf)).toBe(customers);
  });
});

describe("latestOnly", () => {
  test("a slow older response never overwrites a newer one", async () => {
    const latest = latestOnly();
    let resolveSlow;
    const slow = latest(new Promise((r) => { resolveSlow = r; }));
    const fast = latest(Promise.resolve("new"));
    await expect(fast).resolves.toBe("new");
    resolveSlow("old");
    await expect(slow).resolves.toBe(latestOnly.STALE);
  });

  test("an overtaken request's failure is ignored, the latest one's failure is not", async () => {
    const latest = latestOnly();
    let rejectSlow;
    const slow = latest(new Promise((_, rej) => { rejectSlow = rej; }));
    const fast = latest(Promise.reject(new Error("latest failed")));
    await expect(fast).rejects.toThrow("latest failed");
    rejectSlow(new Error("old failed"));
    await expect(slow).resolves.toBe(latestOnly.STALE);
  });
});
