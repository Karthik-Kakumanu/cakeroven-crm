// backend/src/config/db.js
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL is not set in environment");
  // still export a pool to fail loudly on startup
}

const pool = new Pool({
  connectionString,
  // optional: adjust SSL for cloud providers
  // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected idle client error", err);
});

/**
 * Simple query wrapper
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a function with a client inside a transaction.
 * fn must be async and receive a client.
 */
async function withClient(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {
      console.error("Rollback error:", e);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  withClient,
};
