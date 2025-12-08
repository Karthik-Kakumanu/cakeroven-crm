// backend/src/routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const customer = require("../controllers/customerController");

// Public customer routes
router.post("/register", customer.register);
router.post("/login-by-phone", customer.loginByPhone);

// Secure card fetch – still uses memberCode in the URL,
// but ALSO requires correct phone via query (?phone=...)
router.get("/card/:memberCode", customer.getCardByMemberCode);

module.exports = router;
