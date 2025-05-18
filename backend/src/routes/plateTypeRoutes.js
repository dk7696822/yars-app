"use strict";

const express = require("express");
const router = express.Router();
const plateTypeController = require("../controllers/plateTypeController");

// Create a new plate type
router.post("/", plateTypeController.createPlateType);

// Get all plate types
router.get("/", plateTypeController.getAllPlateTypes);

// Get a plate type by ID
router.get("/:id", plateTypeController.getPlateTypeById);

// Update a plate type
router.put("/:id", plateTypeController.updatePlateType);

// Delete a plate type (soft delete)
router.delete("/:id", plateTypeController.deletePlateType);

module.exports = router;
