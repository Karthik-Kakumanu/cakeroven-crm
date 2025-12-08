// backend/src/app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const customerRoutes = require("./routes/customerRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// ====== GLOBAL MIDDLEWARE ======
// open CORS while you are testing – frontend & admin both can call
app.use(cors());
app.use(express.json());

// ====== SIMPLE TEST ROUTES ======
app.get("/", (req, res) => {
  res.send("CakeRoven CRM Backend is running ✅");
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ ok: true, time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});

app.get("/check-users", async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM users");
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});

// ====== API ROUTES ======
app.use("/api/customer", customerRoutes);
app.use("/api/admin", adminRoutes);

// ====== START SERVER ======
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
