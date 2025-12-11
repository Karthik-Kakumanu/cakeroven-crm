// frontend/src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/*
  Fix:
  - backend returns { ok:true, memberCode, user } — frontend now reads these and stores memberCode & phone.
*/
export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const cleaned = phone.trim().replace(/\D/g, "");
    if (!/^\d{10}$/.test(cleaned)) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          phone: cleaned,
          dob: dob || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.message || "Registration failed");
        setLoading(false);
        return;
      }

      // backend returns: { ok:true, memberCode, user }
      const memberCode = data.memberCode;
      const user = data.user || {};
      const savedPhone = user.phone || cleaned;

      if (!memberCode) {
        alert("Unexpected server response. Please try again later.");
        setLoading(false);
        return;
      }

      localStorage.setItem("cr_memberCode", memberCode);
      localStorage.setItem("cr_phone", savedPhone);

      navigate("/card", { replace: true });
    } catch (err) {
      console.error("Register error:", err);
      alert("Server error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#501914] text-[#f5e6c8] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-10 w-32 h-32 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <img src="/cakeroven-logo.png" alt="CakeRoven" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold">CakeRoven Loyalty</h1>
            <p className="text-xs text-[#f5e6c8]/80">Earn 12 stamps, unlock sweet rewards.</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1">New User Registration</h2>
        <p className="text-xs text-[#f5e6c8]/80 mb-4">All fields are mandatory to generate your digital stamp card.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Eg: Ananya Sharma"
              className="w-full h-12 rounded-xl px-3 bg-[#f5e6c8] text-[#501914] outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
              placeholder="10-digit mobile number"
              className="w-full h-12 rounded-xl px-3 bg-[#f5e6c8] text-[#501914] outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full h-12 rounded-xl px-3 bg-[#f5e6c8] text-[#501914] outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#f5e6c8] text-[#501914] font-semibold shadow active:scale-[0.98] transition"
          >
            {loading ? "Creating your card..." : "Create My CakeRoven Card"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-[#f5e6c8]/85">
          Already a CakeRoven member?{" "}
          <Link to="/existing" className="underline font-semibold hover:text-[#ffd8b5]">Existing user?</Link>
        </p>
      </div>
    </div>
  );
}
