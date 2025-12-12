// src/controllers/adminController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
require("dotenv").config();

function getIstHolidayStatus() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);

  const day = ist.getDate();
  const month = ist.getMonth() + 1;

  if (month === 12 && day === 25) {
    return { blocked: true, key: "christmas", message: "Happy Christmas — services not available today.", ist };
  }
  if (month === 12 && day === 31) {
    return { blocked: true, key: "newyear-eve", message: "New Year's Eve — services not available today.", ist };
  }
  if (month === 1 && day === 1) {
    return { blocked: true, key: "newyear-day", message: "Happy New Year — services not available today.", ist };
  }
  return { blocked: false, key: null, message: null, ist };
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username & password required" });

    const result = await db.query(
      `SELECT id, username, password_hash, role 
       FROM admin_users 
       WHERE username = $1 LIMIT 1`,
      [username]
    );

    if (result.rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const admin = result.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role }, process.env.JWT_SECRET, { expiresIn: "12h" });

    return res.json({ message: "Login successful", token, username: admin.username, role: admin.role });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.member_code, u.name, u.phone, u.dob,
             COALESCE(l.current_stamps, 0) AS current_stamps,
             COALESCE(l.total_rewards, 0) AS total_rewards,
             u.created_at
      FROM users u
      LEFT JOIN loyalty_accounts l ON l.user_id = u.id
      ORDER BY u.member_code ASC
    `);
    res.json({ customers: result.rows });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- START: REPLACE addStamp / removeStamp in adminController.js ---

/**
 * Add one stamp to a user's account.
 * - Uses a transaction to update loyalty_accounts and insert a stamp_events record.
 * - If stamps hit 12 -> resets to 0 and increments rewards.
 */
exports.addStamp = async function (req, res) {
  const { memberCode } = req.body;
  if (!memberCode) return res.status(400).json({ message: "Missing memberCode" });

  const client = await db.getClient(); // if your db helper exposes getClient() with client.query
  // If db.getClient doesn't exist in your helper, use db.query and remove client usage & transactions.
  try {
    await client.query("BEGIN");

    // Get user and current stamps
    const userRes = await client.query(
      `SELECT u.id as user_id, la.current_stamps, la.total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts la ON la.user_id = u.id
       WHERE u.member_code = $1
       LIMIT 1`,
      [memberCode]
    );

    if (!userRes.rows || userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }

    const row = userRes.rows[0];
    const userId = row.user_id;
    const currentStamps = Number(row.current_stamps || 0);
    const currentRewards = Number(row.total_rewards || 0);

    // Determine new stamps / rewards
    let newStamps = currentStamps + 1;
    let newRewards = currentRewards;
    let justAwardedReward = false;

    if (newStamps > 11) {
      // Completed 12th stamp -> award reward and reset stamps to 0
      newStamps = 0;
      newRewards = currentRewards + 1;
      justAwardedReward = true;
    }

    // Update loyalty_accounts (INSERT if not exists)
    const upsertAccountSql = `
      INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET current_stamps = EXCLUDED.current_stamps, total_rewards = EXCLUDED.total_rewards, updated_at = NOW()
      RETURNING *`;
    const upsertRes = await client.query(upsertAccountSql, [userId, newStamps, newRewards]);

    // Insert stamp event record
    // Note: correct SQL keyword is VALUES
    await client.query(
      `INSERT INTO stamp_events (user_id, stamp_number, created_at)
       VALUES ($1, $2, NOW())`,
      [userId, newStamps === 0 ? 12 : newStamps] // if newStamps reset -> record 12 as final stamp
    );

    await client.query("COMMIT");

    // Build a response similar to what your frontend expects
    const responseCard = {
      currentStamps: newStamps,
      totalRewards: newRewards,
    };

    return res.json({ success: true, card: responseCard, justAwardedReward });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (e) { /* ignore */ }
    console.error("addStamp error:", err);
    return res.status(500).json({ message: "Failed to add stamp", error: err.message });
  } finally {
    try { client.release(); } catch (e) { /* ignore */ }
  }
};

/**
 * Remove (undo) last stamp for a user.
 * It will:
 * - find the last stamp_events entry for that user and delete it,
 * - recalc the current_stamps (and total_rewards if needed),
 * - return the updated card info.
 */
exports.removeStamp = async function (req, res) {
  const { memberCode } = req.body;
  if (!memberCode) return res.status(400).json({ message: "Missing memberCode" });

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      `SELECT u.id as user_id, la.current_stamps, la.total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts la ON la.user_id = u.id
       WHERE u.member_code = $1
       LIMIT 1`,
      [memberCode]
    );

    if (!userRes.rows || userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }

    const row = userRes.rows[0];
    const userId = row.user_id;
    let currentStamps = Number(row.current_stamps || 0);
    let currentRewards = Number(row.total_rewards || 0);

    // Find last stamp event for this user
    const lastEventRes = await client.query(
      `SELECT id, stamp_number FROM stamp_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!lastEventRes.rows || lastEventRes.rows.length === 0) {
      // nothing to undo
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No stamp events to remove" });
    }

    const lastEvent = lastEventRes.rows[0];

    // Remove that event
    await client.query(`DELETE FROM stamp_events WHERE id = $1`, [lastEvent.id]);

    // Now recalc: if last event was a reward (i.e. stamp_number === 12), then the account must have been reset
    // We'll compute new currentStamps and newRewards conservatively:
    if (lastEvent.stamp_number === 12) {
      // The previous state before that reward should have been 11 stamps and rewards-1
      currentStamps = 11;
      currentRewards = Math.max(0, currentRewards - 1);
    } else {
      // Normal case: just decrement stamps (but guarded >=0)
      currentStamps = Math.max(0, currentStamps - 1);
    }

    // Update loyalty_accounts
    await client.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET current_stamps = EXCLUDED.current_stamps, total_rewards = EXCLUDED.total_rewards, updated_at = NOW()`,
      [userId, currentStamps, currentRewards]
    );

    await client.query("COMMIT");

    return res.json({ success: true, card: { currentStamps, totalRewards: currentRewards } });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (e) { /* ignore */ }
    console.error("removeStamp error:", err);
    return res.status(500).json({ message: "Failed to remove stamp", error: err.message });
  } finally {
    try { client.release(); } catch (e) { /* ignore */ }
  }
};

// --- END: REPLACE addStamp / removeStamp ---
