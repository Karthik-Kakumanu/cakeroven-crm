// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes");

app.use("/api/admin", adminRoutes);
app.use("/api/customer", customerRoutes);

// health
app.get("/", (req, res) => res.json({ ok: true, message: "CRM backend running" }));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
