// frontend/src/pages/ExistingUser.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/*
  Fixed:
  - backend returns { ok:true, memberCode, name } (not data.card).
  - Save memberCode and phone after successful login.
  - Show nicer UI + error handling.
*/
export default function ExistingUser() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const cleaned = phone.trim().replace(/\D/g, "");
    if (!/^\d{10}$/.test(cleaned)) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/login-by-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // backend returns meaningful messages for 4xx/5xx
        alert(data?.message || "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // server returns: { ok: true, memberCode, name }
      if (!data || !data.memberCode) {
        alert("Unexpected response from server. Please try again later.");
        setLoading(false);
        return;
      }

      // Save verified session values
      localStorage.setItem("cr_memberCode", data.memberCode);
      localStorage.setItem("cr_phone", cleaned);

      // go to card (card page will use localStorage; no memberCode in URL)
      navigate("/card", { replace: true });
    } catch (err) {
      console.error("ExistingUser error:", err);
      alert("Server error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#501914] text-[#f5e6c8] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-10 w-32 h-32 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <img src="/cakeroven-logo.png" alt="CakeRoven" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold">CakeRoven Loyalty</h1>
            <p className="text-xs text-[#f5e6c8]/80">Access your digital stamp card</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1">Existing User Login</h2>
        <p className="text-xs text-[#f5e6c8]/80 mb-4">Enter the phone number used at the bakery counter.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-semibold">Registered Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            maxLength={10}
            placeholder="10-digit mobile number"
            className="w-full h-12 rounded-xl px-3 bg-[#f5e6c8] text-[#501914] outline-none focus:ring-2 focus:ring-[#f5e6c8]/60"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#f5e6c8] text-[#501914] font-semibold shadow active:scale-[0.98] transition"
          >
            {loading ? "Finding your card..." : "Open My CakeRoven Card"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-[#f5e6c8]/85">
          New to CakeRoven?{" "}
          <Link to="/register" className="underline font-semibold hover:text-[#ffd8b5]">Create a new card</Link>
        </p>
      </div>
    </div>
  );
}
