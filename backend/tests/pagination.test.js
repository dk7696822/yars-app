"use strict";

const { getPagination, buildPaginatedResponse } = require("../src/utils/pagination");

describe("getPagination", () => {
  it("defaults to page 1, limit 20", () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("computes the offset from the page", () => {
    expect(getPagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("clamps a silly limit", () => {
    expect(getPagination({ limit: "5000" }).limit).toBe(100);
  });

  it("ignores garbage input", () => {
    expect(getPagination({ page: "abc", limit: "-4" })).toEqual({ page: 1, limit: 20, offset: 0 });
  });
});

describe("buildPaginatedResponse", () => {
  it("wraps rows with pagination metadata", () => {
    const result = buildPaginatedResponse([{ id: 1 }], 45, { page: 2, limit: 20 });
    expect(result).toEqual({
      data: [{ id: 1 }],
      pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it("reports one page when there are no rows", () => {
    expect(buildPaginatedResponse([], 0, { page: 1, limit: 20 }).pagination.totalPages).toBe(0);
  });
});
