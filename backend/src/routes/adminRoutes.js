// src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

router.post("/login", adminController.login);

// Protected admin endpoints
router.get("/customers", adminAuth, adminController.getCustomers);
router.post("/add-stamp", adminAuth, adminController.addStamp);
router.post("/remove-stamp", adminAuth, adminController.removeStamp);

module.exports = router;
