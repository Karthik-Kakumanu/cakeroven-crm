// AdminDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";
import { motion } from "framer-motion";

/**
 * Admin Dashboard:
 * - protected: verifies token on mount (requests /api/admin/customers)
 * - load member by memberCode -> shows card + 12 clickable boxes
 * - clicking an unchecked box -> calls /api/admin/add-stamp repeatedly until that box is filled
 * - clicking a checked box -> calls /api/admin/remove-stamp repeatedly until that box becomes unchecked
 * - shows logs/messages
 */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("cr_adminToken") || "");
  const [authorized, setAuthorized] = useState(false);
  const [memberCode, setMemberCode] = useState("");
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/admin-login", { replace: true });
      return;
    }
    // verify token by hitting customers endpoint
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Not authorized");
        setAuthorized(true);
      } catch (err) {
        localStorage.removeItem("cr_adminToken");
        setToken("");
        navigate("/admin-login", { replace: true });
      }
    })();
  }, [token, navigate]);

  // load card details by memberCode
  const loadCard = useCallback(async (code) => {
    if (!code) return;
    setLoading(true);
    setMessage(null);
    try {
      // We will use admin endpoint to fetch customers and match by memberCode
      // But the backend provides /api/admin/customers returning all customers
      // For quickness, try customer endpoint for card (public) with header bypass using no phone, so we use admin token to authorize
      const res = await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load card");
      setCard(data.card);
      setMessage(`Loaded ${data.card.name} (${code})`);
    } catch (err) {
      setCard(null);
      setMessage(err.message || "Error loading member");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // helper to call add-stamp once
  async function addStampOnce(code) {
    const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberCode: code }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message || "add failed");
    }
    return await res.json();
  }

  // helper to call remove-stamp once
  async function removeStampOnce(code) {
    const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberCode: code }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message || "remove failed");
    }
    return await res.json();
  }

  // toggle behavior: aim at clickedIndex (1..12)
  async function onBoxClick(index) {
    if (!card) return;
    if (!memberCode) return setMessage("Enter member code and load first");
    setActionInProgress(true);
    setMessage(null);
    try {
      let current = Number(card.currentStamps || 0);

      if (index <= current) {
        // clicked a checked box -> remove stamps until index becomes unchecked (i.e., current < index)
        const target = index - 1;
        while (current > target) {
          await removeStampOnce(memberCode);
          current -= 1;
          // refresh UI localy (optimistic)
          setCard((c) => ({ ...c, currentStamps: current }));
        }
        setMessage(`Undid stamp(s) to ${current}`);
      } else {
        // clicked an unchecked box -> add stamps until index is checked
        const target = index;
        while (current < target) {
          await addStampOnce(memberCode);
          // backend may roll over at 12 -> reset to 0; handle accordingly by reloading card after each call
          current += 1;
          // If current reached 12 then backend resets to 0 and increments reward. We must reload from server to get accurate state.
          // Quick attempt: reload card from server after each call to avoid drift
          await loadCard(memberCode);
          current = Number((await (await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(memberCode)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })).then(r => r.json()).then(d => d.card?.currentStamps || 0)).catch(() => current));
        }
        setMessage(`Added stamp(s) up to ${target}`);
      }
      // final refresh
      await loadCard(memberCode);
    } catch (err) {
      setMessage(err.message || "Action failed");
    } finally {
      setActionInProgress(false);
    }
  }

  function renderBox(i) {
    const checked = Number(card?.currentStamps || 0) >= i;
    return (
      <button
        key={i}
        disabled={actionInProgress}
        onClick={() => onBoxClick(i)}
        className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center ${checked ? "bg-amber-400 border-amber-500" : "bg-white border-slate-200"} hover:scale-105 transition-transform`}
      >
        {checked ? <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : <span className="text-slate-500 font-medium">{i}</span>}
      </button>
    );
  }

  function handleLogout() {
    localStorage.removeItem("cr_adminToken");
    setToken("");
    navigate("/admin-login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2 items-center">
            <button onClick={handleLogout} className="px-3 py-1 rounded bg-red-500 text-white">Logout</button>
          </div>
        </div>

        <motion.div className="bg-white rounded-2xl p-6 shadow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex gap-4 items-center mb-4">
            <input placeholder="Member code (e.g., CR0001)" value={memberCode} onChange={(e) => setMemberCode(e.target.value.trim())} className="p-3 border rounded-md flex-1" />
            <button disabled={!memberCode || loading} onClick={() => loadCard(memberCode)} className="px-4 py-2 bg-indigo-600 text-white rounded-md">
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          <div className="mb-3 text-sm text-slate-600">{message}</div>

          <div className="border rounded-lg p-4">
            {!card ? (
              <div className="text-slate-500">No member loaded</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-semibold">{card.name}</div>
                    <div className="text-sm text-slate-500">{card.phone} • {card.memberCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Current stamps</div>
                    <div className="text-2xl font-bold">{card.currentStamps}</div>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-3 mb-4">
                  {Array.from({ length: 12 }).map((_, i) => renderBox(i + 1))}
                </div>

                <div className="text-sm text-slate-600">
                  <div><strong>Total rewards:</strong> {card.totalRewards}</div>
                  <div className="mt-2"><strong>Last stamps:</strong></div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {card.stampHistory && card.stampHistory.length ? card.stampHistory.slice(-6).map((s, idx) => <div key={idx} className="px-2 py-1 bg-slate-100 rounded text-xs">{s ? new Date(s).toLocaleString() : "-"}</div>) : <div className="text-xs text-slate-400">no history</div>}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
