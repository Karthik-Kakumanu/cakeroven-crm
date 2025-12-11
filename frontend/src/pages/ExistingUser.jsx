// ExistingUser.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE } from "../apiConfig";
import { motion } from "framer-motion";

export default function ExistingUser() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setErr(null);
    if (!phone.trim()) {
      setErr("Phone required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/login-by-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      localStorage.setItem("cr_memberCode", data.memberCode);
      localStorage.setItem("cr_phone", phone.trim());
      navigate(`/card/${encodeURIComponent(data.memberCode)}`, { replace: true });
    } catch (error) {
      setErr(error.message || "Error logging in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4">
      <motion.div className="max-w-md w-full bg-white p-6 rounded-2xl shadow" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h2 className="text-xl font-semibold mb-2">Welcome back</h2>
        <p className="text-sm text-slate-500 mb-4">Enter your registered phone to open your card</p>

        {err && <div className="bg-red-50 text-red-700 p-2 rounded mb-3">{err}</div>}

        <form onSubmit={handleLogin} className="space-y-3">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" className="w-full p-3 border rounded-md" />
          <div className="flex items-center justify-between">
            <button className="px-4 py-2 bg-emerald-600 text-white rounded-md shadow" disabled={loading}>
              {loading ? "Checking..." : "Open Card"}
            </button>
            <Link to="/register" className="text-sm text-slate-600 hover:underline">Create new card</Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
