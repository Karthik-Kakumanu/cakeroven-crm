import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE } from "../apiConfig";


export default function AdminLogin() {
  const navigate = useNavigate();
  const [role, setRole] = useState("owner"); // only one role now
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // backend ignores role, but we still keep it on UI
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("cr_adminToken", data.token);
      localStorage.setItem("cr_adminUsername", data.username || username);

      navigate("/admin-dashboard");
    } catch (err) {
      console.error(err);
      alert("Server error");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center px-6">
      <div className="w-full max-w-xl bg-[#501914] rounded-[32px] shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-10 text-[#f5e6c8]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.45)]">
            <div className="w-14 h-14 rounded-full overflow-hidden">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-wide">
              CakeRoven Admin
            </h1>
            <p className="text-xs text-[#f5e6c8]/80 mt-1">
              Owner control panel • Desktop access
            </p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">Sign in to admin console</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold tracking-wide">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-12 rounded-2xl px-4 text-base font-semibold bg-[#f5e6c8] text-[#501914] border border-[#f5e6c8]/40 outline-none"
            >
              {/* In future you can add more roles here */}
              <option value="owner">Owner</option>
            </select>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold tracking-wide">
              Username
            </label>
            <input
              type="text"
              className="h-12 rounded-2xl px-4 text-base font-semibold bg-[#f5e6c8] text-[#501914] border border-[#f5e6c8]/40 outline-none"
              placeholder="cakeroven-owner"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Password + show/hide */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="h-12 w-full rounded-2xl px-4 pr-16 text-base font-semibold bg-[#f5e6c8] text-[#501914] border border-[#f5e6c8]/40 outline-none"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[#501914]/80"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full h-12 rounded-2xl bg-[#f5e6c8] text-[#501914] text-base font-bold tracking-wide shadow-[0_10px_25px_rgba(0,0,0,0.5)] active:scale-[0.98] transition"
          >
            {loading ? "Logging in..." : "Login as Owner"}
          </button>
        </form>
      </div>
    </div>
  );
}
