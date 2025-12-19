// backend/src/app.js
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

// ✅ Import Controllers directly
const customerController = require("./controllers/customerController");
const adminController = require("./controllers/adminController");

const app = express();
const port = process.env.PORT || 4000;

const adminAuth = require("./middleware/adminAuth");


// Trust proxy when behind a reverse proxy (Render, Railway, etc.)
if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/**
 * Middlewares
 */
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/**
 * Serve frontend (optional)
 */
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, "..", "frontend", "dist");
if (process.env.SERVE_FRONTEND === "true") {
  app.use(express.static(frontendDist));
}

/**
 * Helper: async handler (no external dependency)
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * =================================================================
 * ✅ ROUTES
 * =================================================================
 */

// --- CUSTOMER ROUTES ---
app.post("/api/customer/register", customerController.registerCustomer);
app.post("/api/customer/login-by-phone", customerController.loginByPhone);
app.get("/api/customer/card/:memberCode", customerController.getCard);
// Payment & Stamps
app.post("/api/customer/create-order", customerController.createOrder);
app.post("/api/customer/add-online-stamp", customerController.addOnlineStamp);

// --- ADMIN ROUTES ---
app.post("/api/admin/login", adminController.login);
app.get("/api/admin/search", adminController.searchCustomer);
// ✅ FIXED: Added this missing route that was causing the 404 error
app.get("/api/admin/customers", adminController.getCustomers); 
app.post("/api/admin/stamp", adminController.addStamp);
app.post("/api/admin/reset", adminController.resetStamps);
app.get("/api/admin/insights", adminController.getInsights);
app.post(
  "/api/admin/delete-transactions-by-date",
  adminAuth,
  adminController.deleteTransactionsByDate
);


/**
 * Health checks + root
 */
app.get("/healthz", (req, res) =>
  res.json({
    ok: true,
    message: "CRM backend healthy",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
  })
);

app.get("/", (req, res) => res.json({ ok: true, message: "CRM backend running" }));

/**
 * 404 handler
 */
app.use((req, res, next) => {
  if (process.env.SERVE_FRONTEND === "true" && req.accepts("html")) {
    return res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next();
    });
  }
  res.status(404).json({ message: "Not Found" });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);

  const status = err && err.status ? err.status : 500;
  const message = status === 500 ? "Internal server error" : err.message || "Something went wrong";

  const payload = { message };
  if (process.env.NODE_ENV !== "production") {
    payload.error = err && err.stack ? err.stack : err;
  }

  res.status(status).json(payload);
});

/**
 * Start server with graceful shutdown
 */
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port} (env=${process.env.NODE_ENV || "dev"})`);
});

function shutdown(signal) {
  console.log(`Received ${signal}. Closing HTTP server...`);
  server.close((err) => {
    if (err) {
      console.error("Error during server close:", err);
      process.exit(1);
    }
    console.log("Server closed. Exiting.");
    process.exit(0);
  });

  setTimeout(() => {
    console.warn("Forcing shutdown.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));