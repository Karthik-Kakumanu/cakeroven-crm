// src/pages/AdminDashboard.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";
import { motion } from "framer-motion";

/**
 * Admin dashboard:
 * - checks token; if invalid -> redirect to admin-login
 * - allows loading a member card by memberCode
 * - shows 12 boxes; clicking toggles stamps by calling admin add/remove endpoints
 * - UI updates based on server state; optimistic updates kept minimal to avoid desync
 */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("cr_adminToken") || "");
  const [authorized, setAuthorized] = useState(false);
  const [memberCode, setMemberCode] = useState("");
  const [card, setCard] = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!token) return navigate("/admin-login", { replace: true });
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Not authorized");
        setAuthorized(true);
      } catch (err) {
        console.error("Admin validation failed:", err);
        localStorage.removeItem("cr_adminToken");
        setToken("");
        navigate("/admin-login", { replace: true });
      }
    })();
  }, [token, navigate]);

  const loadCard = useCallback(async (code) => {
    if (!code) return setMessage("Enter a member code first");
    setLoadingCard(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }, // admin token accepted by server for card view
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load card");
      setCard(data.card);
      setMessage(`Loaded ${data.card.name} (${code})`);
    } catch (err) {
      console.error("Load card error:", err);
      setCard(null);
      setMessage(err.message || "Error loading member");
    } finally {
      setLoadingCard(false);
    }
  }, [token]);

  useEffect(() => {
    if (memberCode && !card) {
      // optionally auto fetch on typing finished - left manual 'Load' button
    }
  }, [memberCode, card]);

  async function apiAddStamp(code) {
    const res = await fetch(`${API_BASE}/api/admin/add-stamp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberCode: code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Add stamp failed");
    return data;
  }

  async function apiRemoveStamp(code) {
    const res = await fetch(`${API_BASE}/api/admin/remove-stamp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberCode: code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Remove stamp failed");
    return data;
  }

  /**
   * Click semantics:
   * - If clicked index <= currentStamps => will undo stamps until index is unchecked
   * - Else will add stamps until index becomes checked
   * Implementation: loop with sequential API calls until condition met. This preserves server-side patterns.
   */
  async function handleBoxClick(index) {
    if (!card) return setMessage("Load a member first");
    if (!memberCode) return setMessage("Enter memberCode and press Load");

    setActionLoading(true);
    setMessage(null);

    try {
      // reload card server-side in case stale
      const refresh = async () => {
        const r = await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(memberCode)}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json();
        if (r.ok) {
          setCard(data.card);
          return data.card;
        } else {
          throw new Error(data.message || "Refresh failed");
        }
      };

      let current = Number(card.currentStamps || 0);

      if (index <= current) {
        // undo until index-1
        const target = index - 1;
        while (current > target) {
          await apiRemoveStamp(memberCode);
          const refreshed = await refresh();
          current = Number(refreshed.currentStamps || 0);
        }
        setMessage(`Undid to ${current}`);
      } else {
        // add until index
        const target = index;
        while (current < target) {
          await apiAddStamp(memberCode);
          const refreshed = await refresh();
          current = Number(refreshed.currentStamps || 0);
        }
        setMessage(`Added stamps up to ${current}`);
      }
    } catch (err) {
      console.error("Box action error:", err);
      setMessage(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  function renderBox(i) {
    const checked = Number(card?.currentStamps || 0) >= i;
    return (
      <button
        key={i}
        onClick={() => handleBoxClick(i)}
        disabled={actionLoading}
        className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 transition-transform ${checked ? "bg-amber-400 border-amber-500" : "bg-white border-slate-200"} hover:scale-105`}
        title={checked ? `Stamped (#${i}) — click to undo` : `Not stamped (#${i}) — click to stamp`}
      >
        {checked ? (
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <span className="text-slate-500 font-medium">{i}</span>
        )}
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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2 items-center">
            <button onClick={handleLogout} className="px-3 py-1 rounded bg-red-500 text-white">Logout</button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <input value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="Member code e.g. CR0001" className="p-3 rounded-md border flex-1" />
            <button disabled={!memberCode || loadingCard} onClick={() => loadCard(memberCode)} className="px-4 py-2 bg-indigo-600 text-white rounded-md">
              {loadingCard ? "Loading..." : "Load"}
            </button>
            <button onClick={() => { setMemberCode(""); setCard(null); setMessage(null); }} className="px-3 py-2 border rounded-md">Clear</button>
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
                    <div className="text-sm text-slate-500">Current</div>
                    <div className="text-2xl font-bold">{card.currentStamps}</div>
                    <div className="text-sm text-slate-500">Rewards: {card.totalRewards}</div>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-3 mb-4">
                  {Array.from({ length: 12 }).map((_, i) => renderBox(i + 1))}
                </div>

                <div className="text-sm text-slate-600">
                  <div><strong>Last stamps:</strong></div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {card.stampHistory && card.stampHistory.length ? card.stampHistory.slice(-8).map((s, idx) => (
                      <div key={idx} className="px-2 py-1 bg-slate-100 rounded text-xs">{s ? new Date(s).toLocaleString() : "-"}</div>
                    )) : <div className="text-xs text-slate-400">No history</div>}
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
