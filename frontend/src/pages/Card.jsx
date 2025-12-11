// Card.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { API_BASE } from "../apiConfig";
import { motion } from "framer-motion";

export default function Card() {
  const { memberCode: paramMember } = useParams();
  const navigate = useNavigate();

  const memberFromStorage = localStorage.getItem("cr_memberCode");
  const memberCode = paramMember || memberFromStorage;
  const phone = localStorage.getItem("cr_phone") || "";

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!memberCode) {
      navigate("/register", { replace: true });
      return;
    }
    async function loadCard() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(memberCode)}`, {
          headers: {
            "x-customer-phone": phone || "",
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load card");
        setCard(data.card || data.card); // support both shapes
      } catch (e) {
        setErr(e.message || "Error");
      } finally {
        setLoading(false);
      }
    }
    loadCard();
  }, [memberCode, navigate, phone]);

  function renderStampBox(i) {
    const checked = Number(card?.currentStamps || 0) >= i;
    return (
      <div key={i} className="flex flex-col items-center">
        <div className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center ${checked ? "bg-amber-400 border-amber-500" : "bg-white border-slate-200"}`}>
          {checked ? <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : <span className="text-sm text-slate-400">{i}</span>}
        </div>
        <span className="text-xs text-slate-500 mt-1">#{i}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Loyalty Card</h1>
            <p className="text-sm text-slate-500">Member: <span className="font-medium">{memberCode}</span></p>
          </div>
          <div className="space-x-2">
            <Link to="/existing" className="text-sm text-slate-600 hover:underline">Switch user</Link>
            <button onClick={() => { localStorage.removeItem("cr_memberCode"); localStorage.removeItem("cr_phone"); navigate("/register", { replace: true }); }} className="text-sm text-red-600">Sign out</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Loading card…</div>
          ) : err ? (
            <div className="py-8 text-center text-red-600">{err}</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-lg font-semibold">{card.name}</div>
                  <div className="text-sm text-slate-500">{card.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Rewards</div>
                  <div className="text-xl font-bold">{card.totalRewards}</div>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-6 gap-4 mb-4">
                  {Array.from({ length: 12 }).map((_, i) => renderStampBox(i + 1))}
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  <div><strong>Current stamps:</strong> {card.currentStamps}</div>
                  <div className="mt-2"><strong>Stamp history (latest stamps shown)</strong></div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {card.stampHistory && card.stampHistory.length ? card.stampHistory.map((s, idx) => (
                      <div key={idx} className="px-3 py-1 bg-slate-100 rounded text-xs">{s ? new Date(s).toLocaleString() : "-"}</div>
                    )) : <div className="text-xs text-slate-400">No stamp history</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
