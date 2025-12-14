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
 * AdminDashboard.jsx (Full Desktop Version)
 * - Layout: Full width (w-full), optimized for Desktop screens.
 * - Date Fix: Forces "Asia/Kolkata" timezone display.
 * - Reset Logic: Dates are hidden for empty stamps (erased on reset).
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
  const [celebration, setCelebration] = useState(null);
  const [insightsData, setInsightsData] = useState({
    stampsOverTime: [],
    rewardsPerMonth: [],
  });

  const pollRef = useRef(null);
  const rewardAudioRef = useRef(null);
  const sessionHistoryRef = useRef({});

  // --- Derived Stats ---
  const stats = useMemo(() => {
    let totalUsers = customers.length;
    let totalStamps = 0;
    let totalRewards = 0;
    const birthdaysToday = [];

    // Get current date in IST to compare birthdays correctly
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istString);
    const d = istDate.getDate();
    const m = istDate.getMonth();

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

  // --- Date Formatter (IST Fixed) ---
  const fmtDate = useCallback((iso) => {
    if (!iso) return null;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    
    // ✅ FORCE IST TIMEZONE
    return dt.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }, []);

  // --- Fetch Data ---
  const fetchCustomers = useCallback(
    async (opts = { silence: false }) => {
      if (!token) { navigate("/admin"); return; }
      if (!opts.silence) setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) || {};
        
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("cr_adminToken");
            navigate("/admin");
            return;
          }
          console.error("Failed loading customers:", data);
          return;
        }

        const items = (data.customers || []).map((c) => ({
          id: c.id,
          member_code: c.member_code,
          name: c.name,
          phone: c.phone,
          dob: c.dob,
          current_stamps: Number(c.current_stamps || 0),
          total_rewards: Number(c.total_rewards || 0),
          stamp_history: c.stamp_history, // Contains history array
          reward_history: c.reward_history,
        }));

        setCustomers(items);

        if (data.stamps_over_time) setInsightsData(s => ({ ...s, stampsOverTime: data.stamps_over_time }));
        if (data.rewards_per_month) setInsightsData(s => ({ ...s, rewardsPerMonth: data.rewards_per_month }));

      } catch (err) {
        console.error("fetchCustomers error:", err);
      } finally {
        setLoading(false);
      }
    },
    [token, navigate]
  );

  const fetchInsights = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/insights`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInsightsData({
          stampsOverTime: data.stamps_over_time || [],
          rewardsPerMonth: data.rewards_per_month || [],
        });
      }
    } catch (err) {}
  }, [token]);

  useEffect(() => {
    fetchCustomers();
    pollRef.current = setInterval(() => fetchCustomers({ silence: true }), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchCustomers]);

  useEffect(() => {
    if (activeTab === "insights") fetchInsights();
  }, [activeTab, fetchInsights]);

  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  // --- STAMP LOGIC (Date Reset Fix) ---
  const getLatestStampDate = (customer, index) => {
    if (!customer || !customer.stamp_history) return null;
    
    // stamp_history comes from DB as array of objects: { index: 1, date: "2025-12-14..." }
    // We filter for the specific index and grab the LATEST date.
    // This ensures if they reset and start over, we get the new date.
    const history = Array.isArray(customer.stamp_history) ? customer.stamp_history : [];
    
    const entries = history
      .filter(h => Number(h.index) === Number(index))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort Descending

    return entries.length > 0 ? entries[0].date : null;
  };

  // Add Stamp Action
  const addStamp = async (memberCode) => {
    if (!token) return;
    setAddingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }

      // Optimistic update logic handled by refresh or below map
      if (data.awarded) {
        setCelebration({ memberCode, name: data.card.name, rewards: data.card.totalRewards });
        try { rewardAudioRef.current?.play().catch(() => {}); } catch (e) {}
      }
      
      // Refresh strictly to ensure dates sync
      fetchCustomers({ silence: true });

    } catch (err) {
      alert("Error adding stamp");
    } finally {
      setAddingFor(null);
    }
  };

  // Remove Stamp Action
  const removeStamp = async (memberCode) => {
    if (!token) return;
    setRemovingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      if (res.ok) {
        fetchCustomers({ silence: true });
      }
    } catch (err) {
      alert("Error removing stamp");
    } finally {
      setRemovingFor(null);
    }
  };

  const toggleStampIndex = async (memberCode, index) => {
    const c = customers.find((x) => x.member_code === memberCode);
    if (!c) return;
    const current = Number(c.current_stamps || 0);
    if (index <= current) await removeStamp(memberCode);
    else await addStamp(memberCode);
  };

  useEffect(() => {
    if (celebration) {
      const t = setTimeout(() => setCelebration(null), CELEBRATION_TTL_MS);
      return () => clearTimeout(t);
    }
  }, [celebration]);

  const exportCSV = (rows) => {
    const header = ["S.No", "Member ID", "Name", "Phone", "DOB", "Stamps", "Rewards"];
    const lines = [header.join(",")];
    rows.forEach((r, idx) => {
      lines.push([
        idx + 1, r.member_code, r.name, r.phone, 
        r.dob ? new Date(r.dob).toLocaleDateString("en-GB") : "",
        r.current_stamps, r.total_rewards
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
  };

  // --- RENDER STAMPS ROW (The Fix) ---
  const renderStampRowCompact = (customer) => {
    const boxes = [];
    const current = customer.current_stamps;

    for (let i = 1; i <= 12; i++) {
      const filled = i <= current;
      // ✅ RESET LOGIC: Only fetch/show date if the stamp is FILLED. 
      // If filled is false (because cycle reset), dateStr becomes null naturally.
      const dateStr = filled ? getLatestStampDate(customer, i) : null;

      boxes.push(
        <div key={i} className="flex flex-col items-center group">
          <button
            onClick={() => toggleStampIndex(customer.member_code, i)}
            disabled={addingFor === customer.member_code || removingFor === customer.member_code}
            className={`h-9 w-9 rounded-full flex items-center justify-center border text-xs font-bold transition-all shadow-sm ${
              filled
                ? "bg-gradient-to-b from-[#f59e0b] to-[#d97706] text-white border-transparent scale-100"
                : "bg-white text-[#6b3a35] border-[#e5e7eb] hover:border-[#f59e0b] hover:bg-[#fffbeb]"
            }`}
          >
            {i}
          </button>
          {/* ✅ DATE DISPLAY: Only shows if dateStr exists (which implies filled) */}
          <div className="text-[10px] text-[#6b3a35]/70 h-4 mt-1 font-mono tracking-tighter whitespace-nowrap">
            {dateStr ? fmtDate(dateStr) : ""}
          </div>
        </div>
      );
    }
    return <div className="flex gap-3 items-center">{boxes}</div>;
  };

  const fadeInUp = { initial: { opacity: 0, y: 5 }, animate: { opacity: 1, y: 0 } };
  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1f2937]">
      <audio ref={rewardAudioRef} src="/reward-chime.mp3" preload="auto" />

      {/* Header - Full Width */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm w-full">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-[#501914] flex items-center justify-center text-white overflow-hidden">
              <img src="/cakeroven-logo.png" alt="Logo" className="object-cover h-full w-full" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#111827] leading-tight">CakeRoven Admin</h1>
              <p className="text-xs text-gray-500">Welcome, {adminName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['dashboard', 'insights'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                    activeTab === tab ? "bg-white text-[#501914] shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button onClick={handleLogout} className="text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 px-4 py-2 rounded-lg">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="w-full px-6 py-6">
        {activeTab === "dashboard" && (
          <motion.div {...fadeInUp} className="space-y-6">
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 font-medium uppercase">Members</p>
                <p className="text-3xl font-bold text-[#111827] mt-1">{stats.totalUsers}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 font-medium uppercase">Stamps Given</p>
                <p className="text-3xl font-bold text-[#d97706] mt-1">{stats.totalStamps}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 font-medium uppercase">Rewards Unlocked</p>
                <p className="text-3xl font-bold text-[#059669] mt-1">{stats.totalRewards}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 font-medium uppercase">Birthdays Today</p>
                <p className="text-3xl font-bold text-[#db2777] mt-1">{stats.birthdaysToday.length}</p>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col h-[calc(100vh-220px)]">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                <h3 className="font-bold text-gray-800 text-lg">Customer Management</h3>
                <div className="flex gap-3">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-64 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#501914]/20 outline-none transition"
                  />
                  <button onClick={() => exportCSV(customers)} className="px-4 py-2 bg-[#501914] text-white text-sm font-medium rounded-lg hover:bg-[#3a120e] transition">
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Member ID</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Details</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stamps (1-12)</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-32">Rewards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-500">Loading data...</td></tr>
                    ) : (
                      customers
                        .filter(c => [c.name, c.phone, c.member_code].join(" ").toLowerCase().includes(search.toLowerCase()))
                        .map((c, i) => (
                          <tr key={c.member_code} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-400">{i + 1}</td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">{c.member_code}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{c.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{c.phone}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{c.dob ? fmtDate(c.dob) : ""}</div>
                            </td>
                            <td className="px-6 py-4 flex justify-center">
                              {renderStampRowCompact(c)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800 border border-green-200">
                                {c.total_rewards} 🎁
                              </span>
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

        {/* Insights Tab (Simplified for brevity, but kept structure) */}
        {activeTab === "insights" && (
          <motion.div {...fadeInUp} className="grid grid-cols-2 gap-6 h-[500px]">
             <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-700 mb-4">Stamps Activity (Last 14 Days)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={insightsData.stampsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis />
                    <ReTooltip />
                    <Line type="monotone" dataKey="stamps" stroke="#d97706" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
             </div>
             <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-700 mb-4">Monthly Rewards</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={insightsData.rewardsPerMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ReTooltip />
                    <Bar dataKey="rewards" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>
        )}
      </main>

      {/* Celebration Toast */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 right-10 z-50 bg-[#501914] text-[#f5e6c8] px-6 py-4 rounded-2xl shadow-2xl border border-yellow-500/30 flex items-center gap-4"
          >
            <div className="text-4xl">🎉</div>
            <div>
              <h4 className="font-bold text-lg">Reward Unlocked!</h4>
              <p className="text-sm opacity-90">{celebration.name} completed a card!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}