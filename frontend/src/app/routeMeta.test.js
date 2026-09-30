import { describe, expect, test } from "vitest";
import { routeMeta } from "./routeMeta";

describe("routeMeta", () => {
  test.each([
    ["/", { title: "Dashboard", back: null, hideNav: false }],
    ["/orders", { title: "Orders", back: null, hideNav: false }],
    ["/orders/new", { title: "New order", back: null, hideNav: true }],
    ["/orders/edit/abc", { title: "Edit order", back: null, hideNav: true }],
    ["/orders/abc", { title: "Order", back: "/orders", hideNav: false }],
    ["/customers/new", { title: "New customer", back: null, hideNav: true }],
    ["/customers/edit/c1", { title: "Edit customer", back: null, hideNav: true }],
    ["/customers/c1", { title: "Customer", back: "/customers", hideNav: false }],
    ["/invoices/new", { title: "New invoice", back: null, hideNav: true }],
    ["/invoices/i1", { title: "Invoice", back: "/invoices", hideNav: false }],
    ["/dues", { title: "Dues", back: null, hideNav: false }],
    ["/stock-issues/new", { title: "New Stock Issue", back: null, hideNav: false }],
    ["/stock", { title: "Stock", back: null, hideNav: false }],
    ["/product-sizes", { title: "Sizes", back: null, hideNav: false }],
    ["/product-sizes/new", { title: "New size", back: null, hideNav: true }],
    ["/product-sizes/edit/s1", { title: "Edit size", back: null, hideNav: true }],
    ["/plate-types", { title: "Plate types", back: null, hideNav: false }],
    ["/plate-types/new", { title: "New plate type", back: null, hideNav: true }],
    ["/plate-types/edit/p1", { title: "Edit plate type", back: null, hideNav: true }],
    ["/nowhere", { title: "YARS", back: null, hideNav: false }],
  ])("%s", (path, meta) => expect(routeMeta(path)).toEqual(meta));
});
