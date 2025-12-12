// frontend/src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(phone.trim())) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          phone: phone.trim(),
          dob: dob || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      const card = data.card || {};
      // Save secure session (no member in URL)
      localStorage.setItem("cr_memberCode", card.memberCode);
      localStorage.setItem("cr_phone", card.phone);

      navigate("/card");
    } catch (err) {
      console.error(err);
      alert("Server error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#501914] text-[#f5e6c8] rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-6 sm:p-8 relative overflow-hidden">
        {/* soft glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        {/* header */}
        <div className="relative z-10 flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.4)]">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              CakeRoven Loyalty
            </h1>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Earn 12 stamps, unlock sweet rewards.
            </p>
          </div>
        </div>

        <h2 className="relative z-10 text-xl font-semibold mb-1">
          New User Registration
        </h2>
        <p className="relative z-10 text-xs text-[#f5e6c8]/80 mb-5">
          All fields are mandatory to generate your digital stamp card.
        </p>

        {/* form */}
        <form
          onSubmit={handleSubmit}
          className="relative z-10 space-y-4 text-sm"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Eg: Ananya Sharma"
              className="h-11 rounded-2xl px-3 outline-none bg-[#f5e6c8] text-[#501914] border border-transparent focus:border-[#f5e6c8] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">Phone Number</label>
            <input
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile number"
              className="h-11 rounded-2xl px-3 outline-none bg-[#f5e6c8] text-[#501914] border border-transparent focus:border-[#f5e6c8] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">Date of Birth</label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="h-11 rounded-2xl px-3 outline-none bg-[#f5e6c8] text-[#501914] border border-transparent focus:border-[#f5e6c8] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full h-11 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold text-sm shadow-[0_10px_25px_rgba(0,0,0,0.6)] active:scale-[0.98] transition-transform disabled:opacity-70"
          >
            {loading ? "Creating your card..." : "Create My CakeRoven Card"}
          </button>
        </form>

        <p className="relative z-10 mt-4 text-[11px] text-center text-[#f5e6c8]/85">
          Already a CakeRoven member?{" "}
          <Link
            to="/existing-user"
            className="underline font-semibold hover:text-[#ffd8b5]"
          >
            Existing user?
          </Link>
        </p>
      </div>
    </div>
  );
}
