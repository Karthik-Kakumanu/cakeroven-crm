// backend/src/controllers/adminController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: "Username & password required" });

    // Find admin in DB
    const result = await db.query(
      `SELECT id, username, password_hash, role 
       FROM admin_users 
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const admin = result.rows[0];

    // Check password
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    // Sign token
    const token = jwt.sign(
      {
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      message: "Login successful",
      token,
      username: admin.username,
      role: admin.role,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getCustomers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.member_code,
             u.name,
             u.phone,
             u.dob,              -- 👈 add this
             l.current_stamps,
             l.total_rewards,
             u.created_at
      FROM users u
      JOIN loyalty_accounts l ON l.user_id = u.id
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
    const { memberCode } = req.body;

    if (!memberCode)
      return res.status(400).json({ message: "memberCode required" });

    const user = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, 
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1`,
      [memberCode]
    );

    if (user.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const data = user.rows[0];

    let current = data.current_stamps;
    let reward = data.total_rewards;

    current += 1;

    if (current >= 12) {
      current = 0;    // reset
      reward += 1;    // reward
    }

    await db.query(
      `UPDATE loyalty_accounts 
       SET current_stamps = $1, total_rewards = $2
       WHERE user_id = $3`,
      [current, reward, data.id]
    );

    return res.json({
      message: "Stamp updated",
      card: {
        memberCode: data.member_code,
        name: data.name,
        phone: data.phone,
        currentStamps: current,
        totalRewards: reward,
      },
    });
  } catch (error) {
    console.error("Stamp error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// POST /api/admin/remove-stamp
// body: { memberCode }
exports.removeStamp = async (req, res) => {
  try {
    const { memberCode } = req.body;

    if (!memberCode) {
      return res.status(400).json({ message: "memberCode is required" });
    }

    const result = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone, u.dob,
              l.current_stamps, l.total_rewards
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1`,
      [memberCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    const row = result.rows[0];
    let current = row.current_stamps;
    let rewards = row.total_rewards;

    // If no stamps and no rewards, nothing to undo
    if (current === 0 && rewards === 0) {
      return res.json({
        message: "Nothing to undo",
        card: {
          memberCode: row.member_code,
          name: row.name,
          phone: row.phone,
          dob: row.dob,
          currentStamps: current,
          totalRewards: rewards,
        },
      });
    }

    if (current > 0) {
      // just remove one stamp
      current -= 1;
    } else if (current === 0 && rewards > 0) {
      // we assume last action was completing a reward:
      // go back to 11 stamps and one less reward
      current = 11;
      rewards -= 1;
    }

    await db.query(
      "UPDATE loyalty_accounts SET current_stamps = $1, total_rewards = $2 WHERE user_id = $3",
      [current, rewards, row.id]
    );

    return res.json({
      message: "Stamp undone",
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        dob: row.dob,
        currentStamps: current,
        totalRewards: rewards,
      },
    });
  } catch (error) {
    console.error("Remove stamp error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
