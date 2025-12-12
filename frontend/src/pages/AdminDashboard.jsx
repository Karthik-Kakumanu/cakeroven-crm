// frontend/src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { API_BASE } from "../apiConfig";

/**
 * AdminDashboard.jsx
 * - Modernized, responsive dashboard using Tailwind CSS + Framer Motion
 * - Includes:
 *    - Customers table with compact 12-stamp row and per-stamp date tooltip
 *    - Add/Remove stamp actions (calls backend endpoints)
 *    - Auto-poll for customers (20s)
 *    - Celebration toast that auto-dismisses in 2s
 *    - Insights page with two charts (stamps over time, rewards per month)
 * - Copy-paste ready. Ensure `framer-motion` and `recharts` are installed.
 */

const POLL_INTERVAL = 20_000;
const CELEBRATION_TTL_MS = 2000;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [removingFor, setRemovingFor] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'insights'
  const [celebration, setCelebration] = useState(null); // { memberCode, name, rewards }
  const [insightsData, setInsightsData] = useState({
    stampsOverTime: [], // array of { date: '2025-12-01', stamps: 12 }
    rewardsPerMonth: [], // array of { month: 'Dec', rewards: 3 }
  });

  const pollRef = useRef(null);
  const rewardAudioRef = useRef(null);
  const sessionHistoryRef = useRef({});

  // Derived stats
  const stats = useMemo(() => {
    let totalUsers = customers.length;
    let totalStamps = 0;
    let totalRewards = 0;
    const birthdaysToday = [];

    const now = new Date();
    const d = now.getDate();
    const m = now.getMonth();

    customers.forEach((c) => {
      totalStamps += Number(c.current_stamps || 0);
      totalRewards += Number(c.total_rewards || 0);
      if (c.dob) {
        const dob = new Date(c.dob);
        if (!Number.isNaN(dob.getTime()) && dob.getDate() === d && dob.getMonth() === m) {
          birthdaysToday.push(c);
        }
      }
    });

    return { totalUsers, totalStamps, totalRewards, birthdaysToday };
  }, [customers]);

  // Simple date formatter
  const fmtDate = useCallback((iso) => {
    if (!iso) return null;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("en-GB");
  }, []);

  // Fetch customers
  const fetchCustomers = useCallback(
    async (opts = { silence: false }) => {
      if (!token) {
        navigate("/admin");
        return;
      }
      if (!opts.silence) setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) || {};
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("cr_adminToken");
            localStorage.removeItem("cr_adminUsername");
            navigate("/admin");
            return;
          }
          console.error("Failed loading customers:", data);
          alert(data.message || "Failed to load customers");
          return;
        }

        // Normalize data
        const items = (data.customers || []).map((c) => ({
          id: c.id,
          member_code: c.member_code ?? c.memberCode ?? c.memberId,
          name: c.name ?? c.full_name ?? "",
          phone: c.phone ?? c.mobile ?? "",
          dob: c.dob ?? null,
          current_stamps: Number(c.current_stamps ?? c.currentStamps ?? 0),
          total_rewards: Number(c.total_rewards ?? c.totalRewards ?? 0),
          // stamp_history can be either array or object depending on backend; keep it as-is
          stamp_history: c.stamp_history ?? c.stampHistory ?? null,
          reward_history: c.reward_history ?? c.rewardHistory ?? null,
        }));

        setCustomers(items);

        // Optionally update insights data if returned from backend
        if (Array.isArray(data.stamps_over_time)) {
          setInsightsData((s) => ({ ...s, stampsOverTime: data.stamps_over_time }));
        }
        if (Array.isArray(data.rewards_per_month)) {
          setInsightsData((s) => ({ ...s, rewardsPerMonth: data.rewards_per_month }));
        }
      } catch (err) {
        console.error("fetchCustomers error:", err);
      } finally {
        setLoading(false);
      }
    },
    [token, navigate]
  );

  // New: fetchInsights
  const fetchInsights = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/insights`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("insights fetch failed", res.status);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setInsightsData({
        stampsOverTime: data.stamps_over_time || [],
        rewardsPerMonth: data.rewards_per_month || [],
      });
    } catch (err) {
      console.error("fetchInsights error:", err);
    }
  }, [token]);

  // Polling
  useEffect(() => {
    fetchCustomers();
    pollRef.current = setInterval(() => fetchCustomers({ silence: true }), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchCustomers]);

  // fetch insights when active tab is insights
  useEffect(() => {
    if (activeTab === "insights") {
      fetchInsights();
    }
  }, [activeTab, fetchInsights]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  // Small helpers to get stamp/ reward dates
  const getStampDateFromCustomer = (customer, index) => {
    // server may provide stamp_history as array of { index, date } or object mapping
    if (!customer) return null;
    const sh = customer.stamp_history;
    if (!sh) {
      const sess = sessionHistoryRef.current[customer.member_code];
      return sess?.stamp_history?.[index] ?? null;
    }
    if (Array.isArray(sh)) {
      const f = sh.find((s) => Number(s.index) === Number(index));
      return f?.date ?? null;
    }
    // object mapping or array-like
    return sh[index] ?? null;
  };

  const getRewardHistoryFor = (memberCode) => {
    const c = customers.find((x) => x.member_code === memberCode);
    if (!c) return [];
    const rh = c.reward_history;
    if (!rh) {
      const sess = sessionHistoryRef.current[memberCode];
      return sess?.reward_history ?? [];
    }
    if (Array.isArray(rh)) return rh;
    // object mapping
    return Object.values(rh);
  };

  // Add stamp
  const addStamp = async (memberCode) => {
    if (!token) return;
    setAddingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = (await res.json().catch(() => ({}))) || {};
      if (!res.ok) {
        console.error("add-stamp failed:", res.status, data);
        alert(data.message || "Server error adding stamp");
        return;
      }

      // update local customers
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? {
                ...c,
                current_stamps: Number(data.card?.currentStamps ?? data.card?.current_stamps ?? data.current_stamps ?? c.current_stamps ?? 0),
                total_rewards: Number(data.card?.totalRewards ?? data.card?.total_rewards ?? data.total_rewards ?? c.total_rewards ?? 0),
              }
            : c
        )
      );

      // update session fallback history
      const nowIso = new Date().toISOString();
      const sess = sessionHistoryRef.current[memberCode] || { stamp_history: {}, reward_history: [] };
      const newIndex = Number(data.card?.currentStamps ?? data.card?.current_stamps ?? 0) || 1;
      sess.stamp_history = sess.stamp_history || {};
      sess.stamp_history[newIndex] = nowIso;

      // if reward awarded, show celebration and push reward
      if (data.awarded || (data.card && Number(data.card.currentStamps ?? data.card.current_stamps) === 0 && Number(data.card.totalRewards ?? data.card.total_rewards) > 0)) {
        sess.reward_history = sess.reward_history || [];
        sess.reward_history.push(nowIso);
        const name = customers.find((x) => x.member_code === memberCode)?.name ?? "";
        const rewards = Number(data.card?.totalRewards ?? data.card?.total_rewards ?? data.total_rewards ?? 0);
        // show celebration (auto-dismiss)
        setCelebration({ memberCode, name, rewards });
        // play chime if present
        try {
          rewardAudioRef.current?.play().catch(() => {});
        } catch (e) {}
      }
      sessionHistoryRef.current[memberCode] = sess;
    } catch (err) {
      console.error("addStamp error:", err);
      alert("Server error while adding stamp");
    } finally {
      setAddingFor(null);
    }
  };

  // Remove stamp
  const removeStamp = async (memberCode) => {
    if (!token) return;
    setRemovingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = (await res.json().catch(() => ({}))) || {};
      if (!res.ok) {
        console.error("remove-stamp failed:", res.status, data);
        alert(data.message || "Server error removing stamp");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? {
                ...c,
                current_stamps: Number(data.card?.currentStamps ?? data.card?.current_stamps ?? c.current_stamps ?? 0),
                total_rewards: Number(data.card?.totalRewards ?? data.card?.total_rewards ?? c.total_rewards ?? 0),
              }
            : c
        )
      );

      // update session fallback
      const sess = sessionHistoryRef.current[memberCode];
      if (sess && sess.stamp_history) {
        const keys = Object.keys(sess.stamp_history)
          .map(Number)
          .sort((a, b) => b - a);
        if (keys.length) delete sess.stamp_history[keys[0]];
      }
      sessionHistoryRef.current[memberCode] = sess || { stamp_history: {}, reward_history: [] };
    } catch (err) {
      console.error("removeStamp error:", err);
      alert("Server error while removing stamp");
    } finally {
      setRemovingFor(null);
    }
  };

  // toggle stamp (click handler): add or remove a single stamp
  const toggleStampIndex = async (memberCode, index) => {
    const c = customers.find((x) => x.member_code === memberCode);
    if (!c) return;
    const current = Number(c.current_stamps || 0);
    if (index <= current) {
      await removeStamp(memberCode);
    } else {
      await addStamp(memberCode);
    }
  };

  // Auto-dismiss celebration after CELEBRATION_TTL_MS
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), CELEBRATION_TTL_MS);
    return () => clearTimeout(t);
  }, [celebration]);

  // Generate minimal insights if backend didn't provide data (fallback)
  useEffect(() => {
    if ((insightsData.stampsOverTime || []).length === 0) {
      // build a small synthetic sample using customers and session history
      const now = new Date();
      const arr = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString("en-GB");
        // sum of stamps recorded today in sessionHistory fallback
        let stampsToday = 0;
        customers.forEach((c) => {
          const sh = c.stamp_history;
          if (Array.isArray(sh)) {
            stampsToday += sh.filter((s) => new Date(s.date).toDateString() === d.toDateString()).length;
          } else if (sh && typeof sh === "object") {
            Object.values(sh).forEach((v) => {
              try {
                if (new Date(v).toDateString() === d.toDateString()) stampsToday++;
              } catch {}
            });
          } else {
            // check sessionHistoryRef
            const sess = sessionHistoryRef.current[c.member_code];
            if (sess && sess.stamp_history) {
              Object.values(sess.stamp_history).forEach((v) => {
                try {
                  if (new Date(v).toDateString() === d.toDateString()) stampsToday++;
                } catch {}
              });
            }
          }
        });
        arr.push({ date: label, stamps: stampsToday });
      }
      setInsightsData((s) => ({ ...s, stampsOverTime: arr }));
    }
    if ((insightsData.rewardsPerMonth || []).length === 0) {
      // small synthetic rewards per month sample: last 6 months
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = m.toLocaleString("en-GB", { month: "short" });
        // count rewards in sessionHistory fallback
        let count = 0;
        customers.forEach((c) => {
          const rh = c.reward_history;
          if (Array.isArray(rh)) {
            rh.forEach((d) => {
              try {
                const dt = new Date(d);
                if (dt.getMonth() === m.getMonth() && dt.getFullYear() === m.getFullYear()) count++;
              } catch {}
            });
          } else if (rh && typeof rh === "object") {
            Object.values(rh).forEach((d) => {
              try {
                const dt = new Date(d);
                if (dt.getMonth() === m.getMonth() && dt.getFullYear() === m.getFullYear()) count++;
              } catch {}
            });
          } else {
            const sess = sessionHistoryRef.current[c.member_code];
            if (sess && sess.reward_history) {
              sess.reward_history.forEach((d) => {
                try {
                  const dt = new Date(d);
                  if (dt.getMonth() === m.getMonth() && dt.getFullYear() === m.getFullYear()) count++;
                } catch {}
              });
            }
          }
        });
        months.push({ month: label, rewards: count });
      }
      setInsightsData((s) => ({ ...s, rewardsPerMonth: months }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // CSV export
  const exportCSV = (rows, filename = "cakeroven_customers.csv") => {
    if (!rows || !rows.length) {
      alert("No data to export");
      return;
    }
    const header = ["S.No", "Member ID", "Name", "Phone", "DOB", "Current Stamps", "Total Rewards"];
    const lines = [header.join(",")];
    rows.forEach((r, idx) => {
      const row = [
        idx + 1,
        `"${String(r.member_code || "")}"`,
        `"${String(r.name || "")}"`,
        `"${String(r.phone || "")}"`,
        `"${r.dob ? new Date(r.dob).toLocaleDateString("en-GB") : ""}"`,
        r.current_stamps ?? 0,
        r.total_rewards ?? 0,
      ];
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Render compact 12 stamps row
  const renderStampRowCompact = (memberCode, current) => {
    const boxes = [];
    for (let i = 1; i <= 12; i++) {
      const filled = i <= current;
      const dateStr = getStampDateFromCustomer(customers.find((c) => c.member_code === memberCode), i);
      boxes.push(
        <div key={i} className="flex flex-col items-center">
          <button
            onClick={() => toggleStampIndex(memberCode, i)}
            disabled={addingFor === memberCode || removingFor === memberCode}
            className={`h-8 w-8 rounded-full flex items-center justify-center border text-xs transition transform active:scale-95 ${
              filled
                ? "bg-gradient-to-br from-yellow-300 to-yellow-400 text-[#3b1a12] shadow-sm border-transparent"
                : "bg-white text-[#6b3a35] border border-[#f0d7b0] hover:bg-[#fff7e0]"
            }`}
            title={filled ? `Marked — ${fmtDate(dateStr) ?? "date unknown"}` : `Click to stamp #${i}`}
          >
            {i}
          </button>
          <div className="text-[10px] text-[#6b3a35]/60 h-4 mt-1">{dateStr ? fmtDate(dateStr) : ""}</div>
        </div>
      );
    }
    return (
      <div className="flex gap-2 items-center overflow-x-auto py-1">
        {boxes}
      </div>
    );
  };

  // Small inline styles & variants for animations
  const fadeInUp = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 } };

  // If not logged in, redirect (render null)
  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf3df] to-[#f2e6c7] text-[#3b1512]">
      <audio ref={rewardAudioRef} src="/reward-chime.mp3" preload="auto" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/60 backdrop-blur-sm border-b border-[#f0dcb4]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden border border-[#f3dfb1]">
              <img src="/cakeroven-logo.png" alt="CakeRoven" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-[#6b3a35]">CakeRoven Admin</p>
              <p className="text-base font-semibold text-[#3b1512]">Welcome, {adminName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2 bg-white/90 rounded-full p-1 shadow-sm">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-full text-sm ${activeTab === "dashboard" ? "bg-[#501914] text-[#f5e6c8]" : "text-[#3b1512]"}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("insights")}
                className={`px-4 py-2 rounded-full text-sm ${activeTab === "insights" ? "bg-[#501914] text-[#f5e6c8]" : "text-[#3b1512]"}`}
              >
                Insights
              </button>
            </nav>

            <button onClick={handleLogout} className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm font-semibold shadow hover:bg-[#40100f]">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Primary (9 cols desktop) */}
          <div className="col-span-12 lg:col-span-9">
            {activeTab === "dashboard" && (
              <motion.div {...fadeInUp} className="space-y-6">
                {/* Top stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                    <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Total members</p>
                    <p className="text-2xl font-bold mt-1">{stats.totalUsers}</p>
                  </div>
                  <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                    <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Stamps given</p>
                    <p className="text-2xl font-bold mt-1">{stats.totalStamps}</p>
                  </div>
                  <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                    <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Rewards unlocked</p>
                    <p className="text-2xl font-bold mt-1">{stats.totalRewards}</p>
                  </div>
                </div>

                {/* Customer list */}
                <div className="rounded-3xl bg-white shadow-lg border border-[#f3dfb1] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#f3dfb1] flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#3b1512]">Customers</h3>
                      <p className="text-xs text-[#6b3a35]/70">Search and manage stamps directly in the table.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name / phone / member ID"
                        className="px-3 py-2 rounded-2xl border border-[#ecdaba] bg-white text-sm outline-none focus:ring-2 focus:ring-[#f1cf8f]/40 w-72"
                      />
                      <button onClick={() => exportCSV(customers)} className="px-3 py-2 text-sm rounded-full bg-[#501914] text-[#f5e6c8]">
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-3 text-left w-10">S.No</th>
                          <th className="px-3 py-3 text-left w-28">Member ID</th>
                          <th className="px-3 py-3 text-left">Name</th>
                          <th className="px-3 py-3 text-left w-36">Phone</th>
                          <th className="px-3 py-3 text-left w-28">DOB</th>
                          <th className="px-3 py-3 text-left">Stamps</th>
                          <th className="px-3 py-3 text-right w-28">Rewards</th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]">Loading customers…</td>
                          </tr>
                        ) : customers.filter((c) =>
                            [c.name, c.phone, String(c.member_code)].join(" ").toLowerCase().includes(search.trim().toLowerCase())
                          ).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]/70">No customers found.</td>
                          </tr>
                        ) : (
                          customers
                            .filter((c) =>
                              [c.name, c.phone, String(c.member_code)].join(" ").toLowerCase().includes(search.trim().toLowerCase())
                            )
                            .map((c, idx) => (
                              <tr key={c.member_code} className={idx % 2 === 0 ? "bg-[#fffaf0]" : "bg-[#fff4e6]"}>
                                <td className="px-3 py-3 text-xs text-[#6b3a35]/80">{idx + 1}</td>
                                <td className="px-3 py-3 font-mono text-xs text-[#3b1512]">{c.member_code}</td>
                                <td className="px-3 py-3 text-sm text-[#3b1512]">{c.name}</td>
                                <td className="px-3 py-3 text-sm text-[#6b3a35]">{c.phone}</td>
                                <td className="px-3 py-3 text-sm text-[#6b3a35]/80">{c.dob ? new Date(c.dob).toLocaleDateString("en-GB") : "—"}</td>

                                <td className="px-3 py-3">{renderStampRowCompact(c.member_code, Number(c.current_stamps || 0))}</td>

                                <td className="px-3 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        // open rewards modal with this customer - we'll reuse browser alert for simplicity
                                        const hist = getRewardHistoryFor(c.member_code);
                                        if (!hist || hist.length === 0) {
                                          alert("No reward history for this member.");
                                        } else {
                                          alert(`Reward dates:\n${hist.map((d, i) => `${i + 1}. ${fmtDate(d)}`).join("\n")}`);
                                        }
                                      }}
                                      className="px-2 py-1 rounded-full bg-[#fff4d8] text-sm font-semibold border border-[#f1cf8f] shadow-sm"
                                    >
                                      {c.total_rewards ?? 0} 🎁
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "insights" && (
              <motion.div {...fadeInUp} className="space-y-6">
                <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Insights</h3>
                      <p className="text-xs text-[#6b3a35]/70">Quick charts & KPIs — stamps & rewards</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { fetchCustomers({ silence: false }); fetchInsights(); }} className="px-3 py-2 rounded-full bg-white border">
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-[#fffaf0] p-4 border border-[#f3e6c2]">
                      <div className="text-sm text-[#6b3a35]/80 mb-2 font-semibold">Stamps over time</div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={insightsData.stampsOverTime}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3e6c2" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <ReTooltip />
                            <Line type="monotone" dataKey="stamps" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-lg bg-[#fffaf0] p-4 border border-[#f3e6c2]">
                      <div className="text-sm text-[#6b3a35]/80 mb-2 font-semibold">Rewards per month</div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={insightsData.rewardsPerMonth}>
                            <CartesianGrid stroke="#f3e6c2" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <ReTooltip />
                            <Bar dataKey="rewards" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* optional KPIs */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-white p-3 border border-[#f3e6c2] text-center">
                      <div className="text-xs text-[#6b3a35]/70">Active members</div>
                      <div className="text-lg font-bold">{stats.totalUsers}</div>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-[#f3e6c2] text-center">
                      <div className="text-xs text-[#6b3a35]/70">Total stamps</div>
                      <div className="text-lg font-bold">{stats.totalStamps}</div>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-[#f3e6c2] text-center">
                      <div className="text-xs text-[#6b3a35]/70">Rewards issued</div>
                      <div className="text-lg font-bold">{stats.totalRewards}</div>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-[#f3e6c2] text-center">
                      <div className="text-xs text-[#6b3a35]/70">Birthdays today</div>
                      <div className="text-lg font-bold">{stats.birthdaysToday.length}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right column */}
          <aside className="col-span-12 lg:col-span-3 space-y-6">
            <motion.div {...fadeInUp} className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-full bg-[#fff3d9] p-2">
                  <span className="text-xl">🎂</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#3b1512]">Today's CakeRoven birthdays</p>
                  <p className="text-xs text-[#6b3a35]/70">Celebrate with a special note or offer</p>
                </div>
              </div>

              {stats.birthdaysToday.length === 0 ? (
                <p className="text-sm text-[#6b3a35]/70 mt-2">No member birthdays today.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {stats.birthdaysToday.map((b) => (
                    <li key={b.member_code} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{b.name}</div>
                        <div className="text-xs font-mono text-[#6b3a35]/70">{b.member_code} • {b.phone}</div>
                      </div>
                      <div className="text-xs text-[#6b3a35]/60">{new Date(b.dob).toLocaleDateString("en-GB")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            <motion.div {...fadeInUp} className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <p className="text-sm font-semibold text-[#3b1512] mb-2">Almost at reward</p>
              <p className="text-xs text-[#6b3a35]/70 mb-3">Customers with 9–11 stamps (closest to unlocking)</p>

              {customers.length === 0 ? (
                <p className="text-sm text-[#6b3a35]/70">No data</p>
              ) : (
                <>
                  {customers
                    .filter((c) => {
                      const s = Number(c.current_stamps || 0);
                      return s >= 9 && s < 12;
                    })
                    .sort((a, b) => Number(b.current_stamps || 0) - Number(a.current_stamps || 0))
                    .slice(0, 6)
                    .map((c) => (
                      <div key={c.member_code} className="flex items-center justify-between bg-[#fffaf0] p-2 rounded-lg border border-[#f3e6c2] mb-2">
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-xs font-mono text-[#6b3a35]/70">{c.member_code}</div>
                        </div>
                        <div><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-[12px] font-semibold">{c.current_stamps}/12</span></div>
                      </div>
                    ))}
                </>
              )}

              <p className="mt-3 text-xs text-[#6b3a35]/60">
                Tip: use quick SMS or push messages to remind these members — they’re closest to a free CakeRoven treat 🎁
              </p>
            </motion.div>

            <motion.div {...fadeInUp} className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <p className="text-sm font-semibold text-[#3b1512] mb-2">Quick actions</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => { fetchCustomers({ silence: false }); if (activeTab === 'insights') fetchInsights(); }} className="w-full px-3 py-2 rounded-lg bg-white border border-[#ecd9b4] text-sm hover:bg-[#fff9ee]">
                  Refresh data now
                </button>
                <button onClick={() => exportCSV(customers)} className="w-full px-3 py-2 rounded-lg bg-[#501914] text-white text-sm hover:bg-[#40100f]">
                  Export visible → CSV
                </button>
              </div>
            </motion.div>
          </aside>
        </div>
      </main>

      {/* Celebration toast - auto-dismiss 2s (AnimatePresence + motion) */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
        <AnimatePresence>
          {celebration && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28 }}
              className="pointer-events-auto"
            >
              <div className="max-w-sm w-full rounded-2xl bg-[#501914] text-[#f5e6c8] shadow-2xl p-4 border border-[#fcd9a7]">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🎉</div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#f5e6c8]/80">Reward unlocked</div>
                    <div className="font-bold text-lg mt-1">{celebration.name || celebration.memberCode} completed 12 stamps</div>
                    <div className="text-sm mt-1">Member <span className="font-mono">{celebration.memberCode}</span> now has <span className="font-semibold">{celebration.rewards}</span> rewards</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
