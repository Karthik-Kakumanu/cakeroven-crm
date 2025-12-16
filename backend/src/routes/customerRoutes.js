const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// Register a new user
router.post("/register", customerController.registerCustomer);

// Login
router.post("/login-by-phone", customerController.loginByPhone);

// Get specific card details
router.get("/card/:memberCode", customerController.getCard);

// ✅ NEW: This matches what your Frontend is calling
router.post("/create-order", customerController.createOrder);

// Add stamp via online payment
router.post("/add-online-stamp", customerController.addOnlineStamp);

module.exports = router;