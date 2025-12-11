// AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [role, setRole] = useState("owner");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // If already logged in, go to dashboard
  if (typeof window !== "undefined" && localStorage.getItem("cr_adminToken")) {
    // avoid rendering login if token exists — redirect immediately
    navigate("/admin-dashboard", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Login failed. Please check credentials.");
        setBusy(false);
        return;
      }

      // store token & username
      localStorage.setItem("cr_adminToken", data.token);
      localStorage.setItem("cr_adminUsername", data.username || username);

      // go to dashboard
      navigate("/admin-dashboard", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      setError("Server error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5e6c8] p-6">
      <div className="w-full max-w-md bg-[#501914] rounded-3xl p-8 shadow-xl text-[#f5e6c8]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <img src="/cakeroven-logo.png" alt="logo" className="w-10 h-10 object-cover rounded-full" />
          </div>
          <div>
            <p className="text-sm text-[#f5e6c8]/80">CakeRoven Admin</p>
            <h1 className="text-lg font-semibold">Sign in to admin console</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#f5e6c8]/80 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-[#f5e6c8] text-[#501914] outline-none"
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#f5e6c8]/80 mb-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-[#f5e6c8] text-[#501914] outline-none"
              placeholder="admin username"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs text-[#f5e6c8]/80 mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full px-4 py-2 rounded-xl bg-[#f5e6c8] text-[#501914] outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-200 bg-red-900/30 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-xl font-semibold text-[#501914] bg-[#f5e6c8] shadow-md ${
              busy ? "opacity-60" : "hover:scale-[1.01]"
            } transition`}
          >
            {busy ? "Signing in…" : `Login as ${role[0].toUpperCase() + role.slice(1)}`}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#f5e6c8]/70">
          Only authorized admins may log in. Keep credentials secure.
        </p>
      </div>
    </div>
  );
}
