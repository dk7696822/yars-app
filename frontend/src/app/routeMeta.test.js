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
    ["/stock/abc", { title: "Item stock", back: "/stock", hideNav: false }],
    ["/product-sizes", { title: "Sizes", back: null, hideNav: false }],
    ["/product-sizes/new", { title: "New size", back: null, hideNav: true }],
    ["/product-sizes/edit/s1", { title: "Edit size", back: null, hideNav: true }],
    ["/plate-types", { title: "Plate types", back: null, hideNav: false }],
    ["/plate-types/new", { title: "New plate type", back: null, hideNav: true }],
    ["/plate-types/edit/p1", { title: "Edit plate type", back: null, hideNav: true }],
    ["/expenses", { title: "Expenses", back: null, hideNav: false }],
    ["/expenses/new", { title: "New expense", back: null, hideNav: true }],
    ["/expenses/edit/e1", { title: "Edit expense", back: null, hideNav: true }],
    ["/expense-categories", { title: "Expense categories", back: null, hideNav: false }],
    ["/inventory-items", { title: "Items", back: null, hideNav: false }],
    ["/inventory-items/new", { title: "New item", back: null, hideNav: true }],
    ["/inventory-items/edit/i1", { title: "Edit item", back: null, hideNav: true }],
    ["/inventory-categories", { title: "Item categories", back: null, hideNav: false }],
    ["/item-attributes", { title: "Item details", back: null, hideNav: false }],
    ["/nowhere", { title: "YARS", back: null, hideNav: false }],
  ])("%s", (path, meta) => expect(routeMeta(path)).toEqual(meta));
});
