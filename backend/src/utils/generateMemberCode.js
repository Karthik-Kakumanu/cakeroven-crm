// src/utils/generateMemberCode.js
// Robust generator using DB sequence 'member_seq'.
// Creates sequence if missing and ensures sequence is at least max(existing)+1.

const db = require("../config/db");

function formatCode(num) {
  return `CR${String(num).padStart(4, "0")}`;
}

async function ensureSequenceExists() {
  await db.query("CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1");
}

async function getMaxExisting() {
  const r = await db.query("SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(member_code, '\\D','','g') AS INTEGER)), 0) AS maxnum FROM users");
  return r.rows && r.rows[0] ? Number(r.rows[0].maxnum) : 0;
}

async function next() {
  await ensureSequenceExists();
  // Make sure sequence isn't behind existing max (avoids duplicates)
  const maxNum = await getMaxExisting();
  try {
    const status = await db.query("SELECT last_value, is_called FROM member_seq");
    const last = status.rows && status.rows[0] ? Number(status.rows[0].last_value || 0) : 0;
    if (last < maxNum) {
      // set last_value to maxNum so nextval -> maxNum+1
      await db.query("SELECT setval('member_seq', $1, true)", [maxNum]);
    }
  } catch (err) {
    // ignore read errors, but set to maxNum to be safe
    if (maxNum > 0) {
      try {
        await db.query("SELECT setval('member_seq', $1, true)", [maxNum]);
      } catch (e) {
        // swallow
      }
    }
  }

  // return nextval
  const r = await db.query("SELECT nextval('member_seq') AS v");
  const v = r.rows && r.rows[0] ? Number(r.rows[0].v) : null;
  if (!v || Number.isNaN(v)) {
    const fallback = (await getMaxExisting()) + 1;
    return formatCode(fallback);
  }
  return formatCode(v);
}

async function forceRestart(start = 1) {
  if (!Number.isInteger(start) || start < 1) throw new Error("start must be integer >=1");
  await ensureSequenceExists();
  // set last_value = start-1 so nextval returns start
  await db.query("SELECT setval('member_seq', $1, true)", [start - 1]);
}

module.exports = {
  generateMemberCode: next,
  forceRestartSequence: forceRestart,
};
