// src/app.js
require("dotenv").config();
require("express-async-errors"); // automatically forwards rejected promises to the error handler

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const port = process.env.PORT || 4000;

// Trust proxy when behind a reverse proxy (Render, Railway, etc.)
if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/**
 * Basic security + performance middleware
 */
app.use(helmet());
app.use(
  cors({
    // Allow your frontend origin in production by setting CORS_ORIGIN env var
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging (use 'combined' in production if desired)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/**
 * Rate limiting - light defaults to prevent abuse
 * Adjust windowMs / max as you see fit
 */
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/**
 * Serve built frontend (optional)
 * If you build frontend into ../frontend/dist (or specify FRONTEND_DIST),
 * the backend can serve the static files so visiting the root loads your app.
 */
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, "..", "frontend", "dist");
if (process.env.SERVE_FRONTEND === "true") {
  app.use(express.static(frontendDist));
}

/**
 * Routes
 */
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes");

app.use("/api/admin", adminRoutes);
app.use("/api/customer", customerRoutes);

/**
 * Health check
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
 * 404 handler for API routes and optionally for frontend
 */
app.use((req, res, next) => {
  // If serving frontend and path looks like asset or index, let static handle it
  if (process.env.SERVE_FRONTEND === "true" && req.accepts("html")) {
    // serve index.html for SPA routes (optional)
    return res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next();
    });
  }

  res.status(404).json({ message: "Not Found" });
});

/**
 * Centralized error handler
 * - logs error
 * - returns safe message to client
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);

  // for operational errors we might set err.status
  const status = err && err.status ? err.status : 500;
  const message =
    status === 500 ? "Internal server error" : err.message || "Something went wrong";

  // In development include the stack
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

  // force exit after 10s
  setTimeout(() => {
    console.warn("Forcing shutdown.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
