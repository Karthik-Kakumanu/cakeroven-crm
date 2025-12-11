// tools/hashPassword.js
const bcrypt = require("bcryptjs");

async function run() {
  const password = process.argv[2];
  if (!password) {
    console.log("Usage: node tools/hashPassword.js <password>");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  console.log("Password:", password);
  console.log("Generated bcrypt hash:");
  console.log(hash);
}
run();
