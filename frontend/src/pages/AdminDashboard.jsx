// AdminDashboard.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  // Must have token — otherwise redirect to admin login
  const token = typeof window !== "undefined" ? localStorage.getItem("cr_adminToken") : null;
  const adminName = typeof window !== "undefined" ? localStorage.getItem("cr_adminUsername") || "Owner" : "Owner";

  useEffect(() => {
    if (!token) {
      // if no token, redirect to login
      navigate("/admin", { replace: true });
      return;
    }

    // initial fetch + start polling
    fetchCustomers();

    pollingRef.current = setInterval(fetchCustomers, 6000); // every 6s
    return () => clearInterval(pollingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  async function fetchCustomers() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // token expired or invalid
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("cr_adminToken");
          localStorage.removeItem("cr_adminUsername");
          navigate("/admin", { replace: true });
          return;
        }
        setError(data?.message || "Failed to load customers.");
        setLoading(false);
        return;
      }

      setCustomers(data.customers || []);
      setLoading(false);
    } catch (err) {
      console.error("Fetch customers error:", err);
      setError("Server error. Try again later.");
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin", { replace: true });
  }

  // search
  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.member_code || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#f5e6c8] p-6">
      <div className="max-w-7xl mx-auto">
        {/* top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#501914] flex items-center justify-center">
              <img src="/cakeroven-logo.png" alt="logo" className="w-10 h-10 object-cover rounded-full" />
            </div>
            <div>
              <p className="text-xs text-[#501914]/70">CakeRoven Admin</p>
              <p className="font-semibold text-[#501914]">Welcome, {adminName}</p>
            </div>
          </div>
          <div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] font-semibold shadow"
            >
              Logout
            </button>
          </div>
        </div>

        {/* stats + search */}
        <div className="bg-[#501914] rounded-2xl p-5 text-[#f5e6c8] mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl bg-[#f5e6c8]/90 text-[#501914] p-3">
              <div className="text-xs">Total members</div>
              <div className="text-xl font-semibold">{customers.length}</div>
            </div>
            <div className="rounded-xl bg-[#f5e6c8]/90 text-[#501914] p-3">
              <div className="text-xs">Stamps given</div>
              <div className="text-xl font-semibold">
                {customers.reduce((s, c) => s + Number(c.current_stamps || 0), 0)}
              </div>
            </div>
            <div className="rounded-xl bg-[#f5e6c8]/90 text-[#501914] p-3">
              <div className="text-xs">Rewards unlocked</div>
              <div className="text-xl font-semibold">
                {customers.reduce((s, c) => s + Number(c.total_rewards || 0), 0)}
              </div>
            </div>
          </div>

          <div>
            <input
              placeholder="Search: name / phone / CR ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#f5e6c8] text-[#501914] outline-none"
            />
          </div>
        </div>

        {/* main content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* left: table (span 2 on wide screens) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow p-4">
              {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

              {loading ? (
                <div className="p-12 text-center text-[#501914]">Loading customers…</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-[#501914]/70">No customers found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#501914] text-[#f5e6c8] text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3">S.No</th>
                        <th className="px-4 py-3">Member ID</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">DOB</th>
                        <th className="px-4 py-3">Stamps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c, idx) => (
                        <tr key={c.member_code} className={idx % 2 === 0 ? "bg-[#fff8ee]" : "bg-[#f5edd3]"}>
                          <td className="px-4 py-3">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono">{c.member_code}</td>
                          <td className="px-4 py-3">{c.name}</td>
                          <td className="px-4 py-3">{c.phone}</td>
                          <td className="px-4 py-3">{c.dob ? new Date(c.dob).toLocaleDateString() : "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="inline-flex items-center px-2 py-1 rounded-full bg-[#fff4d8] text-sm font-semibold">
                                {c.current_stamps || 0}/12
                              </div>
                              <div className="w-40 h-2 bg-[#f0e6d0] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#fbbf24]"
                                  style={{ width: `${Math.min(100, ((c.current_stamps || 0) / 12) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* right: sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow">
              <h3 className="font-semibold text-[#501914] mb-2">Almost at reward</h3>
              <p className="text-sm text-[#501914]/70 mb-3">Customers with 9–11 stamps (sorted highest first)</p>

              <div className="space-y-2">
                {customers
                  .filter((c) => {
                    const s = Number(c.current_stamps || 0);
                    return s >= 9 && s <= 11;
                  })
                  .sort((a, b) => (b.current_stamps || 0) - (a.current_stamps || 0))
                  .slice(0, 6)
                  .map((c) => (
                    <div key={c.member_code} className="flex items-center justify-between bg-[#fff7ea] p-3 rounded-lg">
                      <div>
                        <div className="text-xs font-mono">{c.member_code}</div>
                        <div className="text-sm">{c.name}</div>
                      </div>
                      <div className="text-sm">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#fff4d8]">
                          {c.current_stamps || 0}/12
                        </span>
                      </div>
                    </div>
                  ))}

                {customers.filter((c) => (c.current_stamps || 0) >= 9 && (c.current_stamps || 0) <= 11).length === 0 && (
                  <div className="text-sm text-[#501914]/70">No members are currently between 9 and 11 stamps.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow">
              <h3 className="font-semibold text-[#501914] mb-2">Quick actions</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fetchCustomers()}
                  className="py-2 rounded-xl bg-[#501914] text-[#f5e6c8] font-semibold"
                >
                  Refresh now
                </button>
                <button
                  onClick={() => {
                    // export CSV
                    const rows = [
                      ["Member ID", "Name", "Phone", "DOB", "Stamps", "Rewards"],
                      ...customers.map((c) => [
                        c.member_code,
                        c.name,
                        c.phone,
                        c.dob || "",
                        c.current_stamps || 0,
                        c.total_rewards || 0,
                      ]),
                    ];
                    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `cakeroven_customers_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="py-2 rounded-xl bg-white border border-[#e6d6b2] font-medium"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
