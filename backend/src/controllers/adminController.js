const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "please-set-a-secure-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// --- ADMIN LOGIN ---
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password required" });

    const q =
      "SELECT id, username, password_hash, role FROM admin_users WHERE username = $1 LIMIT 1";
    const r = await db.query(q, [username]);
    if (!r.rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const admin = r.rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { uid: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({ message: "Login successful", token, username: admin.username });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- GET CUSTOMERS ---
exports.getCustomers = async (req, res) => {
  try {
    const q = `
      SELECT u.id, u.member_code, u.name, u.phone, u.dob,
             COALESCE(l.current_stamps,0) as current_stamps,
             COALESCE(l.total_rewards,0) as total_rewards,
             l.updated_at,
             (
               SELECT json_agg(json_build_object('index', x.stamp_index, 'date', x.max_date))
               FROM (
                 SELECT stamp_index, MAX(created_at) as max_date
                 FROM stamps_history
                 WHERE user_id = u.id
                 GROUP BY stamp_index
               ) x
             ) as stamp_history
      FROM users u
      LEFT JOIN loyalty_accounts l ON l.user_id = u.id
      ORDER BY CAST(SUBSTRING(u.member_code FROM 3) AS INTEGER) ASC
    `;
    const r = await db.query(q);
    return res.json({ customers: r.rows });
  } catch (err) {
    console.error("getCustomers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- SEARCH CUSTOMER ---
exports.searchCustomer = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ message: "Query required" });
  try {
    // If query is 'all', return recently updated customers
    if (query.trim().toLowerCase() === 'all') {
  const result = await db.query(
    `SELECT u.id, u.member_code, u.name, u.phone, u.dob, 
            COALESCE(l.current_stamps, 0) as current_stamps, 
            COALESCE(l.total_rewards, 0) as total_rewards
     FROM users u
     LEFT JOIN loyalty_accounts l ON l.user_id = u.id
     ORDER BY CAST(SUBSTRING(u.member_code FROM 3) AS INTEGER) ASC
     LIMIT 50`
  );
  return res.json(result.rows);
}


    const result = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, u.dob, 
              COALESCE(l.current_stamps, 0) as current_stamps, 
              COALESCE(l.total_rewards, 0) as total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code ILIKE $1 OR u.phone ILIKE $1 OR u.name ILIKE $1
       LIMIT 20`,
      [`%${query.trim()}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- ADD STAMP (Manual with Amount - Strict Logic) ---
exports.addStamp = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const numAmount = Number(amount) || 0;

    if (!userId) return res.status(400).json({ message: "User ID required" });

    const result = await db.withClient(async (client) => {
      // 1) Get User Info
      const userQ = `SELECT member_code, name FROM users WHERE id = $1`;
      const userRes = await client.query(userQ, [userId]);
      if (userRes.rows.length === 0) throw { status: 404, message: "User not found" };
      const user = userRes.rows[0];

      // 2) Lock Loyalty Account
      const laRes = await client.query(
        `SELECT user_id, current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      let current = 0;
      let rewards = 0;

      if (laRes.rows.length === 0) {
        await client.query(
          `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
           VALUES ($1, 0, 0, NOW())`,
          [userId]
        );
      } else {
        current = Number(laRes.rows[0].current_stamps || 0);
        rewards = Number(laRes.rows[0].total_rewards || 0);
      }

      let stampAdded = false;
      let message = "No stamp added.";

      // 3) Logic: Add stamp ONLY if Amount >= 1000 AND Stamps < 11
      if (numAmount >= 1000 && current < 11) {
        current += 1;
        stampAdded = true;
        message = "Amount verified. Stamp added!";

        // Update Account
        await client.query(
          `UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2`,
          [current, userId]
        );

        // Manage History (Overwrite old date for this stamp slot)
        await client.query(
          `DELETE FROM stamps_history WHERE user_id = $1 AND stamp_index = $2`,
          [userId, current]
        );
        await client.query(
          `INSERT INTO stamps_history (user_id, stamp_index, amount, created_at) VALUES ($1, $2, $3, NOW())`,
          [userId, current, numAmount]
        );

        // ✅ 4) STRICT RECORD IN TRANSACTIONS TABLE
        // We ONLY record the transaction if a stamp was actually added.
        await client.query(
            `INSERT INTO transactions (user_id, member_code, customer_name, amount, payment_method, stamp_added, created_at)
             VALUES ($1, $2, $3, $4, 'manual', $5, NOW())`,
            [userId, user.member_code, user.name, numAmount, stampAdded]
        );

      } else {
         if (numAmount < 1000) message = "Amount < 1000. No stamp added, transaction NOT recorded.";
         else if (current >= 11) message = "Limit reached (11 stamps). Please redeem.";
      }

      // Fetch Updated Data
      const updatedRes = await client.query("SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1", [userId]);

      return {
        success: true,
        message,
        data: updatedRes.rows[0],
        card: { 
          memberCode: user.member_code,
          name: user.name,
          currentStamps: current,
          totalRewards: rewards
        }
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("addStamp error:", err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error adding stamp", error: (err && err.message) || err });
  }
};

// --- RESET STAMPS (Redeem) ---
exports.resetStamps = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const result = await db.withClient(async (client) => {
      const lRes = await client.query("SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE", [userId]);
      if (lRes.rows.length === 0) throw { status: 404, message: "Account not found" };
      
      const currentStamps = Number(lRes.rows[0].current_stamps);
      if (currentStamps < 11) throw { status: 400, message: "Not enough stamps to redeem" };

      const newRewards = Number(lRes.rows[0].total_rewards) + 1;
      
      await client.query("UPDATE loyalty_accounts SET current_stamps = 0, total_rewards = $1, updated_at = NOW() WHERE user_id = $2", [newRewards, userId]);
      await client.query("DELETE FROM stamps_history WHERE user_id = $1", [userId]);

      return { 
          success: true, 
          message: "Reward redeemed! Stamps reset.", 
          data: { current_stamps: 0, total_rewards: newRewards } 
      };
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error("resetStamps error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// --- REMOVE STAMP (Legacy) ---
exports.removeStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const result = await db.withClient(async (client) => {
      const userRes = await client.query(`SELECT id, member_code, name, phone FROM users WHERE member_code = $1`, [memberCode]);
      if (userRes.rows.length === 0) throw { status: 404, message: "Member not found" };
      const user = userRes.rows[0];

      const laRes = await client.query(
        `SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`,
        [user.id]
      );

      let current = 0;
      let rewards = 0;
      if (laRes.rows.length > 0) {
        current = Number(laRes.rows[0].current_stamps);
        rewards = Number(laRes.rows[0].total_rewards);
      }

      if (current > 0) {
        await client.query(`DELETE FROM stamps_history WHERE user_id = $1 AND stamp_index = $2`, [user.id, current]);
        current -= 1;
      } else if (rewards > 0) {
        rewards -= 1;
        current = 11; 
      } else {
        return { card: { ...user, currentStamps: 0, totalRewards: 0 } };
      }

      await client.query(
        `UPDATE loyalty_accounts SET current_stamps = $1, total_rewards = $2, updated_at = NOW() WHERE user_id = $3`,
        [current, rewards, user.id]
      );

      return { card: { ...user, currentStamps: current, totalRewards: rewards } };
    });

    return res.json({ message: "Stamp removed", card: result.card });
  } catch (err) {
    console.error("removeStamp error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- UNDO LAST STAMP (ADMIN ONLY, PASSWORD PROTECTED, TODAY ONLY) ---
exports.undoLastStamp = async (req, res) => {
  try {
    const { userId, password } = req.body;
    const adminId = req.admin.uid;

    if (!userId || !password) {
      return res.status(400).json({ message: "User ID and password required" });
    }

    // 1️⃣ Verify admin delete password
    const adminRes = await db.query(
      "SELECT delete_password_hash FROM admin_users WHERE id = $1",
      [adminId]
    );

    if (!adminRes.rows.length) {
      return res.status(403).json({ message: "Admin not found" });
    }

    const valid = await bcrypt.compare(
      password,
      adminRes.rows[0].delete_password_hash
    );

    if (!valid) {
      return res.status(401).json({ message: "Invalid admin password" });
    }

    // 2️⃣ Transaction-safe undo
    const result = await db.withClient(async (client) => {
      // Lock account
      const laRes = await client.query(
        "SELECT current_stamps FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE",
        [userId]
      );

      if (!laRes.rows.length || laRes.rows[0].current_stamps <= 0) {
        throw { status: 400, message: "No stamps to undo" };
      }

      const current = laRes.rows[0].current_stamps;

      // Get last stamp (today only)
      const stampRes = await client.query(
        `
        SELECT id, created_at
        FROM stamps_history
        WHERE user_id = $1 AND stamp_index = $2
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId, current]
      );

      if (!stampRes.rows.length) {
        throw { status: 400, message: "No stamp history found" };
      }

      const stampDate = new Date(stampRes.rows[0].created_at).toDateString();
      const today = new Date().toDateString();

      if (stampDate !== today) {
        throw {
          status: 403,
          message: "Only today’s stamp can be undone",
        };
      }

      // Delete stamp history
      await client.query(
        "DELETE FROM stamps_history WHERE id = $1",
        [stampRes.rows[0].id]
      );

      // Delete latest transaction for this user today
      await client.query(
        `
        DELETE FROM transactions
        WHERE id = (
          SELECT id FROM transactions
          WHERE user_id = $1
            AND stamp_added = true
            AND DATE(created_at) = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1
        )
        `,
        [userId]
      );

      // Update loyalty account
      await client.query(
        "UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2",
        [current - 1, userId]
      );

      return { success: true, current_stamps: current - 1 };
    });

    return res.json({
      message: "Last stamp undone successfully",
      data: result,
    });

  } catch (err) {
    console.error("Undo stamp error:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Server error",
    });
  }
};


// --- GET INSIGHTS ---
exports.getInsights = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, member_code, customer_name, amount, payment_method, stamp_added, created_at 
      FROM transactions 
      ORDER BY created_at DESC 
      LIMIT 500
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("getInsights error:", err);
    res.status(500).json({ message: "Server error fetching insights" });
  }
};

// --- DELETE TRANSACTIONS BY DATE (PASSWORD PROTECTED) ---
exports.deleteTransactionsByDate = async (req, res) => {
  try {
    const { date, password } = req.body;
    const adminId = req.admin.uid;

    if (!date || !password) {
      return res.status(400).json({ message: "Date and password required" });
    }

    // 1️⃣ Get admin password hash
    const adminRes = await db.query(
      "SELECT delete_password_hash FROM admin_users WHERE id = $1",
      [adminId]
    );

    if (!adminRes.rows.length || !adminRes.rows[0].delete_password_hash) {
      return res.status(403).json({ message: "Delete password not configured" });
    }

    const isValid = await bcrypt.compare(
      password,
      adminRes.rows[0].delete_password_hash
    );

    if (!isValid) {
      return res.status(401).json({ message: "Invalid delete password" });
    }

    // 2️⃣ Delete ONLY that day's transactions
    const del = await db.query(
      `
      DELETE FROM transactions
      WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $1
      RETURNING id
      `,
      [date]
    );

    return res.json({
      success: true,
      deletedCount: del.rowCount,
      message: `Deleted ${del.rowCount} transactions for ${date}`,
    });

  } catch (err) {
    console.error("Delete by date error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
