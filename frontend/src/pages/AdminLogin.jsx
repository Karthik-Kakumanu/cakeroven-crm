import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("cakeroven-owner");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || "Login failed");
        setLoading(false);
        return;
      }
      // Save token & username
      localStorage.setItem("cr_adminToken", data.token);
      localStorage.setItem("cr_adminUsername", data.username || username);
      navigate("/admin-dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setErr("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#501914] rounded-2xl p-8 shadow-[0_25px_60px_rgba(0,0,0,0.4)] text-[#f5e6c8]"
      >
        <h2 className="text-2xl font-bold mb-4">CakeRoven Admin</h2>

        <label className="block text-xs mb-1">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-3 p-3 rounded-md text-[#501914]"
        />

        <label className="block text-xs mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-3 p-3 rounded-md text-[#501914]"
          placeholder="Owner@2025"
        />

        {err && (
          <div className="mb-3 text-sm bg-[#5a211c] p-2 rounded text-red-200">
            {err}
          </div>
        )}

        <button
          type="submit"
          className="w-full p-3 rounded-full bg-[#f5e6c8] text-[#501914] font-semibold shadow"
          disabled={loading}
        >
          {loading ? "Logging in…" : "Login as Owner"}
        </button>
      </form>
    </div>
  );
}
