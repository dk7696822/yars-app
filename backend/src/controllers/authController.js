"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { success, error } = require("../utils/response");

const TOKEN_EXPIRY = "30d";
// Same message for unknown user and wrong password — no username enumeration.
const BAD_CREDENTIALS = "Invalid username or password";

const login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return error(res, 400, "Username and password are required");
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return error(res, 401, BAD_CREDENTIALS);
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return error(res, 401, BAD_CREDENTIALS);
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return success(res, 200, "Logged in", {
      token,
      user: { id: user.id, username: user.username, displayName: user.display_name },
    });
  } catch (err) {
    console.error("login failed:", err);
    return error(res, 500, "Login failed");
  }
};

module.exports = { login };
