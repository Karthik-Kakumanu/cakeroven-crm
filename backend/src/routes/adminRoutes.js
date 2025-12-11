// backend/src/routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const customer = require("../controllers/customerController");

router.post("/register", customer.register);
router.post("/login-by-phone", customer.loginByPhone);
router.get("/card/:memberCode", customer.getCard);

module.exports = router;
