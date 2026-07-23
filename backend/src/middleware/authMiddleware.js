"use strict";

const jwt = require("jsonwebtoken");
const { error } = require("../utils/response");

/**
 * Verifies the Bearer JWT on every request. Mounted in routes/index.js AFTER
 * the /auth and /health routes, so those stay public.
 */
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return error(res, 401, "Authentication required");
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return error(res, 401, "Authentication required");
  }
};

module.exports = authMiddleware;
