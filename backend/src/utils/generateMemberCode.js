// src/utils/generateMemberCode.js
// Robust generator using a DB sequence named `member_seq`.
// - Creates sequence if missing
// - Ensures sequence value is set to max(existing codes) if needed to avoid collisions
// - Exposes forceRestartSequence(n) for manual sequence reset (be careful!)

const db = require("../config/db");

async function ensureSequenceExists(clientOrDb) {
  // clientOrDb may be a client (with .query) or db helper (with .query)
  const q = `CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`;
  await clientOrDb.query(q);
}

async function getSeqNext(clientOrDb) {
  const r = await clientOrDb.query("SELECT nextval('member_seq') AS v");
  return r.rows && r.rows[0] ? Number(r.rows[0].v) : null;
}

async function getMaxMemberNumber(clientOrDb) {
  // returns numeric part of the highest existing member_code (or 0)
  const r = await clientOrDb.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(member_code, '\\D', '', 'g') AS INTEGER)), 0) as maxnum FROM users`
  );
  return r.rows && r.rows[0] ? Number(r.rows[0].maxnum) : 0;
}

/**
 * Return a formatted member code string like CR0001
 */
function formatCode(num) {
  return `CR${String(num).padStart(4, "0")}`;
}

/**
 * Main generator function — gets nextval from member_seq.
 * If sequence is missing it creates it, and if sequence value would collide
 * with existing member_codes it will set the sequence to max(existing)+1 first.
 */
async function generateMemberCode() {
  // We will use top-level db.query (not transaction) here.
  // If you call from inside a transaction, prefer using client directly.
  await ensureSequenceExists(db);

  // Ensure sequence is not behind existing codes
  const maxNum = await getMaxMemberNumber(db);
  // last_value may exist; we will set sequence to maxNum if sequence < maxNum
  try {
    const seqStatus = await db.query("SELECT last_value, is_called FROM member_seq");
    if (seqStatus && seqStatus.rows && seqStatus.rows[0]) {
      const last = Number(seqStatus.rows[0].last_value || 0);
      if (last < maxNum) {
        // set sequence to maxNum (so nextval returns maxNum+1)
        await db.query("SELECT setval('member_seq', $1, true)", [maxNum]);
      }
    } else {
      // If we couldn't read last_value, ensure sequence set to maxNum
      if (maxNum > 0) await db.query("SELECT setval('member_seq', $1, true)", [maxNum]);
    }
  } catch (err) {
    // If reading last_value failed (older PG or permission) just ensure setval
    if (maxNum > 0) {
      try {
        await db.query("SELECT setval('member_seq', $1, true)", [maxNum]);
      } catch (e) {
        // ignore - we will still try nextval below and fallback if needed
      }
    }
  }

  // Now get next value
  const val = await getSeqNext(db);
  if (!val || Number.isNaN(val)) {
    // fallback: compute next from maxMemberNumber + 1
    const fallback = (await getMaxMemberNumber(db)) + 1;
    return formatCode(fallback);
  }
  return formatCode(val);
}

/**
 * Force restart sequence to a given start (integer).
 * Use only when you are sure there are no collisions (existing member_code values).
 * Example: await forceRestartSequence(1) will make next nextval = 1 -> CR0001
 */
async function forceRestartSequence(start = 1) {
  if (!Number.isInteger(start) || start < 1) throw new Error("start must be integer >= 1");
  await ensureSequenceExists(db);
  // We want next nextval to return `start`, but setval sets last_value so nextval returns last_value+1
  // So set last_value = start - 1 and mark called = true
  const setTo = start - 1;
  await db.query("SELECT setval('member_seq', $1, true)", [setTo]);
}

/**
 * Utility to read seq current state (for debug)
 */
async function readSequenceState() {
  try {
    const r = await db.query("SELECT last_value, is_called FROM member_seq");
    return r.rows && r.rows[0] ? r.rows[0] : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateMemberCode,
  forceRestartSequence,
  readSequenceState,
};
