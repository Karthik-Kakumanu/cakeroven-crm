// backend/src/controllers/adminController.js
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "please-set-a-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Admin login
 * POST /api/admin/login
 * body: { username, password }
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password required" });

    const q = "SELECT id, username, password_hash, role FROM admin_users WHERE username = $1 LIMIT 1";
    const r = await db.query(q, [username]);
    if (!r.rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const admin = r.rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ uid: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.json({ message: "Login successful", token, username: admin.username });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/admin/customers
 * returns customers with loyalty summary
 */
exports.getCustomers = async (req, res) => {
  try {
    const q = `
      SELECT u.id, u.member_code, u.name, u.phone, u.dob,
             COALESCE(l.current_stamps,0) as current_stamps,
             COALESCE(l.total_rewards,0) as total_rewards,
             COALESCE(l.updated_at, NULL) as updated_at
      FROM users u
      LEFT JOIN loyalty_accounts l ON l.user_id = u.id
      ORDER BY u.id ASC
    `;
    const r = await db.query(q);
    return res.json({ customers: r.rows });
  } catch (err) {
    console.error("getCustomers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/add-stamp
 * body: { memberCode }
 *
 * Increments the stamp count for that user.
 * If current_stamps becomes 12 -> award reward: current_stamps = 0, total_rewards += 1
 */
exports.addStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    // Use transaction to avoid races
    const result = await db.withClient(async (client) => {
      // get user + account
      const userQ = `SELECT u.id, u.member_code, u.name, u.phone,
                            l.current_stamps, l.total_rewards
                     FROM users u
                     LEFT JOIN loyalty_accounts l ON l.user_id = u.id
                     WHERE u.member_code = $1
                     FOR UPDATE`;
      const ur = await client.query(userQ, [memberCode]);
      if (!ur.rows.length) throw { status: 404, message: "Member not found" };

      const row = ur.rows[0];
      if (!row) throw { status: 404, message: "Member not found" };

      // ensure loyalty_accounts exists (create if missing)
      let account = { current_stamps: row.current_stamps ?? 0, total_rewards: row.total_rewards ?? 0 };
      if (row.current_stamps === null || row.current_stamps === undefined) {
        // create initial row
        await client.query(
          `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
           VALUES ($1, 0, 0, NOW())`,
          [row.id]
        );
        account = { current_stamps: 0, total_rewards: 0 };
      }

      let newStamps = Number(account.current_stamps) + 1;
      let newRewards = Number(account.total_rewards || 0);
      let awarded = false;

      if (newStamps >= 12) {
        // Completed reward
        newStamps = 0;
        newRewards += 1;
        awarded = true;
      }

      // Update loyalty_accounts
      await client.query(
        `UPDATE loyalty_accounts
         SET current_stamps = $1, total_rewards = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [newStamps, newRewards, row.id]
      );

      // If reward awarded, insert a rewards row
      if (awarded) {
        await client.query(
          `INSERT INTO rewards (user_id, issued_at)
           VALUES ($1, NOW())`,
          [row.id]
        );
      }

      // Return the new card
      return {
        card: {
          memberCode: row.member_code,
          name: row.name,
          phone: row.phone,
          currentStamps: newStamps,
          totalRewards: newRewards,
        },
        awarded,
      };
    });

    return res.json({ message: "Stamp added", card: result.card, awarded: result.awarded });
  } catch (err) {
    console.error("addStamp error:", err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error adding stamp", error: (err && err.message) || err });
  }
};

/**
 * POST /api/admin/remove-stamp
 * body: { memberCode }
 *
 * Removes a stamp (undo). If stamps are 0 and rewards > 0, we should optionally reverse the last reward:
 * Behavior: If current_stamps === 0 and total_rewards > 0 -> decrement total_rewards by 1 and set current_stamps = 11
 */
exports.removeStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const result = await db.withClient(async (client) => {
      const userQ = `SELECT u.id, u.member_code, u.name, u.phone,
                            l.current_stamps, l.total_rewards
                     FROM users u
                     LEFT JOIN loyalty_accounts l ON l.user_id = u.id
                     WHERE u.member_code = $1
                     FOR UPDATE`;
      const ur = await client.query(userQ, [memberCode]);
      if (!ur.rows.length) throw { status: 404, message: "Member not found" };

      const row = ur.rows[0];
      let current = Number(row.current_stamps || 0);
      let rewards = Number(row.total_rewards || 0);

      if (current > 0) {
        current -= 1;
      } else if (rewards > 0) {
        // Undo previous reward: remove one reward and set stamps to 11
        rewards -= 1;
        current = 11;
        // Remove latest reward row (best-effort)
        await client.query(
          `DELETE FROM rewards
           WHERE user_id = $1
           AND issued_at = (
             SELECT MAX(issued_at) FROM rewards WHERE user_id = $1
           )`,
          [row.id]
        );
      } else {
        // nothing to remove
        return { card: { memberCode: row.member_code, name: row.name, phone: row.phone, currentStamps: current, totalRewards: rewards } };
      }

      await client.query(
        `UPDATE loyalty_accounts
         SET current_stamps = $1, total_rewards = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [current, rewards, row.id]
      );

      return {
        card: {
          memberCode: row.member_code,
          name: row.name,
          phone: row.phone,
          currentStamps: current,
          totalRewards: rewards,
        },
      };
    });

    return res.json({ message: "Stamp updated", card: result.card });
  } catch (err) {
    console.error("removeStamp error:", err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error removing stamp", error: (err && err.message) || err });
  }
};

/**
 * Utility: reward history for a member (used by UI if needed)
 */
exports.getRewardHistoryFor = async (req, res) => {
  try {
    const memberCode = req.params.memberCode;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const q = `
      SELECT r.id, r.issued_at, u.member_code, u.name, u.phone
      FROM rewards r
      JOIN users u ON u.id = r.user_id
      WHERE u.member_code = $1
      ORDER BY r.issued_at ASC
    `;
    const r = await db.query(q, [memberCode]);
    return res.json({ rewards: r.rows });
  } catch (err) {
    console.error("getRewardHistoryFor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
