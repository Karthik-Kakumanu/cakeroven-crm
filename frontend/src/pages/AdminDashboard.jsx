// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/*
  Improvements:
  - Polls /api/admin/customers every 5s (auto-refresh).
  - Plays a short audio + Browser Notification when a new member appears or when any customer reaches 12 stamps.
  - Adds 'Almost at reward' list (9..11) sorted desc.
  - Desktop-first layout, full-width table, polished styles.
  - Handles expired/invalid token (401/403).
*/
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [removingFor, setRemovingFor] = useState(null);

  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  const prevCustomerCount = useRef(0);
  const prevStampSnapshot = useRef(new Map());
  const audioRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio("/notify.mp3"); // include a small notify.mp3 in public/
    // request notification permission proactively (good UX on admin devices)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // helper: format DOB
  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  // compute almost-at-reward list
  const almostAtReward = useMemo(() => {
    return customers
      .filter((c) => {
        const s = Number(c.current_stamps || 0);
        return s >= 9 && s <= 11;
      })
      .sort((a, b) => Number(b.current_stamps || 0) - Number(a.current_stamps || 0))
      .slice(0, 8);
  }, [customers]);

  // periodic fetch + initial fetch
  useEffect(() => {
    if (!token) {
      navigate("/admin");
      return;
    }

    let mounted = true;

    async function fetchCustomers() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("cr_adminToken");
            localStorage.removeItem("cr_adminUsername");
            navigate("/admin");
            return;
          }
          console.error("Failed loading customers", data);
          setLoading(false);
          return;
        }

        if (!mounted) return;

        // detect new members
        const count = (data.customers || []).length;
        if (prevCustomerCount.current && count > prevCustomerCount.current) {
          // new member created
          triggerNotification("New member created", "A customer created a new stamp card.");
        }
        prevCustomerCount.current = count;

        // detect any stamp reaching 12
        const snapshotNow = new Map();
        (data.customers || []).forEach((c) => {
          snapshotNow.set(c.member_code, Number(c.current_stamps || 0));
        });

        for (const [member, s] of snapshotNow.entries()) {
          const prev = prevStampSnapshot.current.get(member) ?? 0;
          if (s >= 12 && prev < 12) {
            triggerNotification("Reward unlocked", `${member} just completed 12 stamps!`);
            break;
          }
        }
        prevStampSnapshot.current = snapshotNow;

        setCustomers(data.customers || []);
        setFiltered(data.customers || []);
      } catch (err) {
        console.error("Admin fetch error", err);
      } finally {
        setLoading(false);
      }
    }

    // initial fetch
    fetchCustomers();

    // poll every 5s
    pollRef.current = setInterval(fetchCustomers, 5000);
    return () => {
      mounted = false;
      clearInterval(pollRef.current);
    };
  }, [navigate, token]);

  // search filter
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFiltered(customers);
      return;
    }
    setFiltered(
      customers.filter((c) => {
        return (
          String(c.name || "").toLowerCase().includes(q) ||
          String(c.phone || "").toLowerCase().includes(q) ||
          String(c.member_code || "").toLowerCase().includes(q)
        );
      })
    );
  }, [search, customers]);

  function triggerNotification(title, body) {
    try {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/cakeroven-logo.png" });
      }
    } catch (e) {
      // ignore
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  async function handleAddStamp(memberCode) {
    if (!token) return;
    setAddingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.message || "Could not update stamp");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? { ...c, current_stamps: data.card.currentStamps, total_rewards: data.card.totalRewards }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setAddingFor(null);
    }
  }

  async function handleRemoveStamp(memberCode) {
    if (!token) return;
    setRemovingFor(memberCode);
    try {
      const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.message || "Could not undo stamp");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? { ...c, current_stamps: data.card.currentStamps, total_rewards: data.card.totalRewards }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setRemovingFor(null);
    }
  }

  if (!token) return null;

  const totalUsers = customers.length;
  const totalStamps = customers.reduce((s, c) => s + Number(c.current_stamps || 0), 0);
  const totalRewards = customers.reduce((s, c) => s + Number(c.total_rewards || 0), 0);

  return (
    <div className="min-h-screen bg-[#f5e6c8] p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#501914] p-1">
              <img src="/cakeroven-logo.png" alt="logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <div className="text-xs text-[#501914]/70">CakeRoven Admin</div>
              <div className="font-semibold text-[#501914]">Welcome, {adminName}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8]" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* top cards + search */}
        <div className="bg-[#501914] p-5 rounded-2xl text-[#f5e6c8] mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-[#f5e6c8]/95 p-3 rounded-xl text-[#501914]">
              <div className="text-[11px] uppercase">Total members</div>
              <div className="text-lg font-semibold">{totalUsers}</div>
            </div>
            <div className="bg-[#f5e6c8]/95 p-3 rounded-xl text-[#501914]">
              <div className="text-[11px] uppercase">Stamps given</div>
              <div className="text-lg font-semibold">{totalStamps}</div>
            </div>
            <div className="bg-[#f5e6c8]/95 p-3 rounded-xl text-[#501914]">
              <div className="text-[11px] uppercase">Rewards unlocked</div>
              <div className="text-lg font-semibold">{totalRewards}</div>
            </div>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: name / phone / CR ID"
            className="w-full p-3 rounded-xl bg-[#f5e6c8] text-[#501914] outline-none"
          />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <div className="bg-white p-4 rounded-2xl shadow overflow-x-auto">
              {loading ? (
                <div className="text-center py-8 text-[#501914]">Loading customers…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-[#501914]/70">No customers found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#501914] text-[#f5e6c8]">
                    <tr>
                      <th className="p-3 text-left">S.No</th>
                      <th className="p-3 text-left">Member ID</th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Phone</th>
                      <th className="p-3 text-left">Date of birth</th>
                      <th className="p-3 text-left">Stamps (0–12)</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => {
                      const stamps = Number(c.current_stamps || 0);
                      const rewards = Number(c.total_rewards || 0);
                      const progressPct = Math.max(0, Math.min(100, (stamps / 12) * 100));
                      return (
                        <tr key={c.member_code} className={idx % 2 === 0 ? "bg-[#fef7e8]" : "bg-[#f9ecce]"}>
                          <td className="p-3 text-xs">{idx + 1}</td>
                          <td className="p-3 font-mono text-xs font-semibold">{c.member_code}</td>
                          <td className="p-3">{c.name}</td>
                          <td className="p-3">{c.phone}</td>
                          <td className="p-3 text-xs">{formatDate(c.dob)}</td>
                          <td className="p-3">
                            <div className="w-48 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] text-[11px] font-semibold text-[#92400e]">
                                  {stamps}/12
                                </span>
                                <span className="text-[11px] text-[#501914]/70">Rewards {rewards}</span>
                              </div>
                              <div className="h-2 rounded-full bg-[#e6d6b8] overflow-hidden">
                                <div className="h-full bg-[#fbbf24]" style={{ width: `${progressPct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex gap-2 items-center">
                              <button
                                onClick={() => handleRemoveStamp(c.member_code)}
                                disabled={removingFor === c.member_code}
                                className="px-3 py-1.5 rounded-full border text-xs bg-white"
                              >
                                {removingFor === c.member_code ? "Undoing…" : "Undo"}
                              </button>
                              <button
                                onClick={() => handleAddStamp(c.member_code)}
                                disabled={addingFor === c.member_code}
                                className="px-3 py-1.5 rounded-full text-xs bg-[#501914] text-[#f5e6c8]"
                                title="Add stamp (after eligible bill)"
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
          </div>

          <aside className="col-span-4 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow">
              <h4 className="font-semibold text-[#501914]">Almost at reward</h4>
              <p className="text-xs text-[#501914]/70 mb-3">Customers with 9–11 stamps (sorted highest first)</p>
              {almostAtReward.length === 0 ? (
                <p className="text-xs text-[#501914]/60">No members are currently between 9 and 11 stamps.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-[#501914]/80">
                      <th className="p-2 text-left">Member</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Stamps</th>
                      <th className="p-2 text-right">Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {almostAtReward.map((m) => {
                      const s = Number(m.current_stamps || 0);
                      return (
                        <tr key={m.member_code} className="bg-[#fff4d8]">
                          <td className="p-2 font-mono text-xs">{m.member_code}</td>
                          <td className="p-2 text-xs">{m.name}</td>
                          <td className="p-2 text-xs">{s}/12</td>
                          <td className="p-2 text-xs text-right">{12 - s}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="text-[11px] mt-3 text-[#501914]/70">Tip: focus on these members for special reminders or offers — they're closest to unlocking a free treat 🎁</p>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow">
              <h4 className="font-semibold text-[#501914]">Quick actions</h4>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => { /* manual refresh */ (async () => {
                    setLoading(true);
                    try {
                      const res = await fetch(`${API_BASE}/api/admin/customers`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const data = await res.json().catch(() => null);
                      if (res.ok && data) setCustomers(data.customers || []);
                    } catch (e) { console.error(e); }
                    setLoading(false);
                  })(); }}
                  className="w-full py-2 rounded-lg bg-[#501914] text-[#f5e6c8]"
                >
                  Refresh now
                </button>
                <a href={`${API_BASE}/api/admin/export-csv`} className="w-full inline-block text-center py-2 rounded-lg border">Export CSV</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
