// src/controllers/adminController.js
// Admin controller: login, getCustomers, addStamp, removeStamp
// Compatible with src/routes/adminRoutes.js and src/config/db.js
// See: adminRoutes.js and db.js in your repo. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db"); // expects { query, pool } exported. :contentReference[oaicite:5]{index=5}
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

/**
 * Returns whether today (in IST) is one of the blocked dates:
 * - Dec 25 (Christmas)
 * - Dec 31 (New Year Eve)
 * - Jan 1  (New Year Day)
 *
 * We compute using IST offset (UTC +5:30) to match your requirement.
 */
function getIstHolidayStatus() {
  const now = new Date();
  // IST offset relative to UTC: +5.5 hours
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const day = ist.getDate();
  const month = ist.getMonth() + 1; // 1..12

  if (month === 12 && day === 25) {
    return { blocked: true, key: "christmas", message: "Happy Christmas — sorry, stamp service not available today." , ist};
  }
  if (month === 12 && day === 31) {
    return { blocked: true, key: "newyear-eve", message: "New Year's Eve — sorry, stamp service not available today.", ist };
  }
  if (month === 1 && day === 1) {
    return { blocked: true, key: "newyear-day", message: "Happy New Year — sorry, stamp service not available today.", ist };
  }

  return { blocked: false, key: null, message: null, ist };
}

function signToken(payload) {
  // 8-12h token length; adjust as you want
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

/**
 * Admin login
 * POST /api/admin/login
 * body: { username, password }
 */
async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const q = `SELECT id, username, password_hash, role FROM admin_users WHERE username=$1 LIMIT 1`;
    const r = await db.query(q, [username.trim()]);
    if (!r || !r.rows || r.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = r.rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ id: admin.id, username: admin.username, role: admin.role });

    return res.json({
      token,
      username: admin.username,
      role: admin.role,
    });
  } catch (err) {
    console.error("admin.login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * GET /api/admin/customers
 * Protected by adminAuth middleware
 * Returns customers with joined loyalty data
 */
async function getCustomers(req, res) {
  try {
    const q = `
      SELECT u.id AS id,
             u.member_code,
             u.name,
             u.phone,
             u.dob,
             COALESCE(l.current_stamps, 0) AS current_stamps,
             COALESCE(l.total_rewards, 0) AS total_rewards,
             u.created_at
      FROM users u
      LEFT JOIN loyalty_accounts l ON l.user_id = u.id
      ORDER BY u.id ASC
    `;
    const r = await db.query(q);
    return res.json({ customers: r.rows || [] });
  } catch (err) {
    console.error("admin.getCustomers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * POST /api/admin/add-stamp
 * Body: { memberCode }
 *
 * Behavior:
 * - Check holiday block (IST)
 * - Find user by member_code
 * - Ensure loyalty_accounts row exists (create if missing)
 * - LOCK loyalty row FOR UPDATE (transaction) -> increment stamp
 * - If stamp reaches 12 -> reset to 0, increment total_rewards, insert reward row
 * - Insert stamp_events (optional audit) if you keep that table
 * - Return updated card object
 */
async function addStamp(req, res) {
  const holiday = getIstHolidayStatus();
  if (holiday.blocked) {
    return res.status(403).json({ message: holiday.message });
  }

  const { memberCode } = req.body || {};
  if (!memberCode) return res.status(400).json({ message: "memberCode is required" });

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // find user
    const userQ = `SELECT id, member_code, name, phone FROM users WHERE member_code = $1 LIMIT 1`;
    const userR = await client.query(userQ, [memberCode]);
    if (!userR.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }
    const user = userR.rows[0];

    // Ensure loyalty_accounts exists
    await client.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
       VALUES ($1, 0, 0, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Lock and read current values
    const curQ = `SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`;
    const curR = await client.query(curQ, [user.id]);
    const curRow = curR.rows[0] || { current_stamps: 0, total_rewards: 0 };

    let newStamps = Number(curRow.current_stamps || 0) + 1;
    let newRewards = Number(curRow.total_rewards || 0);
    let rewardIssued = false;
    let rewardRow = null;

    if (newStamps >= 12) {
      // Issue reward
      newStamps = 0;
      newRewards = newRewards + 1;

      const insRewardQ = `INSERT INTO rewards (user_id, issued_at) VALUES ($1, NOW()) RETURNING id, issued_at`;
      const insRewardR = await client.query(insRewardQ, [user.id]);
      rewardIssued = true;
      rewardRow = insRewardR.rows[0] || null;
    }

    // Upsert loyalty_accounts
    const upQ = `
      INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET current_stamps = $2, total_rewards = $3, updated_at = NOW()
    `;
    await client.query(upQ, [user.id, newStamps, newRewards]);

    // Optional: record stamp event (if table exists)
    try {
      const stampNumber = rewardIssued ? 12 : (newStamps === 0 ? 12 : newStamps);
      await client.query(
        `INSERT INTO stamp_events (user_id, stamp_number, stamped_at) VALUES ($1, $2, NOW())`,
        [user.id, stampNumber]
      );
    } catch (e) {
      // If stamp_events table doesn't exist, ignore — it's optional audit.
    }

    await client.query("COMMIT");

    return res.json({
      message: "Stamp updated",
      card: {
        memberCode: user.member_code,
        name: user.name,
        phone: user.phone,
        currentStamps: newStamps,
        totalRewards: newRewards,
      },
      rewardIssued,
      reward: rewardRow,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("addStamp failed:", err);
    return res.status(500).json({ message: "Server error adding stamp", error: String(err) });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/remove-stamp
 * Body: { memberCode }
 *
 * Undo flow:
 * - If current_stamps > 0 -> decrement current_stamps and delete last stamp_event for that stamp_number (if exists)
 * - Else if current_stamps == 0 and total_rewards > 0 -> decrement total_rewards and delete latest reward row, set current_stamps = 11
 * - Else -> nothing to undo
 *
 * All inside a transaction.
 */
async function removeStamp(req, res) {
  const holiday = getIstHolidayStatus();
  if (holiday.blocked) {
    return res.status(403).json({ message: holiday.message });
  }

  const { memberCode } = req.body || {};
  if (!memberCode) return res.status(400).json({ message: "memberCode is required" });

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const userQ = `
      SELECT u.id, u.member_code, u.name, u.phone,
             COALESCE(l.current_stamps,0) AS current_stamps,
             COALESCE(l.total_rewards,0) AS total_rewards
      FROM users u
      LEFT JOIN loyalty_accounts l ON l.user_id = u.id
      WHERE u.member_code = $1
      LIMIT 1
    `;
    const userR = await client.query(userQ, [memberCode]);
    if (!userR.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }
    const row = userR.rows[0];
    let current = Number(row.current_stamps || 0);
    let rewards = Number(row.total_rewards || 0);

    let removedRewardRow = null;
    let rewardRemoved = false;

    if (current > 0) {
      // decrement current stamps
      const newStamps = current - 1;

      // Try remove last stamp_event for that stamp_number (best-effort)
      try {
        await client.query(
          `DELETE FROM stamp_events
           WHERE id = (
             SELECT id FROM stamp_events WHERE user_id = $1 AND stamp_number = $2 ORDER BY stamped_at DESC LIMIT 1
           )`,
          [row.id, current]
        );
      } catch (e) {
        // ignore if table missing
      }

      await client.query(
        `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (user_id) DO UPDATE SET current_stamps=$2, total_rewards=$3, updated_at=NOW()`,
        [row.id, newStamps, rewards]
      );

      current = newStamps;
    } else if (current === 0 && rewards > 0) {
      // rollback a reward -> set to 11 stamps and decrement rewards
      // delete latest reward record
      const delQ = `
        DELETE FROM rewards
        WHERE id = (
          SELECT id FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1
        )
        RETURNING id, issued_at
      `;
      const delR = await client.query(delQ, [row.id]);
      if (delR.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "No reward record found to undo" });
      }
      removedRewardRow = delR.rows[0];
      rewardRemoved = true;
      rewards = rewards - 1;
      current = 11;

      await client.query(
        `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (user_id) DO UPDATE SET current_stamps=$2, total_rewards=$3, updated_at=NOW()`,
        [row.id, current, rewards]
      );
    } else {
      // nothing to undo
      await client.query("ROLLBACK");
      return res.json({
        message: "Nothing to undo",
        card: { memberCode: row.member_code, name: row.name, phone: row.phone, currentStamps: current, totalRewards: rewards }
      });
    }

    await client.query("COMMIT");

    return res.json({
      message: "Stamp undone",
      card: { memberCode: row.member_code, name: row.name, phone: row.phone, currentStamps: current, totalRewards: rewards },
      rewardRemoved,
      removedReward: removedRewardRow || null
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("removeStamp error:", err);
    return res.status(500).json({ message: "Server error undoing stamp", error: String(err) });
  } finally {
    client.release();
  }
}
module.exports = {
  login,
  getCustomers,
  addStamp,
  removeStamp,
};
