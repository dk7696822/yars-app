"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../src/models");
const { login } = require("../src/controllers/authController");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authController.login", () => {
  beforeEach(async () => {
    await db.User.create({
      username: "deepak",
      password_hash: await bcrypt.hash("correct-horse", 10),
      display_name: "Deepak",
    });
  });

  test("valid credentials → 200 with token and user", async () => {
    const req = { body: { username: "deepak", password: "correct-horse" } };
    const res = mockRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.user).toMatchObject({ username: "deepak", displayName: "Deepak" });
    const decoded = jwt.verify(payload.data.token, process.env.JWT_SECRET);
    expect(decoded.username).toBe("deepak");
  });

  test("wrong password → 401", async () => {
    const req = { body: { username: "deepak", password: "wrong" } };
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("unknown username → 401 with same generic message as wrong password", async () => {
    const res1 = mockRes();
    await login({ body: { username: "nobody", password: "x" } }, res1);
    const res2 = mockRes();
    await login({ body: { username: "deepak", password: "wrong" } }, res2);

    expect(res1.status).toHaveBeenCalledWith(401);
    expect(res1.json.mock.calls[0][0].message).toBe(res2.json.mock.calls[0][0].message);
  });

  test("missing fields → 400", async () => {
    const res = mockRes();
    await login({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
