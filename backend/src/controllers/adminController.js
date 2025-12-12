// backend/src/adminController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db"); // your db.js - expects exported 'query' function
const { JWT_SECRET = process.env.JWT_SECRET || "change-me" } = process.env;

/**
 * Admin controller
 *
 * Exports:
 *  - login(req, res)
 *  - getCustomers(req, res)        // protected by adminAuth
 *  - addStamp(req, res)           // protected
 *  - removeStamp(req, res)        // protected (undo)
 *
 * Notes:
 *  - Uses SQL transactions where multiple updates are required.
 *  - Adjust table/column names if your DB differs (I used users, loyalty_accounts, rewards, admin_users
 *    based on the screenshots you shared).
 */

function signToken(payload) {
  // short expiry for admin sessions (tweak as desired)
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    // Find admin user by username
    const q = `SELECT id, username, password_hash, role FROM admin_users WHERE username=$1 LIMIT 1`;
    const r = await db.query(q, [username.trim()]);
    if (!r || !r.rows || r.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = r.rows[0];

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

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
 * getCustomers
 * Returns a list of customers with joined loyalty data.
 */
async function getCustomers(req, res) {
  try {
    // join users with loyalty_accounts
    const q = `
      SELECT u.id AS user_id,
             u.member_code,
             u.name,
             u.phone,
             u.dob,
             COALESCE(l.current_stamps, 0) AS current_stamps,
             COALESCE(l.total_rewards, 0) AS total_rewards
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
 * addStamp
 * Body: { memberCode }
 * Behavior:
 *  - find user by member_code
 *  - if not found -> 404
 *  - in transaction:
 *     - increment current_stamps by 1
 *     - if it becomes 12 -> set to 0, increment total_rewards by 1, insert into rewards table
 */
async function addStamp(req, res) {
  const { memberCode } = req.body || {};
  if (!memberCode) return res.status(400).json({ message: "memberCode is required" });

  const client = await db.getClient();
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

    // ensure loyalty row exists
    const ensureQ = `
      INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
      VALUES ($1, 0, 0, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;
    await client.query(ensureQ, [user.id]);

    // read current values
    const readQ = `SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`;
    const curR = await client.query(readQ, [user.id]);
    const cur = curR.rows[0] || { current_stamps: 0, total_rewards: 0 };

    let newStamps = Number(cur.current_stamps || 0) + 1;
    let newRewards = Number(cur.total_rewards || 0);
    let rewardIssued = false;
    let rewardRow = null;

    if (newStamps >= 12) {
      // issue reward
      newStamps = 0;
      newRewards = newRewards + 1;

      // update loyalty
      const updQ = `UPDATE loyalty_accounts SET current_stamps = $1, total_rewards = $2, updated_at = NOW() WHERE user_id = $3`;
      await client.query(updQ, [newStamps, newRewards, user.id]);

      // insert reward record (rewards table should have: id, user_id, issued_at)
      const insQ = `INSERT INTO rewards (user_id, issued_at) VALUES ($1, NOW()) RETURNING id, issued_at`;
      const insR = await client.query(insQ, [user.id]);
      rewardIssued = true;
      rewardRow = insR.rows[0];
    } else {
      // just update stamps
      const updQ = `UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2`;
      await client.query(updQ, [newStamps, user.id]);
    }

    await client.query("COMMIT");

    // Return updated card information
    return res.json({
      card: {
        user_id: user.id,
        memberCode: user.member_code,
        currentStamps: newStamps,
        totalRewards: newRewards,
      },
      rewardIssued,
      reward: rewardRow || null,
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
 * removeStamp (undo)
 * Body: { memberCode }
 * Behavior:
 *  - find user
 *  - if current_stamps > 0 -> decrement current_stamps by 1
 *  - else if current_stamps === 0 and total_rewards > 0:
 *      -> remove the most recent reward row for this user (DELETE FROM rewards ... ORDER BY issued_at DESC LIMIT 1)
 *      -> decrement total_rewards by 1 and set current_stamps = 11
 *  - All in transaction
 */
async function removeStamp(req, res) {
  const { memberCode } = req.body || {};
  if (!memberCode) return res.status(400).json({ message: "memberCode is required" });

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const userQ = `SELECT id, member_code FROM users WHERE member_code = $1 LIMIT 1`;
    const userR = await client.query(userQ, [memberCode]);
    if (!userR.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }
    const user = userR.rows[0];

    // ensure loyalty row exists
    const ensureQ = `
      INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
      VALUES ($1, 0, 0, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;
    await client.query(ensureQ, [user.id]);

    const readQ = `SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`;
    const curR = await client.query(readQ, [user.id]);
    const cur = curR.rows[0] || { current_stamps: 0, total_rewards: 0 };

    let newStamps = Number(cur.current_stamps || 0);
    let newRewards = Number(cur.total_rewards || 0);
    let rewardRemoved = false;
    let removedRewardRow = null;

    if (newStamps > 0) {
      newStamps = newStamps - 1;
      const updQ = `UPDATE loyalty_accounts SET current_stamps = $1, updated_at = NOW() WHERE user_id = $2`;
      await client.query(updQ, [newStamps, user.id]);
    } else if (newStamps === 0 && newRewards > 0) {
      // delete latest reward row
      const delQ = `
        DELETE FROM rewards
        WHERE id = (
          SELECT id FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1
        )
        RETURNING id, issued_at
      `;
      const delR = await client.query(delQ, [user.id]);
      if (delR.rows.length === 0) {
        // Could not find a reward row to delete -> abort
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "No reward record found to undo" });
      }
      removedRewardRow = delR.rows[0];
      newRewards = newRewards - 1;
      newStamps = 11;
      const updQ = `UPDATE loyalty_accounts SET current_stamps = $1, total_rewards = $2, updated_at = NOW() WHERE user_id = $3`;
      await client.query(updQ, [newStamps, newRewards, user.id]);
      rewardRemoved = true;
    } else {
      // Nothing to remove
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Nothing to undo" });
    }

    await client.query("COMMIT");

    return res.json({
      card: {
        user_id: user.id,
        memberCode: user.member_code,
        currentStamps: newStamps,
        totalRewards: newRewards,
      },
      rewardRemoved,
      removedReward: removedRewardRow || null,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("removeStamp failed:", err);
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
