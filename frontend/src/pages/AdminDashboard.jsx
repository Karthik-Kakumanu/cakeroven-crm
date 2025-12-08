// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

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

  // ---------- initial fetch ----------
  useEffect(() => {
    if (!token) {
      navigate("/admin-login");
      return;
    }

    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

        setCustomers(data.customers || []);
        setFiltered(data.customers || []);
      } catch (err) {
        console.error(err);
        alert("Server error");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
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
    navigate("/admin-login");
  };

  const handleAddStamp = async (memberCode) => {
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

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not update stamp");
        return;
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? {
                ...c,
                current_stamps: data.card.currentStamps,
                total_rewards: data.card.totalRewards,
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

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not undo stamp");
        return;
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.member_code === memberCode
            ? {
                ...c,
                current_stamps: data.card.currentStamps,
                total_rewards: data.card.totalRewards,
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
    <div className="min-h-screen bg-[#f5e6c8] flex flex-col items-center p-4">
      <div className="w-full max-w-6xl space-y-4">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#501914] flex items-center justify-center shadow-md">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-[#f5e6c8]">
                <img
                  src="/cakeroven-logo.png"
                  alt="CakeRoven"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-[#501914]/70 tracking-wide">
                CakeRoven Admin
              </p>
              <p className="text-sm font-semibold text-[#501914]">
                Welcome, {adminName}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="self-start sm:self-auto px-4 py-1.5 rounded-full bg-[#501914] text-[#f5e6c8] text-xs font-semibold shadow-[0_4px_10px_rgba(0,0,0,0.4)] hover:bg-[#3f120f] transition"
          >
            Logout
          </button>
        </div>

        {/* Stats + birthdays */}
        <div className="grid gap-4 md:grid-cols-[2fr,1.1fr]">
          <div className="bg-[#501914] rounded-3xl p-4 text-[#f5e6c8] shadow-[0_0_30px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Customers &amp; stamps
                </h2>
                <p className="text-[11px] text-[#f5e6c8]/80">
                  Search by name, phone or member ID.
                </p>
              </div>
              <p className="hidden md:block text-[11px] text-[#f5e6c8]/60">
                Click <span className="font-semibold">+1</span> after bills of{" "}
                <span className="font-semibold">₹500+</span>. Use{" "}
                <span className="font-semibold">Undo</span> to fix mistakes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-[#501914]">
              <div className="rounded-2xl bg-[#f5e6c8]/95 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[#501914]/70">
                  Total members
                </p>
                <p className="text-lg font-semibold">{totalUsers}</p>
              </div>
              <div className="rounded-2xl bg-[#f5e6c8]/95 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[#501914]/70">
                  Stamps given
                </p>
                <p className="text-lg font-semibold">{totalStamps}</p>
              </div>
              <div className="rounded-2xl bg-[#f5e6c8]/95 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[#501914]/70">
                  Rewards unlocked
                </p>
                <p className="text-lg font-semibold">{totalRewards}</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="Search: name / phone / CR ID"
              className="w-full p-3 rounded-2xl border border-[#f5e6c8]/40 outline-none bg-[#f5e6c8] text-[#501914] text-sm focus:border-[#501914]/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {/* Birthday card */}
            <div className="bg-white/90 rounded-3xl p-4 shadow-[0_0_25px_rgba(0,0,0,0.18)] border border-[#f5e6c8]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎂</span>
                <p className="text-sm font-semibold text-[#501914]">
                  Today&apos;s CakeRoven birthdays
                </p>
              </div>
              {birthdaysToday.length === 0 ? (
                <p className="text-xs text-[#501914]/70">
                  No member birthdays today.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-xs text-[#501914]">
                  {birthdaysToday.map((b) => (
                    <li key={b.member_code}>
                      <span className="font-mono text-[11px] mr-1">
                        {b.member_code}
                      </span>
                      – {b.name} ({b.phone})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/95 rounded-3xl shadow-[0_0_35px_rgba(0,0,0,0.20)] overflow-hidden border border-[#f3dcaa]">
          {loading ? (
            <div className="p-6 text-center text-[#501914] text-sm">
              Loading customers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-[#501914]/70 text-sm">
              No customers found.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">S.No</th>
                    <th className="px-4 py-3">Member ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Date of birth</th>
                    <th className="px-4 py-3">Stamps (0–12)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, index) => {
                    const stamps = Number(c.current_stamps || 0);
                    const rewards = Number(c.total_rewards || 0);
                    const progress = Math.max(
                      0,
                      Math.min(12, stamps)
                    );

                    return (
                      <tr
                        key={c.member_code}
                        className={
                          index % 2 === 0
                            ? "bg-[#fef7e8]"
                            : "bg-[#f9ecce]"
                        }
                      >
                        <td className="px-4 py-3 text-xs text-[#501914]/80">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#501914]">
                          {c.member_code}
                        </td>
                        <td className="px-4 py-3 text-[#501914]">
                          {c.name}
                        </td>
                        <td className="px-4 py-3 text-[#501914]/90">
                          {c.phone}
                        </td>
                        <td className="px-4 py-3 text-[#501914]/80 text-xs">
                          {formatDate(c.dob)}
                        </td>

                        {/* NEW: prettier stamps cell */}
                        <td className="px-4 py-3">
                          <div className="w-40 max-w-full flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff4d8] border border-[#f1cf8f] text-[11px] font-semibold text-[#92400e]">
                                {stamps}/12
                              </span>
                              <span className="text-[11px] text-[#501914]/70">
                                Rewards{" "}
                                <span className="font-semibold">
                                  {rewards}
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#3b0f0c]/20 overflow-hidden">
                              <div
                                className="h-full bg-[#fbbf24]"
                                style={{
                                  width: `${(progress / 12) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                handleRemoveStamp(c.member_code)
                              }
                              disabled={removingFor === c.member_code}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#501914]/30 text-[#501914] bg-white/80 hover:bg-white disabled:opacity-60 shadow-sm"
                            >
                              {removingFor === c.member_code
                                ? "Undoing…"
                                : "Undo"}
                            </button>
                            <button
                              onClick={() =>
                                handleAddStamp(c.member_code)
                              }
                              disabled={addingFor === c.member_code}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#501914] text-[#f5e6c8] hover:bg-[#3f120f] shadow-[0_4px_10px_rgba(0,0,0,0.35)] disabled:opacity-60"
                            >
                              {addingFor === c.member_code
                                ? "Updating…"
                                : "+1"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
