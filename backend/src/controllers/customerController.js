const db = require("../config/db");
const generateMemberCode = require("../utils/generateMemberCode");

// --- Register Customer ---
exports.registerCustomer = async (req, res) => {
  const { name, phone, dob } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: "Name and phone are required" });
  }
  const trimmedPhone = phone.trim();

  try {
    const result = await db.withClient(async (client) => {
      // 1. Check existing
      const ex = await client.query("SELECT id, member_code FROM users WHERE phone = $1 LIMIT 1", [trimmedPhone]);
      if (ex.rows.length > 0) {
        return { status: 409, body: { message: "This phone number is already registered. Use Existing User." } };
      }

      // 2. Sequence Logic
      await client.query("CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1");
      const maxRes = await client.query("SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(member_code, '\\D','','g') AS INTEGER)), 0) AS maxnum FROM users");
      const maxNum = maxRes.rows && maxRes.rows[0] ? Number(maxRes.rows[0].maxnum) : 0;
      if (maxNum > 0) {
        await client.query("SELECT setval('member_seq', $1, true)", [maxNum]);
      }

      // 3. Generate Code
      const seqR = await client.query("SELECT nextval('member_seq') AS v");
      const seqVal = seqR.rows && seqR.rows[0] ? Number(seqR.rows[0].v) : null;
      const memberCode = `CR${String(seqVal || (maxNum + 1)).padStart(4, '0')}`;

      // 4. Insert User
      const uIns = await client.query(
        `INSERT INTO users (member_code, name, phone, dob, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, member_code, name, phone`,
        [memberCode, name.trim(), trimmedPhone, dob || null]
      );
      const user = uIns.rows[0];

      // 5. Create Loyalty Account
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

    if (result && result.status && result.body) {
      return res.status(result.status).json(result.body);
    }
    return res.status(500).json({ message: "Server error registering user" });
  } catch (err) {
    console.error("Register customer error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// --- Login By Phone ---
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

// --- Get Card ---
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

// --- Add Online Stamp (Payment Logic) ---
exports.addOnlineStamp = async (req, res) => {
  const { memberCode, amount, paymentId } = req.body;

  // 1. Allow ANY positive amount
  if (!memberCode || !amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid request. Amount must be valid." });
  }

  try {
    const result = await db.withClient(async (client) => {
      // 1. Lock User
      const uRes = await client.query("SELECT id, member_code, name, phone FROM users WHERE member_code = $1 FOR UPDATE", [memberCode]);
      if (uRes.rows.length === 0) throw { status: 404, message: "User not found" };
      const user = uRes.rows[0];

      // 2. Lock Loyalty
      const lRes = await client.query("SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE", [user.id]);
      let currentStamps = 0;
      let totalRewards = 0;
      if (lRes.rows.length > 0) {
        currentStamps = Number(lRes.rows[0].current_stamps || 0);
        totalRewards = Number(lRes.rows[0].total_rewards || 0);
      } else {
         await client.query("INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards) VALUES ($1,0,0)", [user.id]);
      }

      // --- LOGIC SCENARIOS ---

      // Scenario A: Payment is LESS THAN 1000
      // Logic: Do NOT add stamp. Return specific reason so frontend shows "Sorry" message.
      if (amount < 1000) {
        return {
          status: 200,
          body: {
            message: "Payment successful (No Stamp).",
            card: { memberCode: user.member_code, name: user.name, phone: user.phone, currentStamps, totalRewards },
            stampAdded: false,
            reason: "low_amount"
          }
        };
      }

      // Scenario B: Payment >= 1000 BUT User has 11 stamps
      // Logic: Do NOT add stamp. 12th must be manual.
      if (currentStamps >= 11) {
        return {
          status: 200,
          body: {
            message: "Payment successful (Limit Reached).",
            card: { memberCode: user.member_code, name: user.name, phone: user.phone, currentStamps, totalRewards },
            stampAdded: false,
            reason: "limit_reached"
          }
        };
      }

      // Scenario C: Payment >= 1000 AND Stamps < 11
      // Logic: ADD STAMP.
      const newStamps = currentStamps + 1;
      
      // Update Database (Persistence)
      await client.query("UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2", [newStamps, user.id]);
      
      // Record History (For Admin Dashboard)
      await client.query("INSERT INTO stamps_history (user_id, stamp_index, created_at) VALUES ($1, $2, NOW())", [user.id, newStamps]);

      return {
        status: 200,
        body: {
          message: "Stamp added automatically.",
          card: { memberCode: user.member_code, name: user.name, phone: user.phone, currentStamps: newStamps, totalRewards },
          stampAdded: true,
          reason: "success"
        }
      };
    });

    return res.status(result.status).json(result.body);

  } catch (err) {
    console.error("addOnlineStamp error:", err);
    return res.status(500).json({ message: "Server error processing payment." });
  }
};