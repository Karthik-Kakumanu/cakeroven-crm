// src/controllers/adminController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
require("dotenv").config();

function getIstHolidayStatus() {
  const now = new Date();
  // IST = UTC + 5:30 -> offset in ms
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);

  const day = ist.getDate();
  const month = ist.getMonth() + 1; // getMonth is 0-indexed
  const year = ist.getFullYear();

  // Christmas (Dec 25) every year
  if (month === 12 && day === 25) {
    return {
      blocked: true,
      key: "christmas",
      message: "Happy Christmas — Sorry for the inconvenience. Stamp access is disabled today.",
    };
  }

  // New Year period: Dec 31 (00:00) through Jan 1 (23:59) local IST -> treat as two-day window
  // We'll treat: Dec 31 (00:00 IST) -> Jan 1 (23:59:59 IST)
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) {
    // If we're on Dec 31 or Jan 1 (IST), block
    return {
      blocked: true,
      key: "newyear",
      message: "Happy New Year — Sorry for the inconvenience. Stamp access is disabled during New Year.",
    };
  }

  return { blocked: false };
}

/**
 * Admin login
 */
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const q = `SELECT id, username, password_hash, role FROM admin_users WHERE username = $1 LIMIT 1`;
    const { rows } = await db.query(q, [username]);

    if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.ADMIN_JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, username: user.username });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Fetch customers for admin
 */
exports.getCustomers = async (req, res) => {
  try {
    const q = `SELECT u.id, u.member_code, u.name, u.phone, u.dob, 
                COALESCE(l.current_stamps, 0) AS current_stamps,
                COALESCE(l.total_rewards, 0) AS total_rewards
               FROM users u
               LEFT JOIN loyalty_accounts l ON l.user_id = u.id
               ORDER BY u.id ASC`;
    const { rows } = await db.query(q);
    res.json({ customers: rows });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get dashboard stats
 */
exports.getStats = async (req, res) => {
  try {
    // total members, total stamps, total rewards
    const q1 = `SELECT COUNT(*)::int AS total_users FROM users`;
    const q2 = `SELECT COALESCE(SUM(current_stamps),0)::int AS total_stamps, COALESCE(SUM(total_rewards),0)::int AS total_rewards FROM loyalty_accounts`;
    const r1 = await db.query(q1);
    const r2 = await db.query(q2);

    // birthdays today
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffsetMs);
    const day = ist.getDate();
    const month = ist.getMonth() + 1;

    const q3 = `SELECT id, member_code, name, phone, dob FROM users WHERE EXTRACT(DAY FROM dob) = $1 AND EXTRACT(MONTH FROM dob) = $2`;
    const r3 = await db.query(q3, [day, month]);

    res.json({
      totalUsers: r1.rows[0].total_users,
      totalStamps: r2.rows[0].total_stamps,
      totalRewards: r2.rows[0].total_rewards,
      birthdaysToday: r3.rows,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Add stamp for a member (admin action)
 * Behavior:
 *  - If stamps reach 12 -> reset to 0 and increment rewards by 1 (and record reward)
 *  - Prevent actions on holiday windows (uses IST-based check)
 */
exports.addStamp = async (req, res) => {
  try {
    // block on holidays
    const holiday = getIstHolidayStatus();
    if (holiday.blocked) {
      return res.status(403).json({ message: holiday.message });
    }

    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    // find user
    const uQ = `SELECT id, member_code, name, phone, dob FROM users WHERE member_code = $1 LIMIT 1`;
    const uR = await db.query(uQ, [memberCode]);
    if (!uR.rows.length) return res.status(404).json({ message: "Member not found" });

    const row = uR.rows[0];
    // transaction
    await db.query("BEGIN");

    // fetch current stamps & rewards (locking)
    const lQ = `SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`;
    const lR = await db.query(lQ, [row.id]);

    let current = 0;
    let rewards = 0;
    if (lR.rows.length) {
      current = Number(lR.rows[0].current_stamps || 0);
      rewards = Number(lR.rows[0].total_rewards || 0);
    }

    // add
    current += 1;

    // if reached 12 -> increment rewards and reset
    if (current >= 12) {
      current = 0;
      rewards += 1;

      // record reward in rewards table
      const insReward = `INSERT INTO rewards (user_id, issued_at) VALUES ($1, NOW())`;
      await db.query(insReward, [row.id]);
    }

    // upsert loyalty account
    const up = `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
                VALUES ($1,$2,$3)
                ON CONFLICT (user_id) DO UPDATE SET current_stamps = $2, total_rewards = $3`;
    await db.query(up, [row.id, current, rewards]);

    await db.query("COMMIT");

    // respond with updated card
    return res.json({
      message: "Stamp added",
      card: { memberCode: row.member_code, name: row.name, phone: row.phone, dob: row.dob, currentStamps: current, totalRewards: rewards },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (e) {
      // ignore
    }
    console.error("Add stamp error:", error);
    res.status(500).json({ message: "Server error adding stamp" });
  }
};

/**
 * Remove stamp (undo) for a member
 * When undoing a stamp after reward event (rare), this logic will attempt to revert properly.
 */
exports.removeStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const uQ = `SELECT id, member_code, name, phone, dob FROM users WHERE member_code = $1 LIMIT 1`;
    const uR = await db.query(uQ, [memberCode]);
    if (!uR.rows.length) return res.status(404).json({ message: "Member not found" });

    const row = uR.rows[0];

    await db.query("BEGIN");

    const lQ = `SELECT current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE`;
    const lR = await db.query(lQ, [row.id]);

    let current = 0;
    let rewards = 0;
    if (lR.rows.length) {
      current = Number(lR.rows[0].current_stamps || 0);
      rewards = Number(lR.rows[0].total_rewards || 0);
    }

    if (current > 0) {
      current = Math.max(0, current - 1);
    } else {
      // If current is 0, attempt to roll back if there is a reward that caused it to reset
      if (rewards > 0) {
        // find last reward for the user and delete it (we assume rewards table has id & issued_at)
        const lastQ = `SELECT id, issued_at FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1`;
        const lastR = await db.query(lastQ, [row.id]);
        if (lastR.rows.length) {
          const last = lastR.rows[0];
          // remove that reward and set current to 11 (previous cycle)
          await db.query(`DELETE FROM rewards WHERE id = $1`, [last.id]);
          rewards = Math.max(0, rewards - 1);
          current = 11;
        } else {
          // nothing to undo
          current = 0;
        }
      } else {
        // nothing to undo
        current = 0;
      }
    }

    // upsert loyalty_accounts
    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET current_stamps = $2, total_rewards = $3`,
      [row.id, current, rewards]
    );

    await db.query("COMMIT");

    return res.json({
      message: "Stamp undone",
      card: { memberCode: row.member_code, name: row.name, phone: row.phone, dob: row.dob, currentStamps: current, totalRewards: rewards }
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (e) {
      // ignore
    }
    console.error("Remove stamp error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
