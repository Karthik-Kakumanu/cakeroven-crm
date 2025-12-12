// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/**
 * AdminDashboard.jsx
 * - Desktop-first full-screen admin dashboard
 * - Polls API periodically for customer data (autofetch every 20s)
 * - Search placed inside customers area
 * - Export CSV / Excel (CSV file)
 * - 12 checkbox stamps per customer (toggle to add/remove stamp)
 * - Rewards history modal (uses server data if available; otherwise shows in-session events)
 *
 * Important:
 * - For persistent per-stamp dates and rewards history, the server must return
 *   `stamp_history` and `reward_history` arrays for each customer record. Example:
 *   customer.stamp_history = [{ index: 1, date: "2025-12-12T10:20:00Z" }, ...]
 *   customer.reward_history = [{ date: "2025-12-12T10:20:00Z" }, ...]
 *
 * - Current add/remove stamp endpoints are used:
 *   POST ${API_BASE}/api/admin/add-stamp { memberCode } -> returns { card: { currentStamps, totalRewards } }
 *   POST ${API_BASE}/api/admin/remove-stamp { memberCode } -> returns updated card
 *
 * - Exported CSV includes available fields: member_code, name, phone, dob, current_stamps, total_rewards
 */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  // data & UI state
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [removingFor, setRemovingFor] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'insights'
  const [rewardsModal, setRewardsModal] = useState({ open: false, customer: null });
  const autoPollRef = useRef(null);
  const rewardAudioRef = useRef(null);

  // In-session stampHistory + rewardEvents cache (client-only fallback).
  // Structure: { [member_code]: { stamp_history: {1: dateStr, 2: dateStr, ...}, reward_history: [dateStr,...] } }
  // NOTE: This is not persisted—server must provide stamp_history/reward_history for persistence.
  const sessionHistoryRef = useRef({});

  // Helper: format date nicely
  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Stats memo
  const stats = useMemo(() => {
    let totalUsers = customers.length;
    let totalStamps = 0;
    let totalRewards = 0;
    let birthdaysToday = [];

    const now = new Date();
    const todayD = now.getDate();
    const todayM = now.getMonth();

    customers.forEach((c) => {
      totalStamps += Number(c.current_stamps || 0);
      totalRewards += Number(c.total_rewards || 0);
      if (c.dob) {
        const d = new Date(c.dob);
        if (!Number.isNaN(d.getTime()) && d.getDate() === todayD && d.getMonth() === todayM) {
          birthdaysToday.push(c);
        }
      }
    });

    return { totalUsers, totalStamps, totalRewards, birthdaysToday };
  }, [customers]);

  // Fetch function
  const fetchCustomers = async (opts = { silence: false }) => {
    if (!token) {
      navigate("/admin");
      return;
    }

    if (!opts.silence) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert("Session expired. Please login again.");
          localStorage.removeItem("cr_adminToken");
          localStorage.removeItem("cr_adminUsername");
          navigate("/admin");
          return;
        }
        alert(data.message || "Failed to load customers");
        setLoading(false);
        return;
      }

      // if server returns stamp_history/reward_history embedded in customers we'll use them
      const items = (data.customers || []).map((c) => {
        // normalize fields for UI
        return {
          id: c.id,
          member_code: c.member_code || c.memberCode || c.memberId,
          name: c.name || c.full_name || "",
          phone: c.phone || c.mobile || "",
          dob: c.dob || c.date_of_birth || null,
          current_stamps: Number(c.current_stamps ?? c.currentStamps ?? 0),
          total_rewards: Number(c.total_rewards ?? c.totalRewards ?? 0),
          stamp_history: c.stamp_history || c.stampHistory || null, // optional from server
          reward_history: c.reward_history || c.rewardHistory || null, // optional
        };
      });

      setCustomers(items);
      setFiltered(filterCustomersByQuery(items, search));
    } catch (err) {
      console.error("fetchCustomers error:", err);
      alert("Server error while loading customers");
    } finally {
      setLoading(false);
    }
  };

  // Auto polling: every 20 seconds (adjustable)
  useEffect(() => {
    fetchCustomers();
    autoPollRef.current = setInterval(() => {
      fetchCustomers({ silence: true });
    }, 20_000);

    return () => clearInterval(autoPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Filter helper
  const filterCustomersByQuery = (list, q) => {
    if (!q || !q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s) ||
        (String(c.member_code || "") || "").toLowerCase().includes(s)
      );
    });
  };

  // Search effect
  useEffect(() => {
    setFiltered(filterCustomersByQuery(customers, search));
  }, [search, customers]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  // Add stamp (calls server). This keeps using your add-stamp API.
  // We attempt to add one stamp (server will return full card). If server returns new currentStamps,
  // we update local customers list and also set sessionHistoryRef for per-stamp date timestamp (client-side).
  const addStampServer = async (memberCode) => {
    if (!token) return null;
    setAddingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || "Could not update stamp");
        return null;
      }

      // update local state with returned card values
      const newStamps = Number(data.card.currentStamps ?? data.card.current_stamps ?? 0);
      const newRewards = Number(data.card.totalRewards ?? data.card.total_rewards ?? 0);

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode ? { ...c, current_stamps: newStamps, total_rewards: newRewards } : c
        )
      );

      // record session stamp date for the added stamp (client-only unless server stores it)
      const nowIso = new Date().toISOString();
      const sess = sessionHistoryRef.current[memberCode] || { stamp_history: {}, reward_history: [] };
      // find the first empty slot (1..12) in stamp_history based on current stamps
      let stampIndexToSet = 1;
      // if server returned newStamps, set that index
      if (newStamps >= 1) stampIndexToSet = newStamps;
      sess.stamp_history = sess.stamp_history || {};
      sess.stamp_history[stampIndexToSet] = nowIso;

      // If this add operation caused reward to be incremented (your server returns reward increment), push reward event
      if (newStamps === 0 && newRewards > 0) {
        // reward happened
        sess.reward_history = sess.reward_history || [];
        sess.reward_history.push(nowIso);
        setCelebration({
          memberCode,
          name: prevFindName(memberCode),
          rewards: newRewards,
        });
        // play audio if present
        if (rewardAudioRef.current) {
          try {
            rewardAudioRef.current.currentTime = 0;
            rewardAudioRef.current.play().catch(() => {});
          } catch (e) {}
        }
      }

      sessionHistoryRef.current[memberCode] = sess;
      return { newStamps, newRewards };
    } catch (err) {
      console.error("addStampServer", err);
      alert("Server error");
      return null;
    } finally {
      setAddingFor(null);
    }
  };

  // Remove stamp (calls server)
  const removeStampServer = async (memberCode) => {
    if (!token) return null;
    setRemovingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || "Could not undo stamp");
        return null;
      }

      const newStamps = Number(data.card.currentStamps ?? data.card.current_stamps ?? 0);
      const newRewards = Number(data.card.totalRewards ?? data.card.total_rewards ?? 0);

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode ? { ...c, current_stamps: newStamps, total_rewards: newRewards } : c
        )
      );

      // remove session stamp date for highest index if exists (client-only)
      const sess = sessionHistoryRef.current[memberCode];
      if (sess && sess.stamp_history) {
        // find highest key and remove
        const keys = Object.keys(sess.stamp_history).map((k) => Number(k)).sort((a, b) => b - a);
        if (keys.length) {
          delete sess.stamp_history[keys[0]];
        }
      }

      sessionHistoryRef.current[memberCode] = sess || { stamp_history: {}, reward_history: [] };
      return { newStamps, newRewards };
    } catch (err) {
      console.error("removeStampServer", err);
      alert("Server error");
      return null;
    } finally {
      setRemovingFor(null);
    }
  };

  // Helper to find name from current customers
  const prevFindName = (memberCode) => {
    const c = customers.find((x) => x.member_code === memberCode);
    return c?.name || "";
  };

  // When user toggles a specific stamp index for a customer
  const toggleStampIndex = async (memberCode, index) => {
    const c = customers.find((x) => x.member_code === memberCode);
    if (!c) return;
    // If the stamp at this index is already present according to server stamp_history, remove it.
    // But in most setups server only stores a count; our strategy:
    // - If index <= current_stamps -> consider it filled; unchecking should call removeStampServer once
    // - If index > current_stamps -> checking should call addStampServer enough times to reach that count.
    const current = Number(c.current_stamps || 0);

    if (index <= current) {
      // uncheck -> remove one stamp (server will decrement by 1)
      await removeStampServer(memberCode);
    } else {
      // need to add (index - current) stamps to reach that index
      // But to keep safe, add one stamp per click (prefer minimal change): call addStampServer once
      // This means clicking a far-right checkbox will only add one stamp — the user should click repeatedly.
      // Alternatively, to make it immediate, you could loop and call addStampServer multiple times.
      await addStampServer(memberCode);
    }

    // After server response in handlers, UI gets updated via state changes.
  };

  // Rewards modal open: gather reward history from server or session
  const openRewardsModal = (customer) => {
    setRewardsModal({ open: true, customer });
  };

  const closeRewardsModal = () => setRewardsModal({ open: false, customer: null });

  // CSV export
  const exportToCSV = (rows, filename = "cakeroven_customers.csv") => {
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

  // Copy CSV to clipboard
  const copyCSVToClipboard = async (rows) => {
    if (!rows.length) return;
    const header = ["S.No", "Member ID", "Name", "Phone", "DOB", "Current Stamps", "Total Rewards"];
    const lines = [header.join(",")];
    rows.forEach((r, idx) => {
      const row = [
        idx + 1,
        r.member_code || "",
        r.name || "",
        r.phone || "",
        r.dob ? new Date(r.dob).toLocaleDateString("en-GB") : "",
        r.current_stamps ?? 0,
        r.total_rewards ?? 0,
      ];
      lines.push(row.join(","));
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("CSV copied to clipboard");
    } catch (e) {
      alert("Copy failed. Use export instead.");
    }
  };

  // utility: get stamp date for UI: prefer server-provided stamp_history, fallback to session history
  const getStampDateFor = (memberCode, index) => {
    const customer = customers.find((c) => c.member_code === memberCode);
    if (!customer) return null;
    // server-provided
    if (customer.stamp_history) {
      // server stamp_history could be array or object. Support both.
      if (Array.isArray(customer.stamp_history)) {
        const found = customer.stamp_history.find((s) => Number(s.index) === Number(index));
        return found?.date || null;
      } else {
        // object keyed by index
        return customer.stamp_history[index] || null;
      }
    }
    // session fallback
    const sess = sessionHistoryRef.current[memberCode];
    return sess?.stamp_history?.[index] || null;
  };

  // utility: get reward history for customer: prefer server's reward_history else session fallback
  const getRewardHistoryFor = (memberCode) => {
    const customer = customers.find((c) => c.member_code === memberCode);
    if (!customer) return [];
    if (Array.isArray(customer.reward_history)) return customer.reward_history;
    if (customer.reward_history && typeof customer.reward_history === "object") {
      // if object, try to convert
      return Object.values(customer.reward_history);
    }
    const sess = sessionHistoryRef.current[memberCode];
    return sess?.reward_history || [];
  };

  // small helper to render stamps UI: 12 checkboxes (4 per row)
  const renderStampCheckboxes = (memberCode, currentStamps) => {
    const boxes = [];
    for (let i = 1; i <= 12; i++) {
      const filled = i <= currentStamps;
      const dateStr = getStampDateFor(memberCode, i);
      boxes.push(
        <div key={i} className="flex flex-col items-center gap-1">
          <button
            onClick={() => toggleStampIndex(memberCode, i)}
            disabled={addingFor === memberCode || removingFor === memberCode}
            className={`h-9 w-9 rounded-full flex items-center justify-center border transition ${
              filled
                ? "bg-[#fbbf24] text-[#3b1512] border-transparent shadow-sm"
                : "bg-transparent text-[#f5e6c8] border border-[#f5e6c8]/20 hover:bg-[#f5e6c8]/6"
            }`}
            title={filled ? `Checked (${formatDate(dateStr)})` : `Click to stamp #${i}`}
          >
            <span className="text-sm font-semibold">{i}</span>
          </button>
          <div className="text-[10px] text-[#f5e6c8]/70 h-4">{dateStr ? formatDate(dateStr) : ""}</div>
        </div>
      );
    }
    // layout: 4columns
    return (
      <div className="grid grid-cols-4 gap-2 items-center">
        {boxes}
      </div>
    );
  };

  if (!token) return null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#fbf3df] to-[#f2e6c7] text-[#4b130f]">
      <audio ref={rewardAudioRef} src="/reward-chime.mp3" preload="auto" />

      {/* Top bar */}
      <header className="w-full sticky top-0 z-40 bg-white/30 backdrop-blur-sm border-b border-[#f0dcb4]">
        <div className="max-w-full px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden">
              <img src="/cakeroven-logo.png" alt="CakeRoven" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-[#6b3a35]">CakeRoven Admin</p>
              <p className="text-base font-semibold text-[#3b1512]">Welcome, {adminName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 bg-white/80 rounded-full p-1 shadow-sm">
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

            {/* small refresh button */}
            <button
              onClick={() => fetchCustomers({ silence: false })}
              className="px-3 py-2 rounded-full border border-[#ecd9b4] bg-white text-sm"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm font-semibold shadow hover:bg-[#40100f] transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* main */}
      <main className="w-full px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* left: main content */}
          <div className="col-span-12 lg:col-span-9">
            {/* Dashboard header stats */}
            {activeTab === "dashboard" && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
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

                {/* customer list card */}
                <div className="rounded-3xl bg-white shadow-lg border border-[#f3dfb1] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#f3dfb1] flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#3b1512]">Customers</h3>
                      <p className="text-xs text-[#6b3a35]/70">Search and manage stamps directly in the table.</p>
                    </div>

                    {/* Search within the customers area */}
                    <div className="flex items-center gap-2">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name / phone / member ID"
                        className="px-3 py-2 rounded-2xl border border-[#ecdaba] bg-white text-sm outline-none focus:ring-2 focus:ring-[#f1cf8f]/40 w-80"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exportToCSV(filtered)}
                          className="px-3 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={() => copyCSVToClipboard(filtered)}
                          className="px-3 py-2 rounded-full border border-[#ecdaba] bg-white text-sm"
                        >
                          Copy CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3 text-left">S.No</th>
                          <th className="px-4 py-3 text-left">Member ID</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Phone</th>
                          <th className="px-4 py-3 text-left">DOB</th>
                          <th className="px-4 py-3 text-left">Stamps (click to toggle)</th>
                          <th className="px-4 py-3 text-right">Rewards</th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]">Loading customers…</td>
                          </tr>
                        ) : filtered.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]/70">No customers found.</td>
                          </tr>
                        ) : (
                          filtered.map((c, idx) => (
                            <tr key={c.member_code} className={idx % 2 === 0 ? "bg-[#fffaf0]" : "bg-[#fff4e6]"}>
                              <td className="px-4 py-4 text-sm text-[#6b3a35]/80">{idx + 1}</td>
                              <td className="px-4 py-4 text-sm font-mono text-[#3b1512]">{c.member_code}</td>
                              <td className="px-4 py-4 text-sm text-[#3b1512]">{c.name}</td>
                              <td className="px-4 py-4 text-sm text-[#6b3a35]">{c.phone}</td>
                              <td className="px-4 py-4 text-sm text-[#6b3a35]/80">{c.dob ? new Date(c.dob).toLocaleDateString("en-GB") : "—"}</td>

                              <td className="px-4 py-4">
                                {renderStampCheckboxes(c.member_code, Number(c.current_stamps || 0))}
                              </td>

                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openRewardsModal(c)}
                                    className="px-3 py-1.5 rounded-full bg-[#fff4d8] text-sm font-semibold border border-[#f1cf8f]"
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
              </>
            )}

            {/* Insights tab */}
            {activeTab === "insights" && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Insights</h3>
                      <p className="text-xs text-[#6b3a35]/70">Charts & quick data view</p>
                    </div>
                  </div>

                  {/* Placeholder charts area - you can plug Chart.js / Recharts later */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-44 rounded-lg bg-[#fffaf0] border border-[#f3e6c2] flex items-center justify-center text-sm text-[#6b3a35]/80">
                      Stamps over time (chart placeholder)
                    </div>
                    <div className="h-44 rounded-lg bg-[#fffaf0] border border-[#f3e6c2] flex items-center justify-center text-sm text-[#6b3a35]/80">
                      Rewards per month (chart placeholder)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* right: side column */}
          <aside className="col-span-12 lg:col-span-3 space-y-6">
            {/* Birthdays */}
            <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
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
            </div>

            {/* Almost at reward */}
            <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <p className="text-sm font-semibold text-[#3b1512] mb-2">Almost at reward</p>
              <p className="text-xs text-[#6b3a35]/70 mb-3">Customers with 9–11 stamps (most stamps first)</p>

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
                        <div><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-[12px] font-semibold text-[#92400e]">{c.current_stamps}/12</span></div>
                      </div>
                    ))}
                </>
              )}

              <p className="mt-3 text-xs text-[#6b3a35]/60">
                Tip: target these members with reminders or offers — they’re closest to unlocking a free CakeRoven treat 🎁
              </p>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <p className="text-sm font-semibold text-[#3b1512] mb-2">Quick actions</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fetchCustomers({ silence: false })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#ecd9b4] text-sm hover:bg-[#fff9ee]"
                >
                  Refresh data now
                </button>
                <button
                  onClick={() => exportToCSV(filtered)}
                  className="w-full px-3 py-2 rounded-lg bg-[#501914] text-white text-sm hover:bg-[#40100f]"
                >
                  Export visible → CSV
                </button>
                <button
                  onClick={() => copyCSVToClipboard(filtered)}
                  className="w-full px-3 py-2 rounded-lg border border-[#ecd9b4] bg-white text-sm"
                >
                  Copy CSV to clipboard
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Rewards modal */}
      {rewardsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="relative z-10 max-w-md w-full mx-4 rounded-2xl bg-white shadow-lg p-5 border border-[#f3dfb1]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{rewardsModal.customer.name}</h3>
                <p className="text-xs font-mono text-[#6b3a35]/70">{rewardsModal.customer.member_code} • {rewardsModal.customer.phone}</p>
              </div>
              <button onClick={closeRewardsModal} className="text-[#6b3a35]/70">Close</button>
            </div>

            <div className="mt-3">
              <p className="text-sm font-semibold mb-2">Rewards history</p>
              <div className="rounded-lg bg-[#fffaf0] p-3 border border-[#f3e6c2]">
                {/* server-provided or session fallback */}
                {(() => {
                  const arr = getRewardHistoryFor(rewardsModal.customer.member_code);
                  if (!arr || !arr.length) {
                    return <p className="text-sm text-[#6b3a35]/70">No reward history available for this member.</p>;
                  }
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-[#6b3a35]/70">
                          <th className="text-left">S.No</th>
                          <th className="text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arr.map((d, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#fff9ee]"}>
                            <td className="py-2">{i + 1}</td>
                            <td className="py-2">{formatDate(d)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Celebration overlay */}
      {celebration && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="relative z-70 max-w-sm w-full mx-4 rounded-3xl bg-[#501914] text-[#f5e6c8] shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-6 border border-[#fcd9a7] pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🎉</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#f5e6c8]/80">Reward unlocked!</p>
                <p className="text-lg font-bold mt-1">{celebration.name || "Member"} completed 12 stamps</p>
                <p className="mt-2 text-sm">Member <span className="font-mono">{celebration.memberCode}</span> has unlocked a reward. Total rewards: <span className="font-semibold">{celebration.rewards}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
