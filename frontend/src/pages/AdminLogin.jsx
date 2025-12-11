import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [role] = useState("owner"); // single role for now
  const [username, setUsername] = useState("cakeroven-owner");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      localStorage.setItem("cr_adminToken", data.token);
      localStorage.setItem("cr_adminUsername", data.username);
      localStorage.setItem("cr_adminRole", data.role);

      navigate("/admin-dashboard");
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-[2.5rem] bg-[#501914] px-7 py-8 text-[#f5e6c8] shadow-[0_45px_90px_rgba(0,0,0,0.7)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5e6c8] shadow-[0_0_18px_rgba(0,0,0,0.35)]">
            <div className="h-10 w-10 overflow-hidden rounded-full">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              CakeRoven Admin
            </h1>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Owner control panel • Desktop access
            </p>
          </div>
        </div>

        <h2 className="mb-4 text-xl font-semibold">Sign in to admin console</h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* role */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#f5e6c8]/70">
              Role
            </label>
            <select
              value={role}
              disabled
              className="w-full cursor-not-allowed rounded-2xl border border-[#f5e6c8]/30 bg-[#f5e6c8] px-4 py-3 text-sm text-[#501914] outline-none"
            >
              <option value="owner">Owner</option>
            </select>
          </div>

          {/* username */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#f5e6c8]/70">
              Username
            </label>
            <input
              type="text"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border border-[#f5e6c8]/30 bg-[#f5e6c8] px-4 py-3 text-sm text-[#501914] outline-none transition focus:border-[#f5e6c8] focus:ring-2 focus:ring-[#f5e6c8]/60"
            />
          </div>

          {/* password */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#f5e6c8]/70">
              Password
            </label>
            <div className="flex items-center rounded-2xl border border-[#f5e6c8]/30 bg-[#f5e6c8] pr-2 text-[#501914] focus-within:ring-2 focus-within:ring-[#f5e6c8]/60">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm outline-none"
                placeholder="Owner password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="text-xs font-semibold text-[#501914]/80"
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/15 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-[#f5e6c8] px-4 py-3 text-sm font-semibold text-[#501914] shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {loading ? "Logging in…" : "Login as Owner"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
