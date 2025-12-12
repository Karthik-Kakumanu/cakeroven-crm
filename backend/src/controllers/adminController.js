// backend/src/controllers/adminController.js
// Admin controller: list customers, add/remove stamp, reward history, export CSV
// Uses transactions and SELECT ... FOR UPDATE to avoid race conditions.

const { pool } = require("../config/db"); // <-- updated path
const { Parser } = require("json2csv"); // optional, ensure json2csv is installed (npm i json2csv)

const STAMPS_TO_REWARD = 12;

/**
 * GET /api/admin/customers
 * Return joined customer + loyalty_account rows
 */
async function getCustomers(req, res) {
  try {
    const sql = `
      SELECT u.id as user_id,
             u.member_code,
             u.name,
             u.phone,
             u.dob,
             u.created_at,
             la.id AS loyalty_id,
             la.current_stamps,
             la.total_rewards,
             la.updated_at
      FROM users u
      LEFT JOIN loyalty_accounts la ON la.user_id = u.id
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(sql);
    return res.json({ customers: rows });
  } catch (err) {
    console.error("getCustomers error:", err);
    return res.status(500).json({ message: "Failed to fetch customers" });
  }
}

/**
 * POST /api/admin/add-stamp
 * { memberCode }
 */
async function addStamp(req, res) {
  const { memberCode } = req.body || {};
  if (!memberCode) {
    return res.status(400).json({ message: "memberCode required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // find user
    const userRes = await client.query(
      "SELECT id, member_code, name, phone FROM users WHERE member_code = $1",
      [memberCode]
    );
    if (userRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }
    const user = userRes.rows[0];

    // lock loyalty_account row (or create if missing)
    let la = null;
    const laSel = await client.query(
      "SELECT id, user_id, current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE",
      [user.id]
    );

    if (laSel.rowCount === 0) {
      const ins = await client.query(
        `INSERT INTO loyalty_accounts (user_id, current_stamps, total_rewards, updated_at)
         VALUES ($1, 0, 0, now()) RETURNING id, current_stamps, total_rewards`,
        [user.id]
      );
      la = ins.rows[0];
    } else {
      la = laSel.rows[0];
    }

    let currentStamps = Number(la.current_stamps || 0);
    let totalRewards = Number(la.total_rewards || 0);

    currentStamps += 1;

    let rewardIssued = false;
    if (currentStamps >= STAMPS_TO_REWARD) {
      currentStamps = 0;
      totalRewards += 1;
      rewardIssued = true;
    }

    await client.query(
      `UPDATE loyalty_accounts
       SET current_stamps = $1, total_rewards = $2, updated_at = now()
       WHERE id = $3`,
      [currentStamps, totalRewards, la.id]
    );

    if (rewardIssued) {
      await client.query(
        `INSERT INTO rewards (user_id, issued_at) VALUES ($1, now())`,
        [user.id]
      );
    }

    await client.query("COMMIT");

    const updatedCard = {
      user_id: user.id,
      memberCode: user.member_code,
      name: user.name,
      phone: user.phone,
      currentStamps,
      totalRewards,
    };

    return res.json({ message: "Stamp added", card: updatedCard });
  } catch (err) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("addStamp error:", err);
    return res.status(500).json({ message: "Server error adding stamp", error: err.message });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/remove-stamp
 * { memberCode }
 */
async function removeStamp(req, res) {
  const { memberCode } = req.body || {};
  if (!memberCode) {
    return res.status(400).json({ message: "memberCode required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query("SELECT id, member_code FROM users WHERE member_code = $1", [memberCode]);
    if (userRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not found" });
    }
    const user = userRes.rows[0];

    const laSel = await client.query("SELECT id, current_stamps, total_rewards FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE", [user.id]);

    if (laSel.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No loyalty account found for member" });
    }

    let { id: laId, current_stamps: currentStamps, total_rewards: totalRewards } = laSel.rows[0];
    currentStamps = Number(currentStamps || 0);
    totalRewards = Number(totalRewards || 0);

    if (currentStamps > 0) {
      currentStamps -= 1;
    } else {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No stamps to remove" });
    }

    await client.query(
      `UPDATE loyalty_accounts SET current_stamps = $1, updated_at = now() WHERE id = $2`,
      [currentStamps, laId]
    );

    await client.query("COMMIT");

    const updatedCard = {
      user_id: user.id,
      memberCode: user.member_code,
      currentStamps,
      totalRewards,
    };

    return res.json({ message: "Stamp removed", card: updatedCard });
  } catch (err) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("removeStamp error:", err);
    return res.status(500).json({ message: "Server error removing stamp", error: err.message });
  } finally {
    client.release();
  }
}

/**
 * GET /api/admin/reward-history/:memberCode
 */
async function getRewardHistoryFor(req, res) {
  const memberCode = req.params.memberCode || req.query.memberCode;
  if (!memberCode) return res.status(400).json({ message: "memberCode required" });

  try {
    const userRes = await pool.query("SELECT id FROM users WHERE member_code = $1", [memberCode]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Member not found" });
    }
    const userId = userRes.rows[0].id;

    const r = await pool.query(
      "SELECT id, issued_at FROM rewards WHERE user_id = $1 ORDER BY issued_at ASC",
      [userId]
    );

    return res.json({ rewards: r.rows });
  } catch (err) {
    console.error("getRewardHistoryFor error:", err);
    return res.status(500).json({ message: "Failed to get reward history" });
  }
}

/**
 * GET /api/admin/export-customers.csv
 */
async function exportCustomersCsv(req, res) {
  try {
    const sql = `
      SELECT u.member_code, u.name, u.phone, u.dob,
             la.current_stamps, la.total_rewards, la.updated_at
      FROM users u
      LEFT JOIN loyalty_accounts la ON la.user_id = u.id
      ORDER BY u.id;
    `;
    const { rows } = await pool.query(sql);
    const fields = ["member_code", "name", "phone", "dob", "current_stamps", "total_rewards", "updated_at"];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="cakeroven_customers_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error("exportCustomersCsv error:", err);
    return res.status(500).json({ message: "Failed to export CSV" });
  }
}

module.exports = {
  getCustomers,
  addStamp,
  removeStamp,
  getRewardHistoryFor,
  exportCustomersCsv,
};
