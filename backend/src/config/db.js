// backend/src/config/db.js
// Postgres pool wrapper for Render / Railway
// Make sure DATABASE_URL is set in your environment.

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

const pool = new Pool({
  connectionString,
  // If your host requires SSL, enable while keeping rejectUnauthorized false:
  // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 12,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

/**
 * Basic query helper (delegates to pool.query)
 * Use: const { query } = require('./config/db'); await query(sql, params)
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
