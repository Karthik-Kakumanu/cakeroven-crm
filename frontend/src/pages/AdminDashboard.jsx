// frontend/src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
// ✅ FIXED: Added missing icon imports here
import { FiSearch, FiPlusCircle, FiGift, FiLogOut, FiTrendingUp, FiUsers } from "react-icons/fi";
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
 * - Customers table with compact 12-stamp row and per-stamp date tooltip
 * - Add/Remove stamp actions (calls backend endpoints)
 * - Auto-poll for customers (20s)
 * - Celebration toast that auto-dismisses in 2s
 * - Insights page with two charts (stamps over time, rewards per month)
 * - Automatic sound notification for stamp additions
 * - ✅ NEW: Manual Amount Entry per customer
 * - ✅ NEW: Transaction History Table with Daily Totals
 */

const POLL_INTERVAL = 20_000;
const CELEBRATION_TTL_MS = 2000;

// Helper to format date for the insights table
function formatDateTime(isoString) {
  if (!isoString) return { dateStr: "-", timeStr: "-", rawDate: new Date() };
  const date = new Date(isoString);
  return {
    dateStr: date.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }),
    timeStr: date.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }),
    rawDate: date
  };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null); // Used for loading state of actions
  const [removingFor, setRemovingFor] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'insights'
  const [celebration, setCelebration] = useState(null); // { memberCode, name, rewards }
  
  // Insights Data
  const [insightsData, setInsightsData] = useState({
    stampsOverTime: [], 
    rewardsPerMonth: [], 
  });
  const [transactions, setTransactions] = useState([]); // ✅ NEW: Store transaction list
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Manual Amount Inputs
  const [manualAmounts, setManualAmounts] = useState({}); // ✅ NEW: { userId: amount }

  const pollRef = useRef(null);
  const rewardAudioRef = useRef(null);
  const stampAudioRef = useRef(null); 
  const sessionHistoryRef = useRef({});
  
  // Ref to store previous customers state for comparison
  const prevCustomersRef = useRef({});

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

  // Date formatter strictly for IST (Indian Standard Time)
  const fmtDate = useCallback((iso) => {
    if (!iso) return null;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata", 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric"
    });
  }, []);

  // Effect to detect stamp increases and play sound automatically
  useEffect(() => {
    if (customers.length > 0) {
      let shouldPlaySound = false;
      const newPrevCustomers = { ...prevCustomersRef.current };

      customers.forEach(customer => {
        const prevStamps = prevCustomersRef.current[customer.member_code]?.current_stamps;
        const currentStamps = customer.current_stamps;

        // If previous data exists and stamps have increased
        if (prevStamps !== undefined && currentStamps > prevStamps) {
          shouldPlaySound = true;
        }
        
        // Update the ref with current data
        newPrevCustomers[customer.member_code] = { current_stamps: currentStamps };
      });

      prevCustomersRef.current = newPrevCustomers;

      if (shouldPlaySound) {
        try {
          if (stampAudioRef.current) {
            stampAudioRef.current.currentTime = 0;
            stampAudioRef.current.play().catch(e => console.error("Auto-play blocked:", e));
          }
        } catch (e) {
          console.error("Audio play error", e);
        }
      }
    }
  }, [customers]);


  // Fetch customers
  const fetchCustomers = useCallback(
    async (opts = { silence: false }) => {
      if (!token) {
        navigate("/admin");
        return;
      }
      if (!opts.silence) setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/search?query=all`, { 
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Fallback to specific customers endpoint if search "all" isn't implemented strictly
        const res2 = res.ok ? res : await fetch(`${API_BASE}/api/admin/customers`, { headers: { Authorization: `Bearer ${token}` } });
        
        const rawData = (await res2.json().catch(() => ([])));
        // Handle array response (search) or object response (getCustomers)
        const itemsList = Array.isArray(rawData) ? rawData : (rawData.customers || []);

        if (!res2.ok && !res.ok) {
          if (res2.status === 401 || res2.status === 403) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("cr_adminToken");
            localStorage.removeItem("cr_adminUsername");
            navigate("/admin");
            return;
          }
          console.error("Failed loading customers");
          return;
        }

        // Normalize data
        const items = itemsList.map((c) => ({
          id: c.id,
          member_code: c.member_code ?? c.memberCode ?? c.memberId,
          name: c.name ?? c.full_name ?? "",
          phone: c.phone ?? c.mobile ?? "",
          dob: c.dob ?? null,
          current_stamps: Number(c.current_stamps ?? c.currentStamps ?? 0),
          total_rewards: Number(c.total_rewards ?? c.totalRewards ?? 0),
          stamp_history: c.stamp_history ?? c.stampHistory ?? null,
          reward_history: c.reward_history ?? c.rewardHistory ?? null,
        }));

        setCustomers(items);

      } catch (err) {
        console.error("fetchCustomers error:", err);
      } finally {
        setLoading(false);
      }
    },
    [token, navigate]
  );

  // ✅ NEW: Fetch Insights (Transactions)
  const fetchInsights = useCallback(async () => {
    if (!token) return;
    setInsightsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/insights`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data); // Store raw transactions

        // Process data for charts (Simple aggregation)
        const stampMap = {};
        data.forEach(t => {
            if (t.stamp_added) {
                const dateKey = new Date(t.created_at).toLocaleDateString("en-GB");
                stampMap[dateKey] = (stampMap[dateKey] || 0) + 1;
            }
        });
        const chartData = Object.keys(stampMap).map(date => ({ date, stamps: stampMap[date] }));
        
        if(chartData.length > 0) {
            setInsightsData(prev => ({ ...prev, stampsOverTime: chartData }));
        }
      }
    } catch (err) {
      console.error("fetchInsights error:", err);
    } finally {
      setInsightsLoading(false);
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
    return Object.values(rh);
  };

  // ✅ UPDATED: Handle Amount Change for Manual Entry
  const handleAmountChange = (userId, value) => {
    setManualAmounts(prev => ({ ...prev, [userId]: value }));
  };

  // ✅ UPDATED: Add Manual Stamp with Amount
  const handleAddStampWithAmount = async (customer) => {
    if (!token) return;
    const userId = customer.id;
    const amount = manualAmounts[userId];

    if (!amount || Number(amount) <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    if (Number(customer.current_stamps) >= 11) {
        alert("Customer has 11 stamps. Please Redeem & Reset.");
        return;
    }

    setAddingFor(customer.member_code); // Show loading
    try {
      const res = await fetch(`${API_BASE}/api/admin/stamp`, { 
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, amount: Number(amount) }),
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message); 
        
        // Update local state
        setCustomers((prev) =>
            prev.map((c) => c.id === userId ? { 
                ...c, 
                current_stamps: Number(data.data?.current_stamps ?? c.current_stamps),
                total_rewards: Number(data.data?.total_rewards ?? c.total_rewards)
            } : c)
        );
        
        // Clear Input
        setManualAmounts(prev => ({ ...prev, [userId]: "" }));

        // Play Sound if stamp was actually added
        if (data.message.includes("Stamp added")) {
             if (stampAudioRef.current) {
                stampAudioRef.current.currentTime = 0;
                stampAudioRef.current.play().catch(() => {});
             }
        }
      } else {
        alert(data.message || "Failed to add transaction");
      }
    } catch (err) {
      console.error("Manual stamp error:", err);
      alert("Server error");
    } finally {
      fetchCustomers({ silence: true });
      setAddingFor(null);
    }
  };

  // Reset/Redeem
  const handleReset = async (userId) => {
    if (!token) return;
    if (!window.confirm("Confirm Reward Redemption & Reset?")) return;
    
    // Find customer member code for loading state
    const c = customers.find(cust => cust.id === userId);
    if(c) setRemovingFor(c.member_code);

    try {
      const res = await fetch(`${API_BASE}/api/admin/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setCustomers((prev) =>
            prev.map((c) => c.id === userId ? { 
                ...c, 
                current_stamps: 0,
                total_rewards: Number(data.data?.total_rewards ?? c.total_rewards + 1)
            } : c)
        );
        // Celebration sound
        try { rewardAudioRef.current?.play().catch(() => {}); } catch (e) {}
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      fetchCustomers({ silence: true });
      setRemovingFor(null);
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
      const now = new Date();
      const arr = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString("en-GB");
        let stampsToday = 0;
        customers.forEach((c) => {
          const sh = c.stamp_history;
          if (Array.isArray(sh)) {
            stampsToday += sh.filter((s) => new Date(s.date).toDateString() === d.toDateString()).length;
          }
        });
        arr.push({ date: label, stamps: stampsToday });
      }
      setInsightsData((s) => ({ ...s, stampsOverTime: arr }));
    }
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

  // ✅ NEW: Render Transaction History Rows with Daily Totals
  const renderInsightRows = () => {
    if (transactions.length === 0) return <tr><td colSpan="6" className="p-4 text-center opacity-50">No transactions found.</td></tr>;

    const rows = [];
    let currentDayTotal = 0;

    for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const { dateStr, timeStr, rawDate } = formatDateTime(tx.created_at);
        const amount = Number(tx.amount);
        
        currentDayTotal += amount;

        // Transaction Row
        rows.push(
            <tr key={tx.id} className="border-b border-amber-900/10 hover:bg-white/50 transition text-sm">
                <td className="p-3">
                    <div className="font-semibold text-amber-900">{dateStr}</div>
                    <div className="text-xs text-amber-900/50">{timeStr}</div>
                </td>
                <td className="p-3 font-mono text-amber-800">{tx.member_code}</td>
                <td className="p-3 font-medium">{tx.customer_name}</td>
                <td className="p-3 font-bold text-amber-700">₹{amount.toFixed(2)}</td>
                <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.payment_method === 'online' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                        {tx.payment_method}
                    </span>
                </td>
                <td className="p-3 text-center">
                    {tx.stamp_added ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-300">-</span>}
                </td>
            </tr>
        );

        // Calculate if we need a total row (if date changes or last item)
        let insertTotal = false;
        if (i === transactions.length - 1) {
            insertTotal = true;
        } else {
            const nextDate = new Date(transactions[i+1].created_at);
            if (rawDate.getDate() !== nextDate.getDate() || 
                rawDate.getMonth() !== nextDate.getMonth() || 
                rawDate.getFullYear() !== nextDate.getFullYear()) {
                insertTotal = true;
            }
        }

        if (insertTotal) {
            rows.push(
                <tr key={`total-${i}`} className="bg-amber-200/40 border-b-2 border-amber-900/20">
                    <td colSpan="3" className="p-3 text-right font-bold text-amber-900 uppercase text-xs tracking-wider">
                        Total Collected ({dateStr}):
                    </td>
                    <td className="p-3 font-extrabold text-amber-800 text-lg">
                        ₹{currentDayTotal.toFixed(2)}
                    </td>
                    <td colSpan="2"></td>
                </tr>
            );
            currentDayTotal = 0; // Reset
        }
    }
    return rows;
  };

  // Compact 12 stamps row renderer (Visual only now, actions moved to manual column)
  const renderStampRowCompact = (memberCode, current) => {
    const boxes = [];
    for (let i = 1; i <= 12; i++) {
      const filled = i <= current;
      const dateStr = filled ? getStampDateFromCustomer(customers.find((c) => c.member_code === memberCode), i) : null;
      
      boxes.push(
        <div key={i} className="flex flex-col items-center">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center border text-xs transition ${
              filled
                ? "bg-gradient-to-br from-yellow-300 to-yellow-400 text-[#3b1a12] shadow-sm border-transparent"
                : "bg-white text-[#6b3a35] border border-[#f0d7b0]"
            }`}
            title={filled ? `Marked — ${fmtDate(dateStr) ?? "date unknown"}` : `Stamp #${i}`}
          >
            {i}
          </div>
          <div className="text-[9px] text-[#6b3a35]/60 h-3 mt-0.5 whitespace-nowrap">
             {dateStr ? fmtDate(dateStr) : ""}
          </div>
        </div>
      );
    }
    return (
      <div className="flex gap-2 items-center overflow-x-auto py-1 custom-scrollbar">
        {boxes}
      </div>
    );
  };

  const fadeInUp = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 } };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf3df] to-[#f2e6c7] text-[#3b1512] font-sans">
      <audio ref={rewardAudioRef} src="/reward-chime.mp3" preload="auto" />
      <audio ref={stampAudioRef} src="/stamp.mp3" preload="auto" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#f0dcb4] shadow-sm">
        <div className="w-full mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden border border-[#f3dfb1]">
              <img src="/cakeroven-logo.png" alt="CakeRoven" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-[#6b3a35] uppercase font-bold tracking-wide">Admin Panel</p>
              <p className="text-sm font-semibold text-[#3b1512]">{adminName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1 bg-[#f0dcb4]/50 rounded-full p-1">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${activeTab === "dashboard" ? "bg-[#501914] text-[#f5e6c8] shadow-sm" : "text-[#3b1512] hover:bg-white/50"}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("insights")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${activeTab === "insights" ? "bg-[#501914] text-[#f5e6c8] shadow-sm" : "text-[#3b1512] hover:bg-white/50"}`}
              >
                Insights
              </button>
            </nav>

            <button onClick={handleLogout} className="text-[#3b1512] hover:text-red-700 transition" title="Logout">
              <FiLogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full mx-auto px-6 py-8">
        
        {/* ===================== DASHBOARD TAB ===================== */}
        {activeTab === "dashboard" && (
          <motion.div {...fadeInUp} className="space-y-6">
            
            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-white shadow-sm p-4 border border-[#f3dfb1]">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><FiUsers /></div>
                    <div>
                        <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Total Users</p>
                        <p className="text-2xl font-bold mt-0.5">{stats.totalUsers}</p>
                    </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white shadow-sm p-4 border border-[#f3dfb1]">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600"><FiPlusCircle /></div>
                    <div>
                        <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Stamps Given</p>
                        <p className="text-2xl font-bold mt-0.5">{stats.totalStamps}</p>
                    </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white shadow-sm p-4 border border-[#f3dfb1]">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><FiGift /></div>
                    <div>
                        <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Rewards Unlocked</p>
                        <p className="text-2xl font-bold mt-0.5">{stats.totalRewards}</p>
                    </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white shadow-sm p-4 border border-[#f3dfb1]">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg text-red-500">🎂</div>
                    <div>
                        <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Birthdays Today</p>
                        <p className="text-2xl font-bold mt-0.5">{stats.birthdaysToday.length}</p>
                    </div>
                </div>
              </div>
            </div>

            {/* Customers Table */}
            <div className="rounded-3xl bg-white shadow-xl border border-[#f3dfb1] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#f3dfb1] flex flex-col md:flex-row items-center justify-between gap-4 bg-[#fffaf0]">
                <div>
                  <h3 className="text-xl font-bold text-[#3b1512]">Manage Customers</h3>
                  <p className="text-xs text-[#6b3a35]/70">Enter amount to manually add stamp/transaction.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name / phone / ID..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#ecdaba] bg-white text-sm outline-none focus:ring-2 focus:ring-[#f1cf8f]/50"
                    />
                  </div>
                  <button onClick={() => exportCSV(customers)} className="px-4 py-2.5 text-sm rounded-xl bg-[#501914] text-[#f5e6c8] hover:bg-[#3a0f0b] font-medium transition">
                    Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-4 text-left w-12">#</th>
                      <th className="px-4 py-4 text-left">Member</th>
                      <th className="px-4 py-4 text-left">Contact</th>
                      <th className="px-4 py-4 text-left w-[40%]">Current Progress</th>
                      <th className="px-4 py-4 text-left w-48">Manual Transaction</th>
                      <th className="px-4 py-4 text-center w-24">Rewards</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f3dfb1]">
                    {loading ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-[#6b3a35]">Loading customers...</td></tr>
                    ) : customers.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-[#6b3a35]/70">No customers found.</td></tr>
                    ) : (
                      customers
                        .filter((c) => [c.name, c.phone, String(c.member_code)].join(" ").toLowerCase().includes(search.trim().toLowerCase()))
                        .map((c, idx) => {
                            const isRedeemReady = c.current_stamps >= 11;
                            const amountVal = manualAmounts[c.id] || "";
                            const isBusy = addingFor === c.member_code || removingFor === c.member_code;

                            return (
                            <tr key={c.member_code} className="hover:bg-[#fff9ee] transition-colors">
                                <td className="px-4 py-4 text-xs text-[#6b3a35]/60">{idx + 1}</td>
                                <td className="px-4 py-4">
                                    <div className="font-bold text-[#3b1512]">{c.name}</div>
                                    <div className="font-mono text-xs text-[#6b3a35] bg-[#f0dcb4]/30 px-1.5 py-0.5 rounded inline-block mt-1">{c.member_code}</div>
                                </td>
                                <td className="px-4 py-4 text-gray-600">
                                    <div>{c.phone}</div>
                                    <div className="text-xs text-gray-400">{c.dob ? new Date(c.dob).toLocaleDateString("en-GB") : "No DOB"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    {renderStampRowCompact(c.member_code, Number(c.current_stamps || 0))}
                                </td>
                                
                                {/* ✅ Manual Transaction Column */}
                                <td className="px-4 py-4">
                                    {!isRedeemReady ? (
                                        <div className="flex gap-2 items-center">
                                            <div className="relative w-24">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                                <input 
                                                    type="number" 
                                                    placeholder="Amount"
                                                    value={amountVal}
                                                    onChange={(e) => handleAmountChange(c.id, e.target.value)}
                                                    disabled={isBusy}
                                                    className="w-full pl-5 pr-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:border-amber-500 outline-none"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleAddStampWithAmount(c)}
                                                disabled={isBusy || !amountVal}
                                                className="bg-[#4b130f] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-amber-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isBusy ? "..." : "Add"}
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleReset(c.id)}
                                            disabled={isBusy}
                                            className="w-full py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold uppercase shadow-sm hover:bg-green-700 animate-pulse"
                                        >
                                            Redeem & Reset
                                        </button>
                                    )}
                                </td>

                                <td className="px-4 py-4 text-center">
                                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-sm font-bold text-amber-800">
                                        <span>🎁</span> {c.total_rewards}
                                    </div>
                                </td>
                            </tr>
                            );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===================== INSIGHTS TAB ===================== */}
        {activeTab === "insights" && (
          <motion.div {...fadeInUp} className="space-y-8">
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white shadow-md p-5 border border-[#f3dfb1]">
                    <h3 className="text-sm font-bold text-[#3b1512] mb-4 flex items-center gap-2"><FiTrendingUp /> Stamps Issued (Last 7 Days)</h3>
                    <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={insightsData.stampsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3e6c2" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <ReTooltip />
                        <Line type="monotone" dataKey="stamps" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-2xl bg-white shadow-md p-5 border border-[#f3dfb1]">
                    <h3 className="text-sm font-bold text-[#3b1512] mb-4 flex items-center gap-2"><FiGift /> Rewards Earned (Monthly)</h3>
                    <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insightsData.rewardsPerMonth}>
                        <CartesianGrid stroke="#f3e6c2" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <ReTooltip />
                        <Bar dataKey="rewards" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ✅ Transaction History Table */}
            <div className="rounded-2xl bg-white shadow-xl border border-[#f3dfb1] overflow-hidden">
                <div className="px-6 py-4 bg-[#fffaf0] border-b border-[#f3dfb1] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[#3b1512] flex items-center gap-2">
                        <span className="text-xl">📜</span> Transaction History
                    </h3>
                    <button onClick={fetchInsights} className="text-xs font-bold uppercase tracking-wide bg-white border border-[#ecd9b4] px-3 py-1.5 rounded-lg hover:bg-amber-50">
                        Refresh List
                    </button>
                </div>
                
                {insightsLoading ? (
                    <div className="p-12 text-center text-gray-400">Loading transaction history...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Date & Time</th>
                                    <th className="p-4">Member ID</th>
                                    <th className="p-4">Customer Name</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Method</th>
                                    <th className="p-4 text-center">Stamp Added?</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f3dfb1]">
                                {renderInsightRows()}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

          </motion.div>
        )}

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
