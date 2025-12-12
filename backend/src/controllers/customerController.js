// backend/src/controllers/customerController.js
const db = require("../config/db");
const generateMemberCode = require("../utils/generateMemberCode");

/**
 * Register a new customer
 * POST /api/customer/register
 * body: { name, phone, dob }
 */
exports.registerCustomer = async (req, res) => {
  try {
    const { name, phone, dob } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    const trimmedPhone = phone.trim();

    // Check if phone already exists
    const existing = await db.query("SELECT id, member_code, name, phone FROM users WHERE phone = $1", [trimmedPhone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "This phone number is already registered. Use Existing User." });
    }

    // generate member code
    const memberCode = await generateMemberCode();

    // Create user with member_code
    const userRes = await db.query(
      `INSERT INTO users (member_code, name, phone, dob)
       VALUES ($1, $2, $3, $4)
       RETURNING id, member_code, name, phone`,
      [memberCode, name.trim(), trimmedPhone, dob || null]
    );

    const user = userRes.rows[0];

    // Create loyalty account row
    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
       VALUES ($1, 0, 0, NOW())`,
      [user.id]
    );

    return res.status(201).json({
      message: "Registration successful",
      card: {
        memberCode: user.member_code,
        name: user.name,
        phone: user.phone,
        currentStamps: 0,
        totalRewards: 0,
      },
    });
  } catch (error) {
    console.error("Register customer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone is required" });

    const trimmedPhone = phone.trim();

    const userRes = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.phone = $1`,
      [trimmedPhone]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "No customer found with this phone number" });
    }

    const row = userRes.rows[0];

    return res.json({
      message: "Login successful",
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        currentStamps: row.current_stamps,
        totalRewards: row.total_rewards,
      },
    });
  } catch (error) {
    console.error("Login by phone error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCard = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phone = (req.query.phone || "").trim();

    if (!memberCode || !phone) return res.status(400).json({ message: "Member code and phone are required" });

    const cardRes = await db.query(
      `SELECT u.member_code, u.name, u.phone, l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1 AND u.phone = $2`,
      [memberCode, phone]
    );

    if (cardRes.rows.length === 0) {
      return res.status(404).json({ message: "Card not found for this member & phone" });
    }

    const row = cardRes.rows[0];

    return res.json({
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        currentStamps: row.current_stamps,
        totalRewards: row.total_rewards,
      },
    });
  } catch (error) {
    console.error("Get card error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
