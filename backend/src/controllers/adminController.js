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

exports.addStamp = async (req, res) => {
  try {
    const holiday = getIstHolidayStatus();
    if (holiday.blocked) return res.status(403).json({ message: holiday.message });

    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const userRes = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, COALESCE(l.current_stamps,0) AS current_stamps, COALESCE(l.total_rewards,0) AS total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1 LIMIT 1`,
      [memberCode]
    );

    if (userRes.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const data = userRes.rows[0];
    let current = Number(data.current_stamps || 0);
    let reward = Number(data.total_rewards || 0);

    current += 1;
    if (current >= 12) {
      current = 0;
      reward += 1;
      // Insert reward event
      await db.query(`INSERT INTO rewards (user_id, issued_at) VALUES ($1, NOW())`, [data.id]);
    }

    // update loyalty account (create if not exists)
    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET current_stamps = $2, total_rewards = $3`,
      [data.id, current, reward]
    );

    // record stamp event
    await db.query(`INSERT INTO stamp_events (user_id, stamp_number, stamped_at) VALUES ($1, $2, NOW())`, [data.id, current === 0 ? 12 : current,]);

    return res.json({
      message: "Stamp updated",
      card: { memberCode: data.member_code, name: data.name, phone: data.phone, currentStamps: current, totalRewards: reward }
    });
  } catch (error) {
    console.error("Stamp error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.removeStamp = async (req, res) => {
  try {
    const holiday = getIstHolidayStatus();
    if (holiday.blocked) return res.status(403).json({ message: holiday.message });

    const { memberCode } = req.body;
    if (!memberCode) return res.status(400).json({ message: "memberCode is required" });

    const result = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, u.dob, COALESCE(l.current_stamps,0) AS current_stamps, COALESCE(l.total_rewards,0) AS total_rewards
       FROM users u
       LEFT JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1 LIMIT 1`,
      [memberCode]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "Member not found" });

    const row = result.rows[0];
    let current = Number(row.current_stamps || 0);
    let rewards = Number(row.total_rewards || 0);

    if (current === 0 && rewards === 0) {
      return res.json({
        message: "Nothing to undo",
        card: { memberCode: row.member_code, name: row.name, phone: row.phone, dob: row.dob, currentStamps: current, totalRewards: rewards }
      });
    }

    if (current > 0) {
      current -= 1;
      // remove last stamp_events item
      await db.query(
        `DELETE FROM stamp_events WHERE user_id = $1 AND stamp_number = $2 RETURNING id`,
        [row.id, current + 1]
      );
    } else if (current === 0 && rewards > 0) {
      // rollback a reward -> set to 11 stamps and decrement rewards
      current = 11;
      rewards -= 1;
      // remove latest reward record
      await db.query(`DELETE FROM rewards WHERE user_id = $1 AND issued_at = (SELECT issued_at FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1)`, [row.id]);
    }

    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET current_stamps = $2, total_rewards = $3`,
      [row.id, current, rewards]
    );

    return res.json({
      message: "Stamp undone",
      card: { memberCode: row.member_code, name: row.name, phone: row.phone, dob: row.dob, currentStamps: current, totalRewards: rewards }
    });
  } catch (error) {
    console.error("Remove stamp error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
