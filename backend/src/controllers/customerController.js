const db = require("../config/db");
const Razorpay = require("razorpay");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Register Customer ---
exports.registerCustomer = async (req, res) => {
  const { name, phone, dob } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: "Name and phone are required" });
  }
  const trimmedPhone = phone.trim();

  try {
    const result = await db.withClient(async (client) => {
      // 1. Check if phone exists
      const ex = await client.query("SELECT id FROM users WHERE TRIM(phone) = $1 LIMIT 1", [trimmedPhone]);
      if (ex.rows.length > 0) {
        return { status: 409, body: { message: "Phone number already exists. Please Login." } };
      }

      // 2. Generate CR Code
      await client.query("CREATE SEQUENCE IF NOT EXISTS member_seq START WITH 1 INCREMENT BY 1");
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

// --- Login By Phone ---
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone is required" });

    const trimmedPhone = phone.trim();

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

    const result = await db.withClient(async (client) => {
      // 1. Fetch User & Account
      const cardRes = await client.query(
        `SELECT u.id, u.member_code, u.name, u.phone, 
                COALESCE(l.current_stamps, 0) as current_stamps, 
                COALESCE(l.total_rewards, 0) as total_rewards
         FROM users u
         LEFT JOIN loyalty_accounts l ON l.user_id = u.id
         WHERE u.member_code = $1 AND TRIM(u.phone) = $2`,
        [memberCode, phone]
      );

      if (cardRes.rows.length === 0) return null;
      const row = cardRes.rows[0];

      // 2. Fetch History (Added Amount Column)
      const historyRes = await client.query(
        `SELECT stamp_index, amount, created_at 
         FROM stamps_history 
         WHERE user_id = $1 
         ORDER BY stamp_index ASC`,
        [row.id]
      );

      return {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        currentStamps: Number(row.current_stamps),
        totalRewards: Number(row.total_rewards),
        history: historyRes.rows // ✅ Send History to Frontend
      };
    });

    if (!result) return res.status(404).json({ message: "Card not found" });
    return res.json({ card: result });

  } catch (error) {
    console.error("GetCard Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Create Order (Razorpay) ---
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount) return res.status(400).json({ message: "Amount is required" });

    const options = {
      amount: amount * 100, // Convert to paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error("Razorpay Create Order Error:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

// --- Add Online Stamp (Updated with Transactions Table Logic) ---
exports.addOnlineStamp = async (req, res) => {
  const { memberCode, amount } = req.body;

  if (!memberCode || !amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const numAmount = Number(amount);

  try {
    const result = await db.withClient(async (client) => {
      // 1. Get User
      const uRes = await client.query("SELECT id, member_code, name, phone FROM users WHERE member_code = $1 FOR UPDATE", [memberCode]);
      if (uRes.rows.length === 0) throw { status: 404, message: "User not found" };
      const user = uRes.rows[0];

      // 2. Get Loyalty Info
      const lRes = await client.query("SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE", [user.id]);
      
      let currentStamps = 0;
      let totalRewards = 0;
      
      if (lRes.rows.length > 0) {
        currentStamps = Number(lRes.rows[0].current_stamps || 0);
        totalRewards = Number(lRes.rows[0].total_rewards || 0);
      } else {
        await client.query("INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards) VALUES ($1,0,0)", [user.id]);
      }

      let stampAdded = false;
      let reason = "success";
      let newStamps = currentStamps;

      // 3. Logic Checks
      if (numAmount < 1000) {
        reason = "low_amount";
        // Money collected, but NO stamp given
      } else if (currentStamps >= 11) {
        reason = "limit_reached";
        // Money collected, but NO stamp given (User needs to redeem)
      } else {
        // Condition Met: Add Stamp
        stampAdded = true;
        newStamps = currentStamps + 1;
        await client.query("UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2", [newStamps, user.id]);
        
        // Reset History for this slot (Overwrite old stamp data for this index)
        await client.query("DELETE FROM stamps_history WHERE user_id = $1 AND stamp_index = $2", [user.id, newStamps]);
        await client.query("INSERT INTO stamps_history (user_id, stamp_index, amount, created_at) VALUES ($1, $2, $3, NOW())", [user.id, newStamps, numAmount]);
      }

      // 4. ✅ INSERT TRANSACTION RECORD
      // We insert into the 'transactions' table regardless of stamp outcome so Admin sees the money.
      await client.query(
        `INSERT INTO transactions (user_id, member_code, customer_name, amount, payment_method, stamp_added, created_at)
         VALUES ($1, $2, $3, $4, 'online', $5, NOW())`,
        [user.id, user.member_code, user.name, numAmount, stampAdded]
      );

      // 5. Fetch Updated History for Card Response
      const historyRes = await client.query("SELECT stamp_index, amount, created_at FROM stamps_history WHERE user_id = $1 ORDER BY stamp_index ASC", [user.id]);

      return {
        status: 200,
        body: {
          message: stampAdded ? "Stamp added!" : "Payment successful",
          card: { ...user, currentStamps: newStamps, totalRewards, history: historyRes.rows },
          stampAdded: stampAdded,
          reason: reason
        }
      };
    });

    return res.status(result.status).json(result.body);

  } catch (err) {
    console.error("Online Stamp Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};