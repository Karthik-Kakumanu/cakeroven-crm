// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/**
 * AdminDashboard.jsx — Desktop-first, full-screen admin dashboard
 *
 * Notes:
 * - Keeps the same API calls and behaviour as your original file.
 * - Designed to fill the entire viewport on desktop (no centered narrow container).
 * - Uses Tailwind CSS utility classes for layout and style.
 * - Put `reward-chime.mp3` and `cakeroven-logo.png` in /public as before.
 */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [removingFor, setRemovingFor] = useState(null);

  // celebration state when someone hits reward
  const [celebration, setCelebration] = useState(null);
  const rewardAudioRef = useRef(null);

  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  // --------- helpers ----------
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

  // ---------- stats + birthdays from customers ----------
  const todayInfo = useMemo(() => {
    if (!customers.length) {
      return {
        totalUsers: 0,
        totalStamps: 0,
        totalRewards: 0,
        birthdaysToday: [],
      };
    }

    let totalStamps = 0;
    let totalRewards = 0;
    const today = new Date();
    const tDay = today.getDate();
    const tMonth = today.getMonth();

    const birthdaysToday = [];

    customers.forEach((c) => {
      const stamps = Number(c.current_stamps || 0);
      const rewards = Number(c.total_rewards || 0);
      totalStamps += stamps;
      totalRewards += rewards;

      if (c.dob) {
        const d = new Date(c.dob);
        if (!Number.isNaN(d.getTime())) {
          if (d.getDate() === tDay && d.getMonth() === tMonth) {
            birthdaysToday.push(c);
          }
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

  // ---------- customers close to reward (9,10,11 stamps etc.) ----------
  const almostReward = useMemo(() => {
    if (!customers.length) return [];

    const closeOnes = customers.filter((c) => {
      const s = Number(c.current_stamps || 0);
      return s >= 9 && s < 12;
    });

    closeOnes.sort((a, b) => {
      const sa = Number(a.current_stamps || 0);
      const sb = Number(b.current_stamps || 0);
      return sb - sa;
    });

    return closeOnes;
  }, [customers]);

  // auto-hide celebration after a few seconds
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 4000);
    return () => clearTimeout(t);
  }, [celebration]);

  // ---------- initial fetch ----------
  useEffect(() => {
    if (!token) {
      navigate("/admin");
      return;
    }

    const controller = new AbortController();

    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
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

        setCustomers(data.customers || []);
        setFiltered(data.customers || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        alert("Server error");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
    return () => controller.abort();
  }, [navigate, token]);

  // ---------- search ----------
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

  // ---------- actions ----------
  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  const handleAddStamp = async (memberCode) => {
    if (!token) return;
    setAddingFor(memberCode);

    // optimistic UI: keep previous values and update after response
    const current = customers.find((c) => c.member_code === memberCode);
    const prevStamps = Number(current?.current_stamps || 0);
    const prevRewards = Number(current?.total_rewards || 0);

    try {
      const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || "Could not update stamp");
        return;
      }

      const newStamps = Number(data.card.currentStamps ?? data.card.current_stamps ?? 0);
      const newRewards = Number(data.card.totalRewards ?? data.card.total_rewards ?? 0);

      // check if this action completed a reward: 11 -> 0 and reward +1
      if (prevStamps === 11 && newStamps === 0 && newRewards === prevRewards + 1) {
        setCelebration({
          memberCode,
          name: current?.name,
          phone: current?.phone,
          rewards: newRewards,
        });

        if (rewardAudioRef.current) {
          try {
            rewardAudioRef.current.currentTime = 0;
            rewardAudioRef.current.play().catch(() => {});
          } catch (e) {
            // ignore audio autoplay errors
          }
        }
      }

      // update local state using functional update
      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || "Could not undo stamp");
        return;
      }

      const newStamps = Number(data.card.currentStamps ?? data.card.current_stamps ?? 0);
      const newRewards = Number(data.card.totalRewards ?? data.card.total_rewards ?? 0);

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
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
    } finally {
      setRemovingFor(null);
    }
  };

  if (!token) return null;

  const { totalUsers, totalStamps, totalRewards, birthdaysToday } = todayInfo;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#fbf3df] to-[#f2e6c7] text-[#4b130f]">
      {/* audio element */}
      <audio ref={rewardAudioRef} src="/reward-chime.mp3" preload="auto" />

      {/* Topbar (sticky) */}
      <header className="w-full sticky top-0 z-40 backdrop-blur-sm bg-white/30 border-b border-[#f0dcb4]/60">
        <div className="max-w-full px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden">
                <img src="/cakeroven-logo.png" alt="CakeRoven" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xs text-[#6b3a35]">CakeRoven Admin</p>
                <p className="text-base font-semibold text-[#3b1512]">Welcome, {adminName}</p>
              </div>
            </div>

            <div className="ml-6 hidden lg:flex items-center gap-4">
              <div className="px-3 py-2 rounded-lg bg-[#501914] text-[#f7e6c8] text-sm font-medium shadow-sm">
                Dashboard
              </div>
              <div className="px-3 py-2 rounded-lg bg-white/80 text-[#4b130f] text-sm border border-[#f3e1be]">
                Customers & Stamps
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / phone / member ID"
                className="px-3 py-2 rounded-lg w-72 border border-[#ecdaba] bg-white text-sm outline-none focus:ring-2 focus:ring-[#f1cf8f]/40"
              />
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm font-semibold shadow hover:bg-[#40100f] transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content: full width grid */}
      <main className="w-full px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left / Primary area (big) */}
          <section className="col-span-12 lg:col-span-8">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Total members</p>
                <p className="text-2xl font-bold mt-1">{totalUsers}</p>
              </div>
              <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Stamps given</p>
                <p className="text-2xl font-bold mt-1">{totalStamps}</p>
              </div>
              <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
                <p className="text-xs text-[#6b3a35] uppercase tracking-wide">Rewards unlocked</p>
                <p className="text-2xl font-bold mt-1">{totalRewards}</p>
              </div>
            </div>

            {/* Search (mobile visible) */}
            <div className="mb-4 lg:hidden">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / phone / member ID"
                className="w-full px-3 py-2 rounded-2xl border border-[#ecdaba] bg-white text-sm outline-none"
              />
            </div>

            {/* Table card */}
            <div className="rounded-3xl bg-white shadow-lg border border-[#f3dfb1] overflow-hidden">
              {/* table header area */}
              <div className="px-6 py-4 border-b border-[#f3dfb1] flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#3b1512]">Customers</h3>
                  <p className="text-xs text-[#6b3a35]/70">Click +1 after bills of ₹500+. Use Undo to fix mistakes.</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-[#6b3a35]/80">Showing</div>
                  <div className="px-3 py-1 rounded-full bg-[#fff6e6] text-sm font-semibold border border-[#f1dfb9]">
                    {filtered.length}
                  </div>
                </div>
              </div>

              {/* table */}
              <div className="w-full overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">S.No</th>
                      <th className="px-4 py-3 text-left">Member ID</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">DOB</th>
                      <th className="px-4 py-3 text-left">Stamps</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]">
                          Loading customers…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-[#6b3a35]/70">
                          No customers found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((c, index) => {
                        const stamps = Number(c.current_stamps || 0);
                        const rewards = Number(c.total_rewards || 0);
                        const progress = Math.max(0, Math.min(12, stamps));

                        return (
                          <tr
                            key={c.member_code}
                            className={index % 2 === 0 ? "bg-[#fffaf0]" : "bg-[#fff4e6]"}
                          >
                            <td className="px-4 py-4 text-sm text-[#6b3a35]/80">{index + 1}</td>
                            <td className="px-4 py-4 text-sm font-mono text-[#3b1512]">{c.member_code}</td>
                            <td className="px-4 py-4 text-sm text-[#3b1512]">{c.name}</td>
                            <td className="px-4 py-4 text-sm text-[#6b3a35]">{c.phone}</td>
                            <td className="px-4 py-4 text-sm text-[#6b3a35]/80">{formatDate(c.dob)}</td>

                            <td className="px-4 py-4">
                              <div className="w-52 max-w-full flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-[12px] font-semibold text-[#92400e]">
                                    {stamps}/12
                                  </span>
                                  <span className="text-[12px] text-[#6b3a35]/70">
                                    Rewards <span className="font-semibold">{rewards}</span>
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-[#3b0f0c]/20 overflow-hidden">
                                  <div
                                    className="h-full bg-[#fbbf24] transition-all"
                                    style={{ width: `${(progress / 12) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleRemoveStamp(c.member_code)}
                                  disabled={removingFor === c.member_code}
                                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#cfae85] text-[#3b1512] bg-white/90 hover:bg-white disabled:opacity-60"
                                >
                                  {removingFor === c.member_code ? "Undoing…" : "Undo"}
                                </button>
                                <button
                                  onClick={() => handleAddStamp(c.member_code)}
                                  disabled={addingFor === c.member_code}
                                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#501914] text-[#f5e6c8] hover:bg-[#40100f] disabled:opacity-60 shadow-sm"
                                >
                                  {addingFor === c.member_code ? "Updating…" : "+1"}
                                </button>
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
          </section>

          {/* Right / Secondary column */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            {/* Birthday card */}
            <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-full bg-[#fff3d9] p-2">
                  <span className="text-xl">🎂</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#3b1512]">Today's CakeRoven birthdays</p>
                  <p className="text-xs text-[#6b3a35]/70">Celebrate with a special note or offer.</p>
                </div>
              </div>

              {birthdaysToday.length === 0 ? (
                <p className="text-sm text-[#6b3a35]/70 mt-2">No member birthdays today.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {birthdaysToday.map((b) => (
                    <li key={b.member_code} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{b.name}</div>
                        <div className="text-xs font-mono text-[#6b3a35]/70">{b.member_code} • {b.phone}</div>
                      </div>
                      <div className="text-xs text-[#6b3a35]/60">{formatDate(b.dob)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Almost reward */}
            <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-[#3b1512]">Almost at reward</p>
                  <p className="text-xs text-[#6b3a35]/70">Customers with 9–11 stamps (most stamps first)</p>
                </div>
              </div>

              {almostReward.length === 0 ? (
                <p className="text-sm text-[#6b3a35]/70">No members between 9 and 11 stamps.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {almostReward.slice(0, 6).map((c) => {
                    const stamps = Number(c.current_stamps || 0);
                    return (
                      <div key={c.member_code} className="flex items-center justify-between bg-[#fffaf0] p-2 rounded-lg border border-[#f3e6c2]">
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-xs font-mono text-[#6b3a35]/70">{c.member_code}</div>
                        </div>
                        <div className="text-sm">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-[12px] font-semibold text-[#92400e]">
                            {stamps}/12
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-xs text-[#6b3a35]/60">
                Tip: focus on these members for special reminders or offers — they're closest to unlocking a free CakeRoven treat 🎁
              </p>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl bg-white shadow-md p-4 border border-[#f3dfb1]">
              <p className="text-sm font-semibold text-[#3b1512] mb-2">Quick actions</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { window.open("/card", "_blank"); }}
                  className="w-full px-3 py-2 rounded-lg bg-[#501914] text-white text-sm font-semibold hover:bg-[#40100f] transition"
                >
                  Open sample stamp card
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-3 py-2 rounded-lg border border-[#ecd9b4] text-sm text-[#3b1512] bg-white hover:bg-[#fff9ee] transition"
                >
                  Refresh data
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Celebration overlay when 12th stamp is completed */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {/* confetti bits (CSS keyframes recommended in global CSS) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 25 }).map((_, i) => (
              <span
                key={i}
                className="absolute w-1.5 h-4 rounded-sm bg-[#fbbf24] animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "-10px",
                  animationDelay: `${Math.random() * 0.7}s`,
                  transform: `rotate(${Math.random() * 40 - 20}deg)`,
                }}
              />
            ))}
          </div>

          <div className="relative z-60 max-w-lg w-full mx-4 rounded-3xl bg-[#501914] text-[#f5e6c8] shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-6 border border-[#fcd9a7]">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎉</div>
              <div className="flex-1">
                <p className="text-xs font-semibold tracking-wide uppercase text-[#f5e6c8]/80">Reward unlocked!</p>
                <p className="text-lg font-bold mt-1">{celebration.name || "Member"} completed 12 stamps</p>

                <div className="mt-3 text-sm">
                  <p>
                    Member <span className="font-mono">{celebration.memberCode}</span> has unlocked a complimentary CakeRoven treat.
                  </p>
                  <p className="mt-1 text-sm text-[#f5e6c8]/80">
                    Total rewards earned so far: <span className="font-semibold">{celebration.rewards ?? "--"}</span>
                  </p>
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setCelebration(null)}
                    className="px-4 py-2 rounded-full bg-[#f5e6c8] text-[#501914] font-semibold shadow hover:bg-[#ffe9c7] transition"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Helpful CSS notes for confetti animation (paste into your global CSS if not present)
        @keyframes confetti {
          0% { transform: translate3d(0, -10px, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(0, 120vh, 0) rotate(360deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti 900ms ease-out forwards; }
      */}
    </div>
  );
}
