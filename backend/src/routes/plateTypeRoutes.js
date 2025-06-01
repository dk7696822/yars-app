"use strict";

const express = require("express");
const router = express.Router();
const plateTypeController = require("../controllers/plateTypeController");

router.post("/", plateTypeController.createPlateType);
router.get("/", plateTypeController.getAllPlateTypes);
router.get("/:id", plateTypeController.getPlateTypeById);
router.put("/:id", plateTypeController.updatePlateType);
router.delete("/:id", plateTypeController.deletePlateType);

module.exports = router;
