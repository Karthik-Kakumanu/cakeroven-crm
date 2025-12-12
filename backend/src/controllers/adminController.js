// backend/src/controllers/adminController.js
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "please-set-a-secure-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

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

exports.getCustomers = async (req, res) => {
  try {
    const q = `
      SELECT u.id, u.member_code, u.name, u.phone, u.dob,
             COALESCE(l.current_stamps,0) as current_stamps,
             COALESCE(l.total_rewards,0) as total_rewards,
             l.updated_at
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

async function lockUserByMemberCode(client, memberCode) {
  const uQ = `SELECT id, member_code, name, phone, dob FROM users WHERE member_code = $1 FOR UPDATE`;
  const uR = await client.query(uQ, [memberCode]);
  if (!uR.rows.length) return null;
  return uR.rows[0];
}

exports.addStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const result = await db.withClient(async (client) => {
      // 1) lock user row
      const user = await lockUserByMemberCode(client, memberCode);
      if (!user) throw { status: 404, message: "Member not found" };

      // 2) lock loyalty account row (if exists)
      const laRes = await client.query(
        `SELECT user_id, current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`,
        [user.id]
      );

      let current = 0;
      let rewards = 0;

      if (laRes.rows.length === 0) {
        // create loyalty row
        await client.query(
          `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
           VALUES ($1, 0, 0, NOW())`,
          [user.id]
        );
        current = 0;
        rewards = 0;
      } else {
        current = Number(laRes.rows[0].current_stamps || 0);
        rewards = Number(laRes.rows[0].total_rewards || 0);
      }

      // add one stamp
      current += 1;
      let awarded = false;
      if (current >= 12) {
        // award
        current = 0;
        rewards += 1;
        awarded = true;
      }

      // update loyalty_accounts
      await client.query(
        `UPDATE loyalty_accounts SET current_stamps = $1, total_rewards = $2, updated_at = NOW() WHERE user_id = $3`,
        [current, rewards, user.id]
      );

      // if awarded insert reward row
      if (awarded) {
        await client.query(`INSERT INTO rewards (user_id, issued_at) VALUES ($1, NOW())`, [user.id]);
      }

      // record into stamps_history (use existing DB table name & columns)
      // recordedStampIndex: if current === 0 it means the member hit the 12th before reset -> record 12
      const recordedStampIndex = current === 0 ? 12 : current;
      await client.query(
        `INSERT INTO stamps_history (user_id, stamp_index, created_at) VALUES ($1, $2, NOW())`,
        [user.id, recordedStampIndex]
      );

      return {
        card: {
          memberCode: user.member_code,
          name: user.name,
          phone: user.phone,
          currentStamps: current,
          totalRewards: rewards,
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

exports.removeStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const result = await db.withClient(async (client) => {
      const user = await lockUserByMemberCode(client, memberCode);
      if (!user) throw { status: 404, message: "Member not found" };

      const laRes = await client.query(
        `SELECT user_id, current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`,
        [user.id]
      );

      let current = 0;
      let rewards = 0;
      if (laRes.rows.length === 0) {
        // nothing to remove
        return {
          card: { memberCode: user.member_code, name: user.name, phone: user.phone, currentStamps: 0, totalRewards: 0 },
        };
      } else {
        current = Number(laRes.rows[0].current_stamps || 0);
        rewards = Number(laRes.rows[0].total_rewards || 0);
      }

      if (current > 0) {
        current -= 1;
      } else if (rewards > 0) {
        // roll back a reward into stamps: remove latest reward row
        rewards -= 1;
        current = 11;
        // delete the most recent reward row for the user
        await client.query(
          `DELETE FROM rewards WHERE id = (
             SELECT id FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1
           )`,
          [user.id]
        );
      } else {
        // nothing to remove
        return {
          card: { memberCode: user.member_code, name: user.name, phone: user.phone, currentStamps: current, totalRewards: rewards },
        };
      }

      await client.query(
        `UPDATE loyalty_accounts SET current_stamps = $1, total_rewards = $2, updated_at = NOW() WHERE user_id = $3`,
        [current, rewards, user.id]
      );

      // record an undo event in stamps_history (we store the resulting stamp_index after removal)
      await client.query(
        `INSERT INTO stamps_history (user_id, stamp_index, created_at) VALUES ($1, $2, NOW())`,
        [user.id, current]
      );

      return {
        card: { memberCode: user.member_code, name: user.name, phone: user.phone, currentStamps: current, totalRewards: rewards },
      };
    });

    return res.json({ message: "Stamp updated", card: result.card });
  } catch (err) {
    console.error("removeStamp error:", err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error removing stamp", error: (err && err.message) || err });
  }
};

exports.getRewardHistoryFor = async (req, res) => {
  try {
    const { memberCode } = req.params;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const q = `SELECT r.id, r.issued_at, u.member_code, u.name, u.phone
               FROM rewards r
               JOIN users u ON u.id = r.user_id
               WHERE u.member_code = $1
               ORDER BY r.issued_at ASC`;
    const r = await db.query(q, [memberCode]);
    return res.json({ rewards: r.rows });
  } catch (err) {
    console.error("getRewardHistoryFor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
