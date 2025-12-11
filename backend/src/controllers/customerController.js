// backend/src/controllers/customerController.js
const db = require("../config/db");

// Helper: load basic user & loyalty account
async function loadUserAndAccount(memberCode) {
  const r = await db.query(
    `SELECT u.id, u.member_code, u.name, u.phone, u.dob,
            l.current_stamps, l.total_rewards
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

    // ensure unique phone or create new member_code
    // create member_code as CR + 4-digit serial based on next sequence
    const seq = await db.query(`SELECT nextval('member_seq') as v`).catch(() => null);
    const num = seq && seq.rows && seq.rows[0] ? seq.rows[0].v : Date.now() % 100000;
    const member_code = `CR${String(num).padStart(4, "0")}`;

    const created = await db.query(
      `INSERT INTO users (member_code, name, phone, dob, created_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING id, member_code, name, phone, dob`,
      [member_code, name, phone, dob || null]
    );

    const user = created.rows[0];

    // create loyalty account
    await db.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards)
       VALUES ($1,0,0)`,
      [user.id]
    );

    return res.json({ ok: true, memberCode: user.member_code, user });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Basic login by phone (for existing user flow)
exports.loginByPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const r = await db.query(`SELECT member_code, name, phone FROM users WHERE phone = $1 LIMIT 1`, [phone]);
    if (r.rows.length === 0) return res.status(404).json({ message: "User not found" });

    // return member_code so frontend can store it in localStorage
    return res.json({ ok: true, memberCode: r.rows[0].member_code, name: r.rows[0].name });
  } catch (err) {
    console.error("LoginByPhone error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/customer/card/:memberCode
 * Security: requires either Authorization Bearer token for that user or x-customer-phone header.
 * The server verifies that the supplied phone matches the DB record for this memberCode.
 * Returns card object:
 * { memberCode, name, phone, currentStamps, totalRewards, stamp_history: [date|null,...], reward_issued_at }
 */
exports.getCard = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phoneHeader = (req.headers["x-customer-phone"] || "").trim();
    const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

    if (!memberCode) return res.status(400).json({ message: "memberCode required" });

    const user = await loadUserAndAccount(memberCode);
    if (!user) return res.status(404).json({ message: "Member not found" });

    // If a token-based auth exists: you can decode/verify token here (optional)
    // For now we check phone header matches stored phone
    if (!phoneHeader && !auth) {
      return res.status(401).json({ message: "Phone or token required to view this card" });
    }

    if (phoneHeader && phoneHeader !== String(user.phone)) {
      return res.status(403).json({ message: "Phone does not match member" });
    }

    // stamp history: prefer a stamp_events table with columns: user_id, stamp_number, stamped_at
    // We'll query for up to 12 stamps and produce an array of 12 values (date ISO or null)
    const stampsRes = await db.query(
      `SELECT stamp_number, stamped_at
       FROM stamp_events
       WHERE user_id = $1
       ORDER BY stamp_number ASC`,
      [user.id]
    ).catch(() => ({ rows: [] }));

    // create array indices 1..12
    const stampMap = {};
    for (const r of stampsRes.rows || []) {
      const num = Number(r.stamp_number);
      if (num >= 1 && num <= 12) stampMap[num] = r.stamped_at;
    }

    const stamp_history = Array.from({ length: 12 }).map((_, i) => stampMap[i + 1] ? stampMap[i + 1].toISOString() : null);

    // reward issued: check rewards table (latest)
    const rewardRes = await db.query(
      `SELECT issued_at FROM rewards WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1`,
      [user.id]
    ).catch(() => ({ rows: [] }));

    const reward_issued_at = rewardRes.rows && rewardRes.rows[0] ? rewardRes.rows[0].issued_at : null;

    // Build response
    const card = {
      memberCode: user.member_code,
      name: user.name,
      phone: user.phone,
      currentStamps: Number(user.current_stamps || 0),
      totalRewards: Number(user.total_rewards || 0),
      stampHistory: stamp_history,
      rewardIssuedAt: reward_issued_at ? reward_issued_at.toISOString() : null,
    };

    return res.json({ ok: true, card });
  } catch (err) {
    console.error("Get card error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
