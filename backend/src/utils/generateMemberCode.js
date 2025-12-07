// backend/src/utils/generateMemberCode.js
const db = require("../config/db");

async function generateMemberCode() {
  // get last member_code, e.g. "CR0007"
  const result = await db.query(
    "SELECT member_code FROM users ORDER BY id DESC LIMIT 1"
  );

  let nextNumber = 1;

  if (result.rows.length > 0) {
    const lastCode = result.rows[0].member_code; // "CR0007"
    const numPart = parseInt(lastCode.replace(/\D/g, ""), 10); // 7
    if (!isNaN(numPart)) {
      nextNumber = numPart + 1;
    }
  }

  const padded = String(nextNumber).padStart(4, "0"); // "0001"
  return `CR${padded}`; // CR0001
}

module.exports = generateMemberCode;
