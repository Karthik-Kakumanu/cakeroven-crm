// backend/src/controllers/customerController.js
const db = require("../config/db");
const generateMemberCode = require("../utils/generateMemberCode");

/**
 * Register a new customer
 * POST /api/customer/register
 * body: { name, phone, dob }
 */
// registerCustomer - robust atomic implementation
exports.registerCustomer = async (req, res) => {
  const { name, phone, dob } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: "Name and phone are required" });
  }
  const trimmedPhone = phone.trim();

  try {
    const result = await db.withClient(async (client) => {
      // 1) check if phone already exists
      const ex = await client.query("SELECT id, member_code FROM users WHERE phone = $1 LIMIT 1", [trimmedPhone]);
      if (ex.rows.length > 0) {
        return { status: 409, body: { message: "This phone number is already registered. Use Existing User." } };
      }

      // 2) ensure sequence exists and position it safely
      await client.query("CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1");
      // make seq at least max(existing)
      const maxRes = await client.query("SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(member_code, '\\D','','g') AS INTEGER)), 0) AS maxnum FROM users");
      const maxNum = maxRes.rows && maxRes.rows[0] ? Number(maxRes.rows[0].maxnum) : 0;
      if (maxNum > 0) {
        await client.query("SELECT setval('member_seq', $1, true)", [maxNum]);
      }

      // 3) get next sequence value (atomic)
      const seqR = await client.query("SELECT nextval('member_seq') AS v");
      const seqVal = seqR.rows && seqR.rows[0] ? Number(seqR.rows[0].v) : null;
      const memberCode = `CR${String(seqVal || (maxNum + 1)).padStart(4, '0')}`;

      // 4) insert user and loyalty row in same transaction
      const uIns = await client.query(
        `INSERT INTO users (member_code, name, phone, dob, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, member_code, name, phone`,
        [memberCode, name.trim(), trimmedPhone, dob || null]
      );
      const user = uIns.rows[0];

      await client.query(
        `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
         VALUES ($1, 0, 0, NOW())`,
        [user.id]
      );

      return {
        status: 201,
        body: {
          message: "Registration successful",
          card: {
            memberCode: user.member_code,
            name: user.name,
            phone: user.phone,
            currentStamps: 0,
            totalRewards: 0,
          },
        },
      };
    });

    // Return result from withClient
    if (result && result.status && result.body) {
      return res.status(result.status).json(result.body);
    }
    // fallback
    return res.status(500).json({ message: "Server error registering user — unknown result" });
  } catch (err) {
    console.error("Register customer error:", err);
    // return helpful error to client for now to help debug
    return res.status(500).json({ message: "Server error", error: err && err.message ? err.message : err });
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
