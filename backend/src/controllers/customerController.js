// backend/src/controllers/customerController.js
const db = require("../config/db");

// REGISTER NEW CUSTOMER
exports.register = async (req, res) => {
  try {
    const { name, phone, dob } = req.body;

    if (!name || !phone || !dob) {
      return res
        .status(400)
        .json({ message: "Name, phone and date of birth are required." });
    }

    const cleanedPhone = phone.trim();

    const exists = await db.query(
      "SELECT id, member_code FROM users WHERE phone = $1",
      [cleanedPhone]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({
        message:
          "This phone is already registered. Please use Existing User option.",
      });
    }

    // generate member code like CR0001
    const next = await db.query(
      "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users"
    );
    const nextId = next.rows[0].next_id;
    const memberCode = "CR" + String(nextId).padStart(4, "0");

    const insertUser = await db.query(
      `INSERT INTO users (name, phone, dob, member_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, dob, member_code`,
      [name.trim(), cleanedPhone, dob, memberCode]
    );

    const user = insertUser.rows[0];

    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1, 0, 0)`,
      [user.id]
    );

    return res.status(201).json({
      message: "User registered successfully",
      card: {
        memberCode: user.member_code,
        name: user.name,
        phone: user.phone,
        dob: user.dob,
        currentStamps: 0,
        totalRewards: 0,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// LOGIN BY PHONE (EXISTING USER)
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanedPhone = (phone || "").trim();

    if (!cleanedPhone) {
      return res.status(400).json({ message: "Phone is required." });
    }

    const result = await db.query(
      `SELECT u.id, u.name, u.phone, u.dob, u.member_code,
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.phone = $1`,
      [cleanedPhone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const row = result.rows[0];

    return res.json({
      message: "Login success",
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        dob: row.dob,
        currentStamps: row.current_stamps,
        totalRewards: row.total_rewards,
      },
    });
  } catch (err) {
    console.error("Login-by-phone error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// SECURE CARD FETCH – memberCode + phone must match
exports.getCardByMemberCode = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phone = (req.query.phone || "").trim();

    if (!memberCode) {
      return res.status(400).json({ message: "Member code is required." });
    }

    if (!phone) {
      return res.status(400).json({ message: "Phone is required." });
    }

    const result = await db.query(
      `SELECT u.name,
              u.phone,
              u.dob,
              u.member_code,
              l.current_stamps,
              l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1 AND u.phone = $2`,
      [memberCode, phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Card not found. Member ID and phone do not match.",
      });
    }

    const row = result.rows[0];

    return res.json({
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        dob: row.dob,
        currentStamps: row.current_stamps,
        totalRewards: row.total_rewards,
      },
    });
  } catch (err) {
    console.error("Get card by member error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
