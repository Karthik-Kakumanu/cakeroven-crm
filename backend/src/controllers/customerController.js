// backend/src/controllers/customerController.js
const db = require("../config/db");
const generateMemberCode = require("../utils/generateMemberCode");

// POST /api/customer/register
exports.register = async (req, res) => {
  try {
    const { name, phone, dob } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    // CHECK IF PHONE ALREADY EXISTS
    const existing = await db.query(
      "SELECT member_code FROM users WHERE phone = $1",
      [phone]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "You are already a CakeRoven member. Please click Existing User.",
        existingMemberCode: existing.rows[0].member_code
      });
    }

    // generate CRxxxx ID
    const memberCode = await generateMemberCode();

    const insertUser = await db.query(
      "INSERT INTO users (member_code, name, phone, dob) VALUES ($1, $2, $3, $4) RETURNING id",
      [memberCode, name, phone, dob || null]
    );

    const userId = insertUser.rows[0].id;

    await db.query(
      "INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards) VALUES ($1, 0, 0)",
      [userId]
    );

    return res.status(201).json({
      message: "Registered successfully",
      card: {
        memberCode,
        name,
        phone,
        dob,
        currentStamps: 0,
        totalRewards: 0
      }
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// POST /api/customer/login-by-phone
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone)
      return res.status(400).json({ message: "Phone is required" });

    const result = await db.query(
      `SELECT u.member_code, u.name, u.phone, u.dob,
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Phone number not registered. Please register first."
      });
    }

    return res.json({ card: result.rows[0] });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// GET /api/customer/card/:memberCode
exports.getCardByMemberCode = async (req, res) => {
  try {
    const { memberCode } = req.params;

    const result = await db.query(
      `SELECT u.member_code, u.name, u.phone, u.dob,
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1`,
      [memberCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Card not found" });
    }

    const u = result.rows[0];

    return res.json({
      card: {
        memberCode: u.member_code,
        name: u.name,
        phone: u.phone,
        dob: u.dob,
        currentStamps: u.current_stamps,
        totalRewards: u.total_rewards,
      },
    });
  } catch (err) {
    console.error("Get card error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
