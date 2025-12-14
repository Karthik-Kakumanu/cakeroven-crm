const express = require("express");
const router = express.Router();
const customer = require("../controllers/customerController");

// New registration
router.post("/register", customer.registerCustomer);

// Existing user login by phone
router.post("/login-by-phone", customer.loginByPhone);

// Secure card fetch – needs BOTH member code + phone
router.get("/card/:memberCode", customer.getCard);

// ✅ NEW: Online payment stamp endpoint
router.post("/add-online-stamp", customer.addOnlineStamp);

module.exports = router;