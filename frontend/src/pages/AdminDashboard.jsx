// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/**
 * Admin dashboard:
 * - Full-screen friendly & desktop focused
 * - Auto-refresh poll every 5s
 * - Sound notification when new card is created
 * - Right column shows "Almost at reward" sorted 11→9
 * - Each customer row includes a compact 12-stamp visual and dates tooltip
 */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [removingFor, setRemovingFor] = useState(null);
  const [lastTotal, setLastTotal] = useState(0);
  const audioRef = useRef(null);
  const pollRef = useRef(null);

  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  // helper
  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // set up notification sound
  useEffect(() => {
    audioRef.current = new Audio("/admin-notify.mp3"); // place small file in /public
    audioRef.current.volume = 0.6;
  }, []);

  // fetch function
  const fetchCustomers = async (isBackground = false) => {
    if (!token) return;
    if (!isBackground) setLoading(true);

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
          navigate("/admin");
          return;
        }
        alert(data.message || "Failed to load customers");
        setLoading(false);
        return;
      }

      const list = data.customers || [];
      // detect new members
      if (lastTotal && list.length > lastTotal) {
        // play sound
        if (audioRef.current) audioRef.current.play().catch(() => {});
      }
      setLastTotal(list.length);

      setCustomers(list);
      setFiltered(list);
    } catch (err) {
      console.error(err);
      if (!isBackground) alert("Server error");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // initial + auth check
  useEffect(() => {
    if (!token) {
      navigate("/admin");
      return;
    }
    fetchCustomers();

    // start polling (every 5s)
    pollRef.current = setInterval(() => fetchCustomers(true), 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, token]);

  // search filtering
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

  const todayInfo = useMemo(() => {
    let totalStamps = 0;
    let totalRewards = 0;
    const birthdaysToday = [];
    const today = new Date();
    const tDay = today.getDate();
    const tMonth = today.getMonth();

    customers.forEach((c) => {
      const stamps = Number(c.current_stamps || 0);
      const rewards = Number(c.total_rewards || 0);
      totalStamps += stamps;
      totalRewards += rewards;
      if (c.dob) {
        const d = new Date(c.dob);
        if (!Number.isNaN(d.getTime()) && d.getDate() === tDay && d.getMonth() === tMonth) {
          birthdaysToday.push(c);
        }
      }
    });

    return {
      totalUsers: customers.length,
      totalStamps,
      totalRewards,
      birthdaysToday,
    };
  }, [customers]);

  // customers close to reward 9-11 sorted desc
  const almostReward = useMemo(() => {
    return customers
      .filter((c) => {
        const s = Number(c.current_stamps || 0);
        return s >= 9 && s < 12;
      })
      .sort((a, b) => Number(b.current_stamps || 0) - Number(a.current_stamps || 0));
  }, [customers]);

  // actions
  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  const handleAddStamp = async (memberCode) => {
    if (!token) return;
    setAddingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Could not update stamp");
        return;
      }
      // update locally
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? { ...c, current_stamps: data.card.currentStamps, total_rewards: data.card.totalRewards, stamp_history: data.card.stampHistory || c.stamp_history }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setAddingFor(null);
    }
  };

  const handleRemoveStamp = async (memberCode) => {
    if (!token) return;
    setRemovingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Could not undo stamp");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? { ...c, current_stamps: data.card.currentStamps, total_rewards: data.card.totalRewards, stamp_history: data.card.stampHistory || c.stamp_history }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setRemovingFor(null);
    }
  };

  if (!token) return null;

  const { totalUsers, totalStamps, totalRewards, birthdaysToday } = todayInfo;

  return (
    <div className="min-h-screen bg-[#f5e6c8] p-6">
      <div className="max-w-[1500px] mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#501914] flex items-center justify-center shadow">
              <img src="/cakeroven-logo.png" alt="logo" className="w-11 h-11 rounded-full object-cover" />
            </div>
            <div>
              <div className="text-xs text-[#501914]/70">CakeRoven Admin</div>
              <div className="text-lg font-semibold text-[#501914]">Welcome, {adminName}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] shadow">
              Logout
            </button>
          </div>
        </div>

        {/* top stats */}
        <div className="bg-[#501914] rounded-2xl p-5 text-[#f5e6c8] grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Customers & stamps</h2>
                <p className="text-sm text-[#f5e6c8]/80">Search by name, phone or member ID.</p>
              </div>
              <div className="hidden md:block text-sm text-[#f5e6c8]/70">
                Click <span className="font-semibold">+1</span> after bills of <span className="font-semibold">₹500+</span>.
                Use <span className="font-semibold">Undo</span> to fix mistakes.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#f5e6c8]/95 text-[#501914] px-4 py-3 rounded-lg">
                <div className="text-xs uppercase">Total members</div>
                <div className="text-xl font-semibold">{totalUsers}</div>
              </div>
              <div className="bg-[#f5e6c8]/95 text-[#501914] px-4 py-3 rounded-lg">
                <div className="text-xs uppercase">Stamps given</div>
                <div className="text-xl font-semibold">{totalStamps}</div>
              </div>
              <div className="bg-[#f5e6c8]/95 text-[#501914] px-4 py-3 rounded-lg">
                <div className="text-xs uppercase">Rewards unlocked</div>
                <div className="text-xl font-semibold">{totalRewards}</div>
              </div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: name / phone / CR ID"
              className="w-full p-3 rounded-xl border border-[#f5e6c8]/30 bg-[#f5e6c8] text-[#501914]"
            />
          </div>

          {/* right mini widget */}
          <div>
            <div className="bg-white/90 rounded-xl p-4 border border-[#f3dcaa] text-[#501914] shadow">
              <div className="flex items-center gap-2 mb-2">
                <span>🎂</span>
                <div>
                  <div className="text-sm font-semibold">Today's CakeRoven birthdays</div>
                  <div className="text-xs text-[#501914]/70">{birthdaysToday.length === 0 ? "No member birthdays today." : `${birthdaysToday.length} birthday(s)`}</div>
                </div>
              </div>
              {birthdaysToday.length > 0 && (
                <ul className="mt-2 text-xs space-y-1">
                  {birthdaysToday.map((b) => (
                    <li key={b.member_code}>
                      <span className="font-mono">{b.member_code}</span> — {b.name} ({b.phone})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">
          {/* Left: table */}
          <div className="bg-white/95 rounded-2xl p-2 shadow border border-[#f3dcaa] overflow-auto">
            {loading ? (
              <div className="p-6 text-center text-[#501914]">Loading customers…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-[#501914]/70">No customers found.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">S.No</th>
                    <th className="px-4 py-3">Member ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">DOB</th>
                    <th className="px-4 py-3">Stamps</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((c, idx) => {
                    const stamps = Number(c.current_stamps || 0);
                    const rewards = Number(c.total_rewards || 0);
                    const progress = Math.max(0, Math.min(12, stamps));
                    const history = Array.isArray(c.stamp_history) ? c.stamp_history : [];

                    return (
                      <tr key={c.member_code} className={idx % 2 === 0 ? "bg-[#fef7e8]" : "bg-[#f9ecce]"}>
                        <td className="px-4 py-3 text-xs text-[#501914]/80">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#501914]">{c.member_code}</td>
                        <td className="px-4 py-3 text-[#501914]">{c.name}</td>
                        <td className="px-4 py-3 text-[#501914]/90">{c.phone}</td>
                        <td className="px-4 py-3 text-xs text-[#501914]/80">{c.dob ? formatDate(c.dob) : "-"}</td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center bg-[#fff4d8] px-2 py-0.5 rounded-full text-[11px] font-semibold text-[#92400e]">
                                {stamps}/12
                              </span>
                              <span className="text-[11px] text-[#501914]/70">Rewards <strong>{rewards}</strong></span>
                            </div>

                            <div className="h-2 rounded-full bg-[#3b0f0c]/20 overflow-hidden">
                              <div className="h-full bg-[#fbbf24]" style={{ width: `${(progress / 12) * 100}%` }} />
                            </div>

                            {/* compact 12 tick inline small */}
                            <div className="mt-2 flex gap-1 flex-wrap">
                              {Array.from({ length: 12 }).map((_, i) => {
                                const filled = Boolean(history[i]);
                                return (
                                  <div
                                    key={i}
                                    title={filled ? new Date(history[i]).toLocaleString() : "Not stamped"}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${filled ? "bg-[#f5e6c8] text-[#501914]" : "border border-[#d6c39a] text-[#bfa77a]"}`}
                                  >
                                    {i + 1}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRemoveStamp(c.member_code)}
                              disabled={removingFor === c.member_code}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#501914]/30 text-[#501914] bg-white/80 hover:bg-white disabled:opacity-60"
                            >
                              {removingFor === c.member_code ? "Undoing…" : "Undo"}
                            </button>

                            <button
                              onClick={() => handleAddStamp(c.member_code)}
                              disabled={addingFor === c.member_code}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#501914] text-[#f5e6c8] hover:bg-[#3f120f] disabled:opacity-60"
                            >
                              {addingFor === c.member_code ? "Updating…" : "+1"}
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

          {/* Right: almost reward + quick actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow border border-[#f3dcaa]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-[#501914]">Almost at reward</div>
                  <div className="text-xs text-[#501914]/70">Customers with 9–11 stamps (sorted highest first)</div>
                </div>
              </div>

              {almostReward.length === 0 ? (
                <p className="text-xs text-[#501914]/70 mt-2">No members are currently between 9 and 11 stamps.</p>
              ) : (
                <div className="mt-2 overflow-hidden rounded-lg border border-[#f3dcaa] bg-[#fffaf0]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#501914] text-[#f5e6c8] text-[11px] uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Member</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-center">Stamps</th>
                        <th className="px-3 py-2 text-center">Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {almostReward.map((c) => {
                        const s = Number(c.current_stamps || 0);
                        const left = 12 - s;
                        return (
                          <tr key={c.member_code} className="odd:bg-[#fff7e3] even:bg-[#ffefd0]">
                            <td className="px-3 py-2 font-mono">{c.member_code}</td>
                            <td className="px-3 py-2 truncate">{c.name}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-[11px] font-semibold text-[#92400e]">
                                {s}/12
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-[#501914]/80">{left}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-[10px] text-[#501914]/65">
                Tip: prioritise these members for reminders or special offers — they’re closest to unlocking a free CakeRoven treat 🎁
              </p>
            </div>

            {/* quick actions / generate reports */}
            <div className="bg-white rounded-2xl p-4 shadow border border-[#f3dcaa]">
              <div className="text-sm font-semibold mb-2">Quick actions</div>
              <div className="flex flex-col gap-2">
                <button onClick={() => fetchCustomers()} className="w-full px-3 py-2 rounded-lg bg-[#501914] text-[#f5e6c8]">Refresh now</button>
                <button onClick={() => {
                  const exportCsv = customers.map(c => `${c.member_code},${c.name},${c.phone},${c.current_stamps}`).join("\n");
                  const blob = new Blob([exportCsv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "customers.csv";
                  a.click();
                }} className="w-full px-3 py-2 rounded-lg border">Export CSV</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
