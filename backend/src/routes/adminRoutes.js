const express = require("express");
const router = express.Router();
const admin = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

// Public
router.post("/login", admin.login);

// Protected
router.get("/customers", adminAuth, admin.getCustomers);
router.post("/add-stamp", adminAuth, admin.addStamp);
router.post("/remove-stamp", adminAuth, admin.removeStamp); // 👈 new

module.exports = router;
