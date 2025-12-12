// backend/src/controllers/customerController.js
const db = require("../config/db");

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
    const existing = await db.query(
      "SELECT id, member_code, name, phone FROM users WHERE phone = $1",
      [trimmedPhone]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered. Use Existing User.",
      });
    }

    // Create user
    const userRes = await db.query(
      `INSERT INTO users (name, phone, dob)
       VALUES ($1, $2, $3)
       RETURNING id, member_code, name, phone`,
      [name.trim(), trimmedPhone, dob || null]
    );

    const user = userRes.rows[0];

    // Create loyalty account row
    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1, 0, 0)`,
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
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Existing user login by phone
 * POST /api/customer/login-by-phone
 * body: { phone }
 */
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone is required" });
    }

    const trimmedPhone = phone.trim();

    const userRes = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone,
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.phone = $1`,
      [trimmedPhone]
    );

    if (userRes.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No customer found with this phone number" });
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
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Secure card fetch – MUST match both memberCode AND phone
 * GET /api/customer/card/:memberCode?phone=XXXXXXXXXX
 */
exports.getCard = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phone = (req.query.phone || "").trim();

    if (!memberCode || !phone) {
      return res
        .status(400)
        .json({ message: "Member code and phone are required" });
    }

    const cardRes = await db.query(
      `SELECT u.member_code, u.name, u.phone,
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1 AND u.phone = $2`,
      [memberCode, phone]
    );

    if (cardRes.rows.length === 0) {
      // Either wrong code, wrong phone or they don't belong together
      return res
        .status(404)
        .json({ message: "Card not found for this member & phone" });
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
    res.status(500).json({ message: "Server error" });
  }
};
