import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("cr_adminToken");
  const adminName = localStorage.getItem("cr_adminUsername") || "Owner";

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const prevCountRef = useRef(0);
  const audioRef = useRef(null);

  // simple notification sound
  useEffect(() => {
    audioRef.current = new Audio("/notify.mp3"); // put a small mp3 in public/
  }, []);

  // redirect to login if no token
  useEffect(() => {
    if (!token) navigate("/admin");
  }, [token, navigate]);

  const fetchCustomers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        // session expired
        localStorage.removeItem("cr_adminToken");
        localStorage.removeItem("cr_adminUsername");
        navigate("/admin");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to load customers", data);
        return;
      }
      // Notification logic: new user or someone reached 12
      if (prevCountRef.current && data.customers.length > prevCountRef.current) {
        audioRef.current?.play().catch(()=>{});
      }
      // check for any user who has current_stamps===12 and wasn't 12 before
      const prevMap = new Map(customers.map(c => [c.member_code, c.current_stamps]));
      for (const c of data.customers) {
        if (Number(c.current_stamps) === 12 && prevMap.get(c.member_code) !== 12) {
          // play celebrate
          audioRef.current?.play().catch(()=>{});
          break;
        }
      }

      prevCountRef.current = data.customers.length;
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Server error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    const t = setInterval(fetchCustomers, 8000); // auto-refresh every 8s
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [token]);

  // search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (String(c.phone) || "").toLowerCase().includes(q) ||
      (c.member_code || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const handleLogout = () => {
    localStorage.removeItem("cr_adminToken");
    localStorage.removeItem("cr_adminUsername");
    navigate("/admin");
  };

  const handleAddStamp = async (memberCode) => {
    try {
      await fetch(`${API_BASE}/api/admin/add-stamp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberCode }),
      });
      // optimistic: refresh list
      fetchCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveStamp = async (memberCode) => {
    try {
      await fetch(`${API_BASE}/api/admin/remove-stamp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberCode }),
      });
      fetchCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5e6c8] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-sm text-[#501914]/70">CakeRoven Admin</div>
            <div className="text-lg font-semibold text-[#501914]">Welcome, {adminName}</div>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-[#501914] text-[#f5e6c8] rounded-full">Logout</button>
        </div>

        <div className="bg-[#501914] rounded-2xl p-6 text-[#f5e6c8] mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-[#f5e6c8] text-[#501914] p-4 rounded-xl">Total members<br/><strong>{customers.length}</strong></div>
            <div className="bg-[#f5e6c8] text-[#501914] p-4 rounded-xl">Stamps given<br/><strong>{customers.reduce((s,c)=>s+Number(c.current_stamps||0),0)}</strong></div>
            <div className="bg-[#f5e6c8] text-[#501914] p-4 rounded-xl">Rewards<br/><strong>{customers.reduce((s,c)=>s+Number(c.total_rewards||0),0)}</strong></div>
          </div>

          <input
            placeholder="Search: name / phone / CR ID"
            className="w-full p-3 rounded-xl text-[#501914]"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white/95 rounded-2xl shadow p-4">
              {loading ? (
                <div className="p-8 text-center text-[#501914]">Loading customers…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-[#501914]/70">No customers found.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-xs text-[#501914]/80">
                    <tr>
                      <th className="py-3 px-3">S.No</th>
                      <th className="py-3 px-3">Member ID</th>
                      <th className="py-3 px-3">Name</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Stamps</th>
                      <th className="py-3 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => (
                      <tr key={c.member_code} className="border-t">
                        <td className="py-3 px-3">{idx+1}</td>
                        <td className="py-3 px-3 font-mono">{c.member_code}</td>
                        <td className="py-3 px-3">{c.name}</td>
                        <td className="py-3 px-3">{c.phone}</td>
                        <td className="py-3 px-3">
                          <div className="inline-flex items-center gap-3">
                            <div className="px-2 py-0.5 rounded-full bg-[#fff4d8]">{c.current_stamps}/12</div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-2">
                            <button onClick={()=>handleRemoveStamp(c.member_code)} className="px-3 py-1 rounded-full border">Undo</button>
                            <button onClick={()=>handleAddStamp(c.member_code)} className="px-3 py-1 rounded-full bg-[#501914] text-white">+1</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-white/95 p-4 rounded-2xl shadow">
              <h4 className="font-semibold text-[#501914]">Almost at reward</h4>
              <p className="text-xs text-[#501914]/70 mb-2">Customers with 9–11 stamps</p>
              <ul className="space-y-2">
                {customers.filter(c => c.current_stamps >= 9 && c.current_stamps < 12)
                  .sort((a,b)=>b.current_stamps - a.current_stamps)
                  .slice(0,6)
                  .map(c => (
                    <li key={c.member_code} className="flex justify-between items-center">
                      <div>
                        <div className="font-mono text-sm">{c.member_code}</div>
                        <div className="text-xs text-[#501914]/70">{c.name}</div>
                      </div>
                      <div className="text-sm">
                        <span className="px-2 py-1 rounded-full bg-[#fff4d8]">{c.current_stamps}/12</span>
                      </div>
                    </li>
                  ))
                }
                {customers.filter(c => c.current_stamps >= 9 && c.current_stamps < 12).length === 0 && (
                  <div className="text-xs text-[#501914]/70">No members are currently between 9 and 11 stamps.</div>
                )}
              </ul>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl shadow">
              <h4 className="font-semibold text-[#501914]">Quick actions</h4>
              <div className="mt-3 flex flex-col gap-2">
                <button onClick={fetchCustomers} className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8]">Refresh now</button>
                <button className="px-4 py-2 rounded-full border">Export CSV</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
