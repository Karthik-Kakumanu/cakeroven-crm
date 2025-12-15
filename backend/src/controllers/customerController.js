const db = require("../config/db");

// --- Register Customer ---
exports.registerCustomer = async (req, res) => {
  const { name, phone, dob } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: "Name and phone are required" });
  }
  const trimmedPhone = phone.trim();

  try {
    const result = await db.withClient(async (client) => {
      // ✅ STEP 1: CHECK DUPLICATE FIRST
      // We check this BEFORE asking for a new Member ID. 
      // This prevents "burning" a number if the user already exists.
      const ex = await client.query("SELECT id FROM users WHERE TRIM(phone) = $1 LIMIT 1", [trimmedPhone]);
      
      if (ex.rows.length > 0) {
        // Stop here! Do NOT touch the sequence.
        return { status: 409, body: { message: "This mobile number is already registered. Please Login." } };
      }

      // ✅ STEP 2: Generate CR Code (Only happens if phone is unique)
      await client.query("CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1");
      
      // Get the next strictly sequential number
      const seqRes = await client.query("SELECT nextval('member_seq') as val");
      const nextVal = seqRes.rows[0].val;
      const memberCode = `CR${String(nextVal).padStart(4, '0')}`;

      // 3. Insert User
      const uIns = await client.query(
        `INSERT INTO users (member_code, name, phone, dob, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, member_code, name, phone`,
        [memberCode, name.trim(), trimmedPhone, dob || null]
      );
      const user = uIns.rows[0];

      // 4. Create Loyalty Account
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

    if (result.status) return res.status(result.status).json(result.body);
    return res.status(500).json({ message: "Unknown error" });

  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// --- Login By Phone (Safe Read-Only) ---
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone is required" });

    const trimmedPhone = phone.trim();

    // ✅ This is a READ-ONLY search. It does NOT generate IDs.
    const userRes = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, 
              COALESCE(l.current_stamps, 0) as current_stamps, 
              COALESCE(l.total_rewards, 0) as total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE TRIM(u.phone) = $1`,
      [trimmedPhone]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "No customer found with this phone number. Please Register." });
    }

    const row = userRes.rows[0];

    return res.json({
      message: "Login successful",
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        currentStamps: Number(row.current_stamps),
        totalRewards: Number(row.total_rewards),
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Get Card ---
exports.getCard = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phone = (req.query.phone || "").trim();

    if (!memberCode || !phone) return res.status(400).json({ message: "Data missing" });

    const cardRes = await db.query(
      `SELECT u.member_code, u.name, u.phone, 
              COALESCE(l.current_stamps, 0) as current_stamps, 
              COALESCE(l.total_rewards, 0) as total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1 AND TRIM(u.phone) = $2`,
      [memberCode, phone]
    );

    if (cardRes.rows.length === 0) {
      return res.status(404).json({ message: "Card not found" });
    }

    const row = cardRes.rows[0];

    return res.json({
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        currentStamps: Number(row.current_stamps),
        totalRewards: Number(row.total_rewards),
      },
    });
  } catch (error) {
    console.error("GetCard Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Add Online Stamp (Safe) ---
exports.addOnlineStamp = async (req, res) => {
  const { memberCode, amount } = req.body;

  if (!memberCode || !amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  try {
    const result = await db.withClient(async (client) => {
      const uRes = await client.query("SELECT id, member_code, name, phone FROM users WHERE member_code = $1 FOR UPDATE", [memberCode]);
      if (uRes.rows.length === 0) throw { status: 404, message: "User not found" };
      const user = uRes.rows[0];

      const lRes = await client.query("SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE", [user.id]);
      
      let currentStamps = 0;
      let totalRewards = 0;
      
      if (lRes.rows.length > 0) {
        currentStamps = Number(lRes.rows[0].current_stamps || 0);
        totalRewards = Number(lRes.rows[0].total_rewards || 0);
      } else {
        await client.query("INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards) VALUES ($1,0,0)", [user.id]);
      }

      // 1. Amount Check
      if (amount < 1000) {
        return {
          status: 200,
          body: {
            message: "Payment success (No Stamp < 1000)",
            card: { ...user, currentStamps, totalRewards },
            stampAdded: false,
            reason: "low_amount"
          }
        };
      }

      // 2. Limit Check
      if (currentStamps >= 11) {
        return {
          status: 200,
          body: {
            message: "Payment success (12th stamp is manual)",
            card: { ...user, currentStamps, totalRewards },
            stampAdded: false,
            reason: "limit_reached"
          }
        };
      }

      // 3. Add Stamp
      const newStamps = currentStamps + 1;
      
      await client.query("UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2", [newStamps, user.id]);
      
      // Clear duplicate history for this index if any
      await client.query("DELETE FROM stamps_history WHERE user_id = $1 AND stamp_index = $2", [user.id, newStamps]);
      
      // Insert fresh history
      await client.query("INSERT INTO stamps_history (user_id, stamp_index, created_at) VALUES ($1, $2, NOW())", [user.id, newStamps]);

      return {
        status: 200,
        body: {
          message: "Stamp added!",
          card: { ...user, currentStamps: newStamps, totalRewards },
          stampAdded: true,
          reason: "success"
        }
      };
    });

    return res.status(result.status).json(result.body);

  } catch (err) {
    console.error("Online Stamp Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};