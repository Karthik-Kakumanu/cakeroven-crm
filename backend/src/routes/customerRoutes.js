// backend/src/routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// sanity-check
if (!customerController || typeof customerController !== "object") {
  console.error("ERROR: Could not load customerController. Check path/backend/src/controllers/customerController.js");
}
if (typeof customerController.register !== "function") {
  console.error("ERROR: customerController.register is not a function");
}
if (typeof customerController.getCard !== "function") {
  console.error("ERROR: customerController.getCard is not a function");
}

// Public customer routes - pass function references (NO parentheses)
router.post("/register", customerController.register);
router.get("/card/:memberCode", customerController.getCard);

module.exports = router;
