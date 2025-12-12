// backend/src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

router.post("/login", adminController.login);

// Protected admin endpoints
router.get("/customers", adminAuth, adminController.getCustomers);
router.post("/add-stamp", adminAuth, adminController.addStamp);
router.post("/remove-stamp", adminAuth, adminController.removeStamp);
router.get("/rewards/:memberCode", adminAuth, adminController.getRewardHistoryFor);

// NEW: insights endpoint
router.get("/insights", adminAuth, adminController.getInsights);

module.exports = router;
