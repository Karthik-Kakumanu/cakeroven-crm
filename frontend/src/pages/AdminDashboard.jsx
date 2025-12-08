import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import { API_BASE } from "../apiConfig";


export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null); // "CR0001-add" / "CR0001-remove"
  const [rewardSplash, setRewardSplash] = useState(null); // {memberCode, name}

  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  // ===== LOAD CUSTOMERS =====
  useEffect(() => {
    if (!token) {
      navigate("/admin-login");
      return;
    }

    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("cr_adminToken");
            localStorage.removeItem("cr_adminUsername");
            navigate("/admin-login");
            return;
          }
          alert(data.message || "Failed to load customers");
          setLoading(false);
          return;
        }

        const list = (data.customers || []).slice().sort((a, b) =>
          (a.member_code || "").localeCompare(b.member_code || "")
        );

        setCustomers(list);
        setFiltered(list);
        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("Server error");
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [navigate, token]);

  // ===== SEARCH FILTER =====
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFiltered(customers);
    } else {
      setFiltered(
        customers.filter((c) => {
          return (
            c.name?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.member_code?.toLowerCase().includes(q)
          );
        })
      );
    }
  }, [search, customers]);

  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin-login");
  };

  // ===== ANALYTICS + CHART DATA + BIRTHDAYS =====
  const {
    totalCustomers,
    totalStamps,
    totalRewards,
    todayBirthdays,
    chartData,
  } = useMemo(() => {
    const totalCustomers = customers.length;
    let totalStamps = 0;
    let totalRewards = 0;
    const todayBirthdays = [];

    const today = new Date();
    const tMonth = today.getMonth() + 1;
    const tDay = today.getDate();

    const byDate = new Map();

    customers.forEach((c) => {
      const stampsForPerson =
        (c.current_stamps || 0) + (c.total_rewards || 0) * 12;
      totalStamps += c.current_stamps || 0;
      totalRewards += c.total_rewards || 0;

      if (c.dob) {
        const d = new Date(c.dob);
        if (d.getMonth() + 1 === tMonth && d.getDate() === tDay) {
          todayBirthdays.push(c);
        }
      }

      const created = c.created_at ? new Date(c.created_at) : null;
      const key = created
        ? created.toISOString().slice(0, 10)
        : "Unknown";

      if (!byDate.has(key)) {
        byDate.set(key, { date: key, members: 0, stamps: 0 });
      }
      const entry = byDate.get(key);
      entry.members += 1;
      entry.stamps += stampsForPerson;
    });

    const chartData = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return {
      totalCustomers,
      totalStamps,
      totalRewards,
      todayBirthdays,
      chartData,
    };
  }, [customers]);

  // auto hide reward splash
  useEffect(() => {
    if (!rewardSplash) return;
    const t = setTimeout(() => setRewardSplash(null), 4000);
    return () => clearTimeout(t);
  }, [rewardSplash]);

  // ===== STAMP ACTIONS =====
  const handleGiveStamp = async (row) => {
    if (!token) return;

    const key = `${row.member_code}-add`;
    setBusyKey(key);

    const prevStamps = row.current_stamps || 0;
    const prevRewards = row.total_rewards || 0;

    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberCode: row.member_code }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not update stamps");
        setBusyKey(null);
        return;
      }

      const newStamps = data.card.currentStamps;
      const newRewards = data.card.totalRewards;

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === row.member_code
            ? {
                ...c,
                current_stamps: newStamps,
                total_rewards: newRewards,
              }
            : c
        )
      );

      if (
        newRewards > prevRewards &&
        prevStamps === 11 &&
        newStamps === 0
      ) {
        setRewardSplash({
          memberCode: row.member_code,
          name: row.name,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }

    setBusyKey(null);
  };

  const handleUndoStamp = async (row) => {
    if (!token) return;

    const key = `${row.member_code}-remove`;
    setBusyKey(key);

    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberCode: row.member_code }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not undo stamp");
        setBusyKey(null);
        return;
      }

      const newStamps = data.card.currentStamps;
      const newRewards = data.card.totalRewards;

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === row.member_code
            ? {
                ...c,
                current_stamps: newStamps,
                total_rewards: newRewards,
              }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("Server error");
    }

    setBusyKey(null);
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex flex-col items-center py-6 px-8">
      <div className="w-full max-w-6xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#501914] flex items-center justify-center">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f5e6c8]">
                <img
                  src="/cakeroven-logo.png"
                  alt="CakeRoven"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-[#501914]/70">CakeRoven Admin</p>
              <p className="text-base font-semibold text-[#501914]">
                Welcome, {adminName}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-2xl bg-[#501914] text-[#f5e6c8] text-xs font-semibold shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
          >
            Logout
          </button>
        </div>

        {/* Reward splash – NOW BELOW WELCOME */}
        {rewardSplash && (
          <div className="mb-5 bg-white border border-[#501914]/30 rounded-2xl px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.35)] text-sm text-[#501914] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#501914] flex items-center justify-center text-[#f5e6c8] text-lg">
              🎁
            </div>
            <div className="flex-1">
              <p className="font-semibold">
                Gift unlocked for {rewardSplash.name}
              </p>
              <p className="text-xs text-[#501914]/75">
                Member ID{" "}
                <span className="font-mono">{rewardSplash.memberCode}</span>{" "}
                completed 12 stamps. Please offer the reward and continue a new
                cycle.
              </p>
            </div>
            <button
              className="text-xs text-[#501914]/60 ml-2"
              onClick={() => setRewardSplash(null)}
            >
              close
            </button>
          </div>
        )}

        {/* Layout: left = table, right = analytics + chart */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT: search + table */}
          <div className="flex-1 w-full">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name / phone / Member ID"
                className="w-full h-11 rounded-2xl px-4 border border-[#501914]/30 bg-white text-sm text-[#501914] outline-none shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <p className="text-[11px] text-[#501914]/60 mt-1">
                Use this table like Excel – each row is a member. Click{" "}
                <b>Stamp visit</b> when bill ≥ ₹500. Click on last filled circle
                to undo a stamp.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-[0_0_25px_rgba(0,0,0,0.25)] overflow-auto">
              {loading ? (
                <div className="p-6 text-center text-[#501914]">
                  Loading customers…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-[#501914]/70 text-sm">
                  No customers found.
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-[#501914] text-[#f5e6c8]">
                    <tr>
                      <th className="px-3 py-2 text-left">S.No</th>
                      <th className="px-3 py-2 text-left">Member ID</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Date of Birth</th>
                      <th className="px-3 py-2 text-center">
                        Stamps &amp; actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => {
                      const current = c.current_stamps || 0;
                      const dobText = c.dob
                        ? new Date(c.dob).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-";

                      const addKey = `${c.member_code}-add`;

                      return (
                        <tr
                          key={c.member_code}
                          className="border-b border-[#501914]/10 hover:bg-[#f5e6c8]/40"
                        >
                          <td className="px-3 py-2 text-xs text-[#501914]/80">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-[#501914]">
                            {c.member_code}
                          </td>
                          <td className="px-3 py-2 text-xs text-[#501914]">
                            {c.name}
                          </td>
                          <td className="px-3 py-2 text-xs text-[#501914]">
                            {c.phone}
                          </td>
                          <td className="px-3 py-2 text-xs text-[#501914]/80">
                            {dobText}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-4">
                              {/* 12 circles – last filled circle clickable for undo */}
                              <div className="flex gap-1">
                                {Array.from({ length: 12 }).map((_, i) => {
                                  const filled = i < current;
                                  const isLastFilled =
                                    filled && i === current - 1;
                                  const canUndo = current > 0 && isLastFilled;

                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() =>
                                        canUndo ? handleUndoStamp(c) : null
                                      }
                                      className={`w-6 h-6 rounded-full border text-[10px] flex items-center justify-center
                                        ${
                                          filled
                                            ? "bg-[#501914] border-[#501914] text-[#f5e6c8]"
                                            : "border-[#501914]/30 text-[#501914]/30 bg-transparent"
                                        }
                                        ${
                                          canUndo
                                            ? "cursor-pointer hover:scale-110 transition"
                                            : "cursor-default"
                                        }`}
                                      title={
                                        canUndo ? "Click to undo last stamp" : ""
                                      }
                                    >
                                      {filled ? "✓" : ""}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Stamp visit button */}
                              <button
                                type="button"
                                onClick={() => handleGiveStamp(c)}
                                disabled={busyKey === addKey}
                                className="px-4 py-1.5 rounded-full bg-[#501914] text-[#f5e6c8] text-[11px] font-semibold shadow active:scale-95"
                              >
                                {busyKey === addKey
                                  ? "Stamping..."
                                  : "Stamp visit 🎟️"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT: metrics + chart + birthdays */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
            {/* Numbers + chart */}
            <div className="bg-white rounded-2xl shadow-[0_0_25px_rgba(0,0,0,0.25)] p-4">
              <h3 className="text-sm font-semibold text-[#501914] mb-3">
                Loyalty overview
              </h3>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <p className="text-[11px] text-[#501914]/70">Members</p>
                  <p className="text-lg font-bold text-[#501914]">
                    {totalCustomers}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#501914]/70">
                    Active stamps
                  </p>
                  <p className="text-lg font-bold text-[#501914]">
                    {totalStamps}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#501914]/70">Rewards</p>
                  <p className="text-lg font-bold text-[#501914]">
                    {totalRewards}
                  </p>
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickMargin={6}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10 }}
                        tickMargin={4}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10 }}
                        tickMargin={2}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="members"
                        name="Members joined"
                        stroke="#ff4d4f"
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="stamps"
                        name="Total stamps"
                        stroke="#1890ff"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-[11px] text-[#501914]/60">
                  Not enough data for chart yet.
                </p>
              )}
            </div>

            {/* Birthdays card */}
            <div className="rounded-2xl bg-white border border-[#501914]/15 px-4 py-3 shadow text-sm text-[#501914]">
              {todayBirthdays.length > 0 ? (
                <>
                  <p className="font-semibold mb-1">
                    🎂 Today&apos;s CakeRoven birthdays
                  </p>
                  <ul className="space-y-1 text-[13px]">
                    {todayBirthdays.map((b) => (
                      <li key={b.member_code}>
                        <span className="font-mono text-xs">
                          {b.member_code}
                        </span>{" "}
                        – {b.name} ({b.phone})
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[13px] text-[#501914]/80">
                  🎂 No member birthdays today.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
