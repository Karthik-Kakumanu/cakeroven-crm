import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyMember, setBusyMember] = useState(null);

  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  useEffect(() => {
    if (!token) {
      navigate("/admin-login");
      return;
    }

    const fetchCustomers = async () => {
      setLoading(true);
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
            localStorage.removeItem("cr_adminRole");
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

  // search filter
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
    localStorage.removeItem("cr_adminRole");
    navigate("/admin-login");
  };

  const handleStampChange = async (memberCode, type) => {
    if (!token) return;

    setBusyMember(memberCode);

    try {
      const endpoint =
        type === "add"
          ? `${API_BASE}/api/admin/add-stamp`
          : `${API_BASE}/api/admin/remove-stamp`;

      const res = await fetch(endpoint, {
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
        setBusyMember(null);
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
      setBusyMember(null);
    }
  };

  // analytics
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalRewards = customers.reduce(
      (sum, c) => sum + (c.total_rewards || 0),
      0
    );
    const totalStamps = customers.reduce(
      (sum, c) => sum + (c.current_stamps || 0),
      0
    );

    const today = new Date();
    const todayBirthdays = customers.filter((c) => {
      if (!c.dob) return false;
      const d = new Date(c.dob);
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
    });

    return { totalCustomers, totalRewards, totalStamps, todayBirthdays };
  }, [customers]);

  const chartData = useMemo(() => {
    if (!customers.length) return [];
    const buckets = {
      "0–3": 0,
      "4–7": 0,
      "8–11": 0,
      "12": 0,
    };
    customers.forEach((c) => {
      const s = c.current_stamps || 0;
      if (s === 12) buckets["12"] += 1;
      else if (s <= 3) buckets["0–3"] += 1;
      else if (s <= 7) buckets["4–7"] += 1;
      else buckets["8–11"] += 1;
    });
    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [customers]);

  if (!token) return null;

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#f5e6c8] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex w-full max-w-6xl flex-col gap-6"
      >
        {/* top bar */}
        <div className="flex flex-col gap-4 rounded-3xl bg-[#501914] px-6 py-5 text-[#f5e6c8] shadow-[0_30px_60px_rgba(0,0,0,0.55)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5e6c8]">
              <div className="h-9 w-9 overflow-hidden rounded-full">
                <img
                  src="/cakeroven-logo.png"
                  alt="CakeRoven"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-[#f5e6c8]/70">CakeRoven Admin</p>
              <p className="text-sm font-semibold">
                Welcome, {adminName || "Owner"}
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <input
              type="text"
              placeholder="Search: name / phone / CR ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-2xl border border-[#f5e6c8]/35 bg-[#f5e6c8] px-4 py-2.5 text-xs text-[#501914] outline-none focus:border-[#f5e6c8] focus:ring-2 focus:ring-[#f5e6c8]/70"
            />
            <button
              onClick={handleLogout}
              className="rounded-2xl bg-[#f5e6c8] px-4 py-2 text-xs font-semibold text-[#501914] shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
            >
              Logout
            </button>
          </div>
        </div>

        {/* analytics + birthdays */}
        <div className="grid gap-4 md:grid-cols-[2fr,1.2fr]">
          {/* chart & stats */}
          <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#501914]">
                Loyalty overview
              </h3>
              <p className="text-[11px] text-[#501914]/70">
                Total customers:{" "}
                <span className="font-semibold">{stats.totalCustomers}</span>
              </p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 text-center text-[11px] text-[#501914]">
              <div className="rounded-2xl bg-[#f5e6c8] px-3 py-2">
                <p className="text-[10px] text-[#501914]/70">Active stamps</p>
                <p className="mt-1 text-base font-semibold">
                  {stats.totalStamps}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f5e6c8] px-3 py-2">
                <p className="text-[10px] text-[#501914]/70">Rewards given</p>
                <p className="mt-1 text-base font-semibold">
                  {stats.totalRewards}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f5e6c8] px-3 py-2">
                <p className="text-[10px] text-[#501914]/70">
                  Avg stamps / user
                </p>
                <p className="mt-1 text-base font-semibold">
                  {stats.totalCustomers
                    ? (stats.totalStamps / stats.totalCustomers).toFixed(1)
                    : "0.0"}
                </p>
              </div>
            </div>

            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3d9b5"
                  />
                  <XAxis
                    dataKey="range"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#501914" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(80,25,20,0.05)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow:
                        "0 12px 25px rgba(0,0,0,0.18)",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* birthdays */}
          <div className="rounded-3xl bg-white px-5 py-4 text-sm text-[#501914] shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span role="img" aria-label="birthday">
                🎂
              </span>
              Today&apos;s CakeRoven birthdays
            </h3>
            {stats.todayBirthdays.length === 0 ? (
              <p className="text-[12px] text-[#501914]/70">
                No member birthdays today.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-[12px]">
                {stats.todayBirthdays.map((b) => (
                  <li key={b.member_code}>
                    <span className="font-mono text-xs">
                      {b.member_code}
                    </span>{" "}
                    – <span className="font-medium">{b.name}</span>{" "}
                    <span className="text-[#501914]/70">({b.phone})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* table */}
        <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
          <div className="mb-3 flex items-center justify-between text-sm text-[#501914]">
            <h3 className="font-semibold">Customers & stamps</h3>
            <p className="text-[11px] text-[#501914]/70">
              Click <span className="font-semibold">+1</span> after each eligible bill,
              <span className="font-semibold"> Undo</span> to correct mistakes.
            </p>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-[#501914]/70">
              Loading customers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#501914]/70">
              No customers found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px] text-[#501914]">
                <thead>
                  <tr className="bg-[#501914] text-[11px] uppercase tracking-wide text-[#f5e6c8]">
                    <th className="px-3 py-2">S.No</th>
                    <th className="px-3 py-2">Member ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Date of Birth</th>
                    <th className="px-3 py-2">Stamps (0–12)</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => (
                    <tr
                      key={c.member_code}
                      className={
                        idx % 2 === 0
                          ? "bg-[#fdf6e8]"
                          : "bg-[#faedd5]"
                      }
                    >
                      <td className="px-3 py-2 align-middle">{idx + 1}</td>
                      <td className="px-3 py-2 align-middle font-mono text-xs">
                        {c.member_code}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs">
                        {c.name}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs">
                        {c.phone}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs">
                        {c.dob
                          ? new Date(c.dob).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 min-w-[40px] items-center justify-center rounded-full bg-white px-2 text-xs font-mono shadow-sm">
                            {c.current_stamps}/12
                          </span>
                          <span className="text-[11px] text-[#501914]/70">
                            Rewards:{" "}
                            <span className="font-semibold">
                              {c.total_rewards}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              handleStampChange(c.member_code, "remove")
                            }
                            disabled={busyMember === c.member_code}
                            className="rounded-full border border-[#501914]/40 px-3 py-1 text-[11px] font-semibold text-[#501914] hover:bg-[#501914]/5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Undo
                          </button>
                          <button
                            onClick={() =>
                              handleStampChange(c.member_code, "add")
                            }
                            disabled={busyMember === c.member_code}
                            className="rounded-full bg-[#501914] px-3 py-1 text-[11px] font-semibold text-[#f5e6c8] shadow-sm hover:bg-[#3d100e] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyMember === c.member_code ? "…" : "+1"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
