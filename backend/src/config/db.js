// backend/src/config/db.js
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const hasDiscretePgConfig =
  process.env.PGHOST &&
  process.env.PGDATABASE &&
  process.env.PGUSER &&
  process.env.PGPASSWORD &&
  process.env.PGPORT;

if (!connectionString && !hasDiscretePgConfig) {
  console.error("ERROR: Database config missing. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD/PGPORT");
}

const poolConfig = connectionString
  ? {
      connectionString,
      // If your provider requires SSL and self-signed certs enable:
      // ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT),
    };

const pool = new Pool(poolConfig);

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
