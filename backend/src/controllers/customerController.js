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
      // 1. Check existing
      const ex = await client.query("SELECT id, member_code FROM users WHERE phone = $1 LIMIT 1", [trimmedPhone]);
      if (ex.rows.length > 0) {
        return { status: 409, body: { message: "This phone number is already registered. Please Login." } };
      }

      // 2. Generate Code logic
      await client.query("CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1");
      
      // Calculate next ID safely
      const maxRes = await client.query("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM users");
      const nextId = maxRes.rows[0].next_id;
      
      // Generate CR code based on sequence or ID
      const memberCode = `CR${String(nextId).padStart(4, '0')}`;

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

// --- Login By Phone ---
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone is required" });

    const trimmedPhone = phone.trim();

    // ✅ FIX: Use LEFT JOIN so we find the user even if loyalty_account is missing (rare bug fix)
    const userRes = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, 
              COALESCE(l.current_stamps, 0) as current_stamps, 
              COALESCE(l.total_rewards, 0) as total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts l ON l.user_id = u.id
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
       WHERE u.member_code = $1 AND u.phone = $2`,
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

// --- Add Online Stamp ---
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

      // Logic: Amount < 1000 -> No Stamp
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

      // Logic: Stamps >= 11 -> No Stamp (Manual only)
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

      // Logic: Add Stamp
      const newStamps = currentStamps + 1;
      
      // Update Account
      await client.query("UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2", [newStamps, user.id]);
      
      // ✅ FIX: Delete existing history for this index to prevent duplicate dates
      await client.query("DELETE FROM stamps_history WHERE user_id = $1 AND stamp_index = $2", [user.id, newStamps]);
      
      // Insert New History
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