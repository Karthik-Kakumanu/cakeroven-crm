// backend/src/config/db.js
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL is not set in environment");
}

const pool = new Pool({
  connectionString,
  // If your provider requires SSL and self-signed certs enable:
  // ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected idle client error", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

/**
 * withClient: run fn(client) inside a transaction. fn must be async.
 * Ensures BEGIN / COMMIT / ROLLBACK and always releases client.
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
