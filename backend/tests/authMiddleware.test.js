"use strict";

const jwt = require("jsonwebtoken");
const authMiddleware = require("../src/middleware/authMiddleware");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const call = (authHeader) => {
  const req = { headers: authHeader ? { authorization: authHeader } : {} };
  const res = mockRes();
  const next = jest.fn();
  authMiddleware(req, res, next);
  return { req, res, next };
};

describe("authMiddleware", () => {
  const SECRET = process.env.JWT_SECRET;

  test("valid token calls next() and sets req.user", () => {
    const token = jwt.sign({ sub: "user-id-1", username: "deepak" }, SECRET, { expiresIn: "1h" });
    const { req, res, next } = call(`Bearer ${token}`);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ sub: "user-id-1", username: "deepak" });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("missing header → 401", () => {
    const { res, next } = call(undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("malformed header (no Bearer prefix) → 401", () => {
    const { res, next } = call("just-a-token");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("garbage token → 401", () => {
    const { res, next } = call("Bearer not.a.jwt");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("expired token → 401", () => {
    const token = jwt.sign({ sub: "user-id-1" }, SECRET, { expiresIn: "-10s" });
    const { res, next } = call(`Bearer ${token}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("token signed with wrong secret → 401", () => {
    const token = jwt.sign({ sub: "user-id-1" }, "some-other-secret", { expiresIn: "1h" });
    const { res, next } = call(`Bearer ${token}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
