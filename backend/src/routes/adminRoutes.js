// src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

/**
 * Helper to wrap async route handlers and forward errors to Express error handler.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * PUBLIC
 */
router.post("/login", asyncHandler(adminController.login));

/**
 * PROTECTED ADMIN ROUTES (require adminAuth middleware)
 *
 * - GET  /customers                 -> list all customers + loyalty data
 * - POST /add-stamp                 -> add one stamp to member (body: { memberCode })
 * - POST /remove-stamp              -> remove one stamp (undo) (body: { memberCode })
 * - GET  /reward-history/:memberCode-> reward history for a member
 * - GET  /export-customers.csv      -> CSV export of customers (attachment)
 */
router.get("/customers", adminAuth, asyncHandler(adminController.getCustomers));
router.post("/add-stamp", adminAuth, asyncHandler(adminController.addStamp));
router.post("/remove-stamp", adminAuth, asyncHandler(adminController.removeStamp));

// optional: reward history and CSV export
router.get("/reward-history/:memberCode", adminAuth, asyncHandler(adminController.getRewardHistoryFor));
router.get("/export-customers.csv", adminAuth, asyncHandler(adminController.exportCustomersCsv));

module.exports = router;
