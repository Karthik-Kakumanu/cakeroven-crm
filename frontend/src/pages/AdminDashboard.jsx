// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/**
 * AdminDashboard.jsx - Revised per user requests & build fix
 * - Desktop-first full-screen admin dashboard
 * - Tabs: Dashboard / Insights
 * - Removed Refresh button from header (kept as Quick Action only)
 * - Stamps are shown in a single horizontal line (12 items) per customer (compact)
 * - Small stamp buttons (clickable) and compact table rows
 * - Auto-polling for fresh data (every 20s)
 * - Single declaration of helper functions (build fix)
 *
 * Note: Backend must support /api/admin/add-stamp and /api/admin/remove-stamp.
 */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

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

  // client-side session history (fallback)
  const sessionHistoryRef = useRef({});

  // Helper: date formatting
  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB");
  };

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

  // Fetch customers
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
        console.error("Failed loading customers:", data);
        alert(data.message || "Failed to load customers");
        setLoading(false);
        return;
      }
      const items = (data.customers || []).map((c) => ({
        id: c.id,
        member_code: c.member_code || c.memberCode || c.memberId,
        name: c.name || c.full_name || "",
        phone: c.phone || c.mobile || "",
        dob: c.dob || c.date_of_birth || null,
        current_stamps: Number(c.current_stamps ?? c.currentStamps ?? 0),
        total_rewards: Number(c.total_rewards ?? c.totalRewards ?? 0),
        stamp_history: c.stamp_history || c.stampHistory || null,
        reward_history: c.reward_history || c.rewardHistory || null,
      }));
      setCustomers(items);
      setFiltered(filterCustomersByQuery(items, search));
    } catch (err) {
      console.error("fetchCustomers error:", err);
      alert("Server error while loading customers");
    } finally {
      setLoading(false);
    }
  };

  // Auto-poll
  useEffect(() => {
    fetchCustomers();
    autoPollRef.current = setInterval(() => {
      fetchCustomers({ silence: true });
    }, 20_000);
    return () => clearInterval(autoPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  useEffect(() => {
    setFiltered(filterCustomersByQuery(customers, search));
  }, [search, customers]);

  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  // Add stamp API call (single stamp)
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
        console.error("add-stamp failed:", res.status, data);
        alert(data.message || `Server error adding stamp (status ${res.status})`);
        return null;
      }
      const newStamps = Number(data.card.currentStamps ?? data.card.current_stamps ?? 0);
      const newRewards = Number(data.card.totalRewards ?? data.card.total_rewards ?? 0);
      setCustomers((prev) =>
        prev.map((c) => (c.member_code === memberCode ? { ...c, current_stamps: newStamps, total_rewards: newRewards } : c))
      );

      // session stamp date fallback
      const nowIso = new Date().toISOString();
      const sess = sessionHistoryRef.current[memberCode] || { stamp_history: {}, reward_history: [] };
      const idx = newStamps >= 1 ? newStamps : Object.keys(sess.stamp_history || {}).length + 1;
      sess.stamp_history = sess.stamp_history || {};
      sess.stamp_history[idx] = nowIso;

      if (newStamps === 0 && newRewards > 0) {
        sess.reward_history = sess.reward_history || [];
        sess.reward_history.push(nowIso);
        setCelebration({ memberCode, name: customers.find((x) => x.member_code === memberCode)?.name || "", rewards: newRewards });
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
      console.error("addStampServer error:", err);
      alert("Server error while adding stamp");
      return null;
    } finally {
      setAddingFor(null);
    }
  };

  // Remove stamp API call (single)
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
        console.error("remove-stamp failed:", res.status, data);
        alert(data.message || `Server error removing stamp (status ${res.status})`);
        return null;
      }
      const newStamps = Number(data.card.currentStamps ?? data.card.current_stamps ?? 0);
      const newRewards = Number(data.card.totalRewards ?? data.card.total_rewards ?? 0);
      setCustomers((prev) =>
        prev.map((c) => (c.member_code === memberCode ? { ...c, current_stamps: newStamps, total_rewards: newRewards } : c))
      );

      // session remove highest stamp
      const sess = sessionHistoryRef.current[memberCode];
      if (sess && sess.stamp_history) {
        const keys = Object.keys(sess.stamp_history).map((k) => Number(k)).sort((a, b) => b - a);
        if (keys.length) delete sess.stamp_history[keys[0]];
      }
      sessionHistoryRef.current[memberCode] = sess || { stamp_history: {}, reward_history: [] };
      return { newStamps, newRewards };
    } catch (err) {
      console.error("removeStampServer error:", err);
      alert("Server error while removing stamp");
      return null;
    } finally {
      setRemovingFor(null);
    }
  };

  // toggle a stamp index: minimal behavior -> add/remove one stamp per click
  const toggleStampIndex = async (memberCode, index) => {
    const c = customers.find((x) => x.member_code === memberCode);
    if (!c) return;
    const current = Number(c.current_stamps || 0);
    if (index <= current) {
      // uncheck -> remove one
      await removeStampServer(memberCode);
    } else {
      // check -> add one
      await addStampServer(memberCode);
    }
  };

  const openRewardsModal = (customer) => {
    setRewardsModal({ open: true, customer });
  };
  const closeRewardsModal = () => setRewardsModal({ open: false, customer: null });

  // CSV export - single place (Quick Actions)
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

  // get stamp date: prefer server stamp_history else session fallback
  const getStampDateFor = (memberCode, index) => {
    const customer = customers.find((c) => c.member_code === memberCode);
    if (!customer) return null;
    if (customer.stamp_history) {
      if (Array.isArray(customer.stamp_history)) {
        const found = customer.stamp_history.find((s) => Number(s.index) === Number(index));
        return found?.date || null;
      } else {
        return customer.stamp_history[index] || null;
      }
    }
    const sess = sessionHistoryRef.current[memberCode];
    return sess?.stamp_history?.[index] || null;
  };

  // get reward history helper
  const getRewardHistoryFor = (memberCode) => {
    const customer = customers.find((c) => c.member_code === memberCode);
    if (!customer) return [];
    if (Array.isArray(customer.reward_history)) return customer.reward_history;
    if (customer.reward_history && typeof customer.reward_history === "object") return Object.values(customer.reward_history);
    const sess = sessionHistoryRef.current[memberCode];
    return sess?.reward_history || [];
  };

  // Compact stamp row, 12 items in one line
  const renderStampRowCompact = (memberCode, currentStamps) => {
    const boxes = [];
    for (let i = 1; i <= 12; i++) {
      const filled = i <= currentStamps;
      const dateStr = getStampDateFor(memberCode, i);
      boxes.push(
        <div key={i} className="flex flex-col items-center">
          <button
            onClick={() => toggleStampIndex(memberCode, i)}
            disabled={addingFor === memberCode || removingFor === memberCode}
            className={`h-7 w-7 rounded-full flex items-center justify-center border text-xs transition ${
              filled
                ? "bg-[#fbbf24] text-[#3b1512] border-transparent shadow-sm"
                : "bg-transparent text-[#4b130f] border border-[#e9dcc0] hover:bg-[#fff7e0]"
            }`}
            title={filled ? `Checked (${formatDate(dateStr)})` : `Click to stamp #${i}`}
          >
            {i}
          </button>
          <div className="text-[10px] text-[#6b3a35]/60 h-4">{dateStr ? formatDate(dateStr) : ""}</div>
        </div>
      );
    }
    return <div className="flex gap-2 items-center overflow-x-auto">{boxes}</div>;
  };

  if (!token) return null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#fbf3df] to-[#f2e6c7] text-[#4b130f]">
      <audio ref={rewardAudioRef} src="/reward-chime.mp3" preload="auto" />

      {/* Header: NO Refresh button here (per request) */}
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

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm font-semibold shadow hover:bg-[#40100f] transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="w-full px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-9">
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

                <div className="rounded-3xl bg-white shadow-lg border border-[#f3dfb1] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#f3dfb1] flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#3b1512]">Customers</h3>
                      <p className="text-xs text-[#6b3a35]/70">Search and manage stamps directly in the table.</p>
                    </div>

                    {/* Search only (no export buttons here) */}
                    <div className="flex items-center gap-2">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name / phone / member ID"
                        className="px-3 py-2 rounded-2xl border border-[#ecdaba] bg-white text-sm outline-none focus:ring-2 focus:ring-[#f1cf8f]/40 w-96"
                      />
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
                        ) : filtered.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]/70">No customers found.</td>
                          </tr>
                        ) : (
                          filtered.map((c, idx) => (
                            <tr key={c.member_code} className={idx % 2 === 0 ? "bg-[#fffaf0]" : "bg-[#fff4e6]"}>
                              <td className="px-3 py-3 text-xs text-[#6b3a35]/80">{idx + 1}</td>
                              <td className="px-3 py-3 font-mono text-xs text-[#3b1512]">{c.member_code}</td>
                              <td className="px-3 py-3 text-sm text-[#3b1512]">{c.name}</td>
                              <td className="px-3 py-3 text-sm text-[#6b3a35]">{c.phone}</td>
                              <td className="px-3 py-3 text-sm text-[#6b3a35]/80">{c.dob ? new Date(c.dob).toLocaleDateString("en-GB") : "—"}</td>

                              <td className="px-3 py-3">
                                {/* Compact single-line 12 stamps */}
                                {renderStampRowCompact(c.member_code, Number(c.current_stamps || 0))}
                              </td>

                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openRewardsModal(c)}
                                    className="px-2 py-1 rounded-full bg-[#fff4d8] text-sm font-semibold border border-[#f1cf8f]"
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

            {activeTab === "insights" && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Insights</h3>
                      <p className="text-xs text-[#6b3a35]/70">Charts & quick data view</p>
                    </div>
                  </div>

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

          {/* Right column */}
          <aside className="col-span-12 lg:col-span-3 space-y-6">
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

            {/* Quick actions: Refresh & Export CSV only */}
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
