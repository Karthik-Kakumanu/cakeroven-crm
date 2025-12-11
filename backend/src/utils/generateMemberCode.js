// src/utils/generateMemberCode.js
const db = require("../config/db");

async function generateMemberCode() {
  // Try sequence first
  try {
    const seqRes = await db.query("SELECT nextval('member_seq') as v");
    if (seqRes && seqRes.rows && seqRes.rows[0]) {
      const num = Number(seqRes.rows[0].v) || 0;
      return `CR${String(num).padStart(4, "0")}`;
    }
  } catch (err) {
    // ignore: sequence may not exist
  }

  // fallback: incremental based on last user row
  const result = await db.query("SELECT member_code FROM users ORDER BY id DESC LIMIT 1");
  let nextNumber = 1;
  if (result.rows.length > 0) {
    const lastCode = result.rows[0].member_code || "";
    const numPart = parseInt(lastCode.replace(/\D/g, ""), 10);
    if (!isNaN(numPart)) nextNumber = numPart + 1;
  }
  return `CR${String(nextNumber).padStart(4, "0")}`;
}

module.exports = generateMemberCode;
