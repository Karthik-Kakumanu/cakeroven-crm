// src/routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

router.post("/register", customerController.register);
router.post("/login-by-phone", customerController.loginByPhone);
router.get("/card/:memberCode", customerController.getCard);

module.exports = router;
