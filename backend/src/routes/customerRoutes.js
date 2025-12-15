const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// Register a new user
router.post("/register", customerController.registerCustomer);

// ✅ FIX: Ensure this route exists for Login
router.post("/login-by-phone", customerController.loginByPhone);

// Get specific card details
router.get("/card/:memberCode", customerController.getCard);

// Add stamp via online payment
router.post("/add-online-stamp", customerController.addOnlineStamp);

module.exports = router;