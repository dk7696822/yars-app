"use strict";

const models = require("../models");
const { success, error } = require("../utils/response");
const { loadLedger } = require("../services/dashboard/ledger");
const { computeOverview, computePeriod, computeTrends } = require("../services/dashboard/metrics");
const { todayIST, resolvePeriod, PeriodError } = require("../services/dashboard/dateRanges");

const overview = async (req, res) => {
  try {
    return success(res, 200, "Dashboard overview", computeOverview(await loadLedger(models), todayIST()));
  } catch (err) {
    console.error("Error loading dashboard overview:", err);
    return error(res, 500, "Failed to load dashboard", err.message);
  }
};

const period = async (req, res) => {
  try {
    const today = todayIST();
    const ledger = await loadLedger(models);
    const { range, compare } = resolvePeriod(req.query, today, ledger.earliest);
    return success(res, 200, "Dashboard period", computePeriod(ledger, range, compare));
  } catch (err) {
    if (err instanceof PeriodError) return error(res, 400, err.message);
    console.error("Error loading dashboard period:", err);
    return error(res, 500, "Failed to load dashboard", err.message);
  }
};

const trends = async (req, res) => {
  try {
    return success(res, 200, "Dashboard trends", computeTrends(await loadLedger(models), todayIST(), 6));
  } catch (err) {
    console.error("Error loading dashboard trends:", err);
    return error(res, 500, "Failed to load dashboard", err.message);
  }
};

module.exports = { overview, period, trends };
