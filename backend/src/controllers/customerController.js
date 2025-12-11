// backend/src/controllers/customerController.js
const db = require("../config/db");

/**
 * Helper: Return { blocked: boolean, key: string|null, message: string|null, ist: Date }
 * Compares month/day in Indian Standard Time (UTC+5:30).
 */
function getIstHolidayStatus() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 19800000
  const ist = new Date(now.getTime() + istOffsetMs);

  const day = ist.getDate();
  const month = ist.getMonth() + 1;

  if (month === 12 && day === 25) {
    return {
      blocked: true,
      key: "christmas",
      message: "Happy Christmas 🎄 — CakeRoven loyalty stamps are not available today.",
      ist,
    };
  }
  if (month === 12 && day === 31) {
    return {
      blocked: true,
      key: "newyear-eve",
      message: "New Year's Eve 🎆 — CakeRoven loyalty stamps are not available today.",
      ist,
    };
  }
  if (month === 1 && day === 1) {
    return {
      blocked: true,
      key: "newyear-day",
      message: "Happy New Year 🎉 — CakeRoven loyalty stamps are not available today.",
      ist,
    };
  }

  return { blocked: false, key: null, message: null, ist };
}

/**
 * GET /api/customer/card/:memberCode?phone=...
 * - Validates phone matches the member
 * - Returns card info (member_code, name, phone masked/unmasked, current_stamps, total_rewards)
 * - If today is a blocked holiday (IST), returns 403 with friendly message
 */
exports.getCard = async (req, res) => {
  try {
    const { memberCode } = req.params;
    const phone = (req.query.phone || "").trim();

    if (!memberCode) {
      return res.status(400).json({ message: "memberCode required" });
    }

    // Check holiday first (server authoritative)
    const holiday = getIstHolidayStatus();
    if (holiday.blocked) {
      return res.status(403).json({ message: holiday.message });
    }

    // Fetch user + loyalty
    const result = await db.query(
      `SELECT u.id, u.member_code, u.name, u.phone,
              l.current_stamps, l.total_rewards, u.dob
       FROM users u
       JOIN loyalty_accounts l ON l.user_id = u.id
       WHERE u.member_code = $1
       LIMIT 1`,
      [memberCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    const row = result.rows[0];

    // Basic phone check: if frontend provided phone, ensure it matches for security
    // (This prevents anyone just by guessing memberCode seeing card on client side)
    if (!phone) {
      // If phone not provided, still return limited data but do not expose full phone
      // We'll return masked phone and require phone to be sent for full view (frontend flow expects phone stored)
      const maskedPhone =
        row.phone && row.phone.length >= 3
          ? "••••••" + row.phone.slice(-3)
          : "••••••••••";

      return res.json({
        card: {
          memberCode: row.member_code,
          name: row.name,
          phone: maskedPhone,
          currentStamps: row.current_stamps,
          totalRewards: row.total_rewards,
        },
      });
    }

    // If phone provided, verify exact match (owner wants simple number check, not OTP)
    if (phone !== row.phone) {
      // Phone mismatch → do not reveal sensitive info
      return res.status(403).json({ message: "Phone number does not match our records." });
    }

    // Success: return full card
    return res.json({
      card: {
        memberCode: row.member_code,
        name: row.name,
        phone: row.phone,
        dob: row.dob,
        currentStamps: row.current_stamps,
        totalRewards: row.total_rewards,
      },
    });
  } catch (err) {
    console.error("getCard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/customer/register
 * body: { name, phone, dob (optional) }
 * - Validates required fields
 * - Ensures phone uniqueness
 * - Creates user and loyalty account
 * - Generates member_code as CR + zero-padded id (CR0001)
 */
exports.register = async (req, res) => {
  const client = await db.connect();
  try {
    const { name, phone, dob } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    // Normalize phone string
    const phoneClean = String(phone).trim();

    // check existing phone
    const existing = await client.query("SELECT id, member_code FROM users WHERE phone = $1 LIMIT 1", [phoneClean]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "Phone already registered. You are already a member.",
        memberCode: existing.rows[0].member_code,
      });
    }

    // Start transaction for safe insert + member_code generation
    await client.query("BEGIN");

    // Insert user (member_code will be generated after getting id)
    const insertText = `
      INSERT INTO users (name, phone, dob, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `;
    const insertRes = await client.query(insertText, [name.trim(), phoneClean, dob || null]);
    const userId = insertRes.rows[0].id;

    // Generate member_code from id: CR + zero-padded 4 digits
    const memberCode = "CR" + String(userId).padStart(4, "0");

    // Update user with member_code
    await client.query("UPDATE users SET member_code = $1 WHERE id = $2", [memberCode, userId]);

    // Create loyalty account row
    await client.query(
      `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, created_at)
       VALUES ($1, 0, 0, NOW())`,
      [userId]
    );

    await client.query("COMMIT");

    // Return card-ish info (phone included)
    return res.status(201).json({
      message: "Registration successful",
      card: {
        memberCode,
        name: name.trim(),
        phone: phoneClean,
        dob: dob || null,
        currentStamps: 0,
        totalRewards: 0,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("register error:", err);
    // detect unique phone constraint error if DB enforced
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "Phone already registered" });
    }
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
