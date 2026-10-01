"use strict";

const { z } = require("zod");
const db = require("../src/models");
const { defineCommand } = require("../src/commands/defineCommand");
const { runCommand } = require("../src/commands/runCommand");
const { httpRoute } = require("../src/commands/httpRoute");
const { NotFoundError } = require("../src/commands/errors");
const { mockRes } = require("./helpers/http");

const addCustomer = defineCommand({
  name: "test.addCustomer",
  input: z.object({ name: z.string({ error: "Name is required" }).min(1, { error: "Name is required" }) }),
  run: async ({ name }, { transaction }) => {
    if (name === "nobody") throw new NotFoundError("Nobody found");
    const customer = await db.Customer.create({ name }, { transaction });
    if (name === "explode") throw new Error("boom");
    return { id: customer.id };
  },
});

const call = async (handler, req) => {
  const res = mockRes();
  await handler({ body: {}, params: {}, query: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

afterEach(() => jest.restoreAllMocks());

describe("commands", () => {
  test("input that fails the schema is a 400 with the schema's own message", async () => {
    await expect(runCommand(addCustomer, {})).rejects.toMatchObject({ name: "ValidationError", status: 400, message: "Name is required" });
  });

  test("a successful run commits", async () => {
    const { id } = await runCommand(addCustomer, { name: "Kept" });
    expect((await db.Customer.findByPk(id)).name).toBe("Kept");
  });

  test("any error rolls the whole run back", async () => {
    await expect(runCommand(addCustomer, { name: "explode" })).rejects.toThrow("boom");
    expect(await db.Customer.count()).toBe(0);
  });

  test("a caller's transaction is joined, so the caller decides", async () => {
    const t = await db.sequelize.transaction();
    await runCommand(addCustomer, { name: "Trial" }, { transaction: t });
    expect(await db.Customer.count({ transaction: t })).toBe(1);
    await t.rollback();
    expect(await db.Customer.count()).toBe(0);
  });

  describe("httpRoute", () => {
    const route = httpRoute(addCustomer, {
      respond: async ({ id }) => ({ status: 201, message: "Added", data: { id } }),
      failMessage: "Failed to add",
    });

    test("success sends what respond() returns", async () => {
      const { status, body } = await call(route, { body: { name: "Via HTTP" } });
      expect(status).toBe(201);
      expect(body).toMatchObject({ success: true, message: "Added" });
    });

    test("a command error keeps its status and message", async () => {
      expect(await call(route, { body: {} })).toMatchObject({ status: 400, body: { success: false, message: "Name is required" } });
      expect(await call(route, { body: { name: "nobody" } })).toMatchObject({ status: 404, body: { message: "Nobody found" } });
    });

    test("anything else is a 500 with the route's message", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      expect(await call(route, { body: { name: "explode" } })).toMatchObject({ status: 500, body: { message: "Failed to add", errors: "boom" } });
    });
  });
});
