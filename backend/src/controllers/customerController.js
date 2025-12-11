// src/controllers/customerController.js
const db = require("../config/db");
const generateMemberCode = require("../utils/generateMemberCode");

// Helper: safe ISO converter for DB timestamps
function safeToISOString(v) {
  if (!v) return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v.toISOString === "function") return v.toISOString();
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

async function loadUserAndAccount(memberCode) {
  const r = await db.query(
    `SELECT u.id, u.member_code, u.name, u.phone, u.dob,
            COALESCE(l.current_stamps,0) AS current_stamps, COALESCE(l.total_rewards,0) AS total_rewards
     FROM users u
     LEFT JOIN loyalty_accounts l ON l.user_id = u.id
     WHERE u.member_code = $1
     LIMIT 1`,
    [memberCode]
  );
  return r.rows[0] || null;
}

exports.register = async (req, res) => {
  try {
    const { name, phone, dob } = req.body;
    if (!name || !phone) return res.status(400).json({ message: "Name & phone required" });

    // Ensure user with phone doesn't already exist
    const existing = await db.query("SELECT id, member_code FROM users WHERE phone = $1 LIMIT 1", [phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Phone already registered", memberCode: existing.rows[0].member_code });
    }

    const member_code = await generateMemberCode();

    const created = await db.query(
      `INSERT INTO users (member_code, name, phone, dob, created_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING id, member_code, name, phone, dob`,
      [member_code, name, phone, dob || null]
    );

    const user = created.rows[0];

    // create loyalty account
    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1,0,0)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    return res.json({ ok: true, memberCode: user.member_code, user });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const r = await db.query("SELECT member_code, name, phone FROM users WHERE phone = $1 LIMIT 1", [phone]);
    if (r.rows.length === 0) return res.status(404).json({ message: "User not found" });

    return res.json({ ok: true, memberCode: r.rows[0].member_code, name: r.rows[0].name });
  } catch (err) {
    console.error("LoginByPhone error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCard = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phoneHeader = (req.headers["x-customer-phone"] || "").trim();
    const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const user = await loadUserAndAccount(memberCode);
    if (!user) return res.status(404).json({ message: "Member not found" });

    if (!phoneHeader && !auth) return res.status(401).json({ message: "Phone or token required to view this card" });

    if (phoneHeader && phoneHeader !== String(user.phone)) return res.status(403).json({ message: "Phone does not match member" });

    const stampsRes = await db.query(
      `SELECT stamp_number, stamped_at
       FROM stamp_events
       WHERE user_id = $1
       ORDER BY stamped_at ASC`,
      [user.id]
    ).catch(() => ({ rows: [] }));

    const stampMap = {};
    for (const r of stampsRes.rows || []) {
      const num = Number(r.stamp_number);
      if (num >= 1 && num <= 12) stampMap[num] = r.stamped_at;
    }

    const stampHistory = Array.from({ length: 12 }).map((_, i) => safeToISOString(stampMap[i + 1] || null));

    const rewardRes = await db.query(`SELECT issued_at FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1`, [user.id]).catch(() => ({ rows: [] }));
    const reward_issued_at = rewardRes.rows && rewardRes.rows[0] ? safeToISOString(rewardRes.rows[0].issued_at) : null;

    const card = {
      memberCode: user.member_code,
      name: user.name,
      phone: user.phone,
      currentStamps: Number(user.current_stamps || 0),
      totalRewards: Number(user.total_rewards || 0),
      stampHistory,
      rewardIssuedAt: reward_issued_at
    };

    return res.json({ ok: true, card });
  } catch (err) {
    console.error("Get card error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
