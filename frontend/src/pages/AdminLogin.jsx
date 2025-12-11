// AdminLogin.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";
import { motion } from "framer-motion";

/**
 * Admin login: stores token as 'cr_adminToken' in localStorage.
 * If token already present, try to validate (hit /api/admin/customers); if valid -> redirect to dashboard.
 */

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("cr_adminToken");
    if (!token) return;
    // try quick validation
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) navigate("/admin-dashboard", { replace: true });
        else localStorage.removeItem("cr_adminToken");
      } catch {
        localStorage.removeItem("cr_adminToken");
      }
    })();
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setErr(null);
    if (!username.trim() || !password) {
      setErr("Username & password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      localStorage.setItem("cr_adminToken", data.token);
      navigate("/admin-dashboard", { replace: true });
    } catch (error) {
      setErr(error.message || "Login error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-indigo-900 px-4">
      <motion.div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl w-full max-w-md" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h2 className="text-2xl text-white font-semibold mb-2">Admin Login</h2>
        <p className="text-sm text-white/70 mb-4">Enter admin credentials to manage stamps & users.</p>

        {err && <div className="bg-red-600/10 text-red-200 p-2 rounded mb-3">{err}</div>}

        <form onSubmit={handleLogin} className="space-y-3">
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 rounded-md bg-white/90" />
          <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full p-3 rounded-md bg-white/90" />
          <div className="flex justify-between items-center">
            <button disabled={loading} className="px-4 py-2 bg-amber-400 rounded text-black font-semibold">
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <button type="button" onClick={() => { localStorage.removeItem("cr_adminToken"); setUsername(""); setPassword(""); }} className="text-sm text-white/70">Clear</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
