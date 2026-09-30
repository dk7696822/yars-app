"use strict";

const express = require("express");
const { overview, period, trends } = require("../controllers/dashboardController");

const router = express.Router();
router.get("/overview", overview);
router.get("/period", period);
router.get("/trends", trends);

module.exports = router;
