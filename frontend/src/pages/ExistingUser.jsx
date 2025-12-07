import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = "http://localhost:4000";

export default function ExistingUser() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanedPhone = phone.trim();

    if (cleanedPhone.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/customer/login-by-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone }),
      });

      const data = await res.json();

      if (res.status === 404) {
        alert("This phone number is not registered. Please register first.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        alert(data.message || "Error occurred.");
        setLoading(false);
        return;
      }

      const memberCode = data.card.member_code || data.card.memberCode;
      localStorage.setItem("cr_memberCode", memberCode);
      navigate(`/card?member=${memberCode}`);
    } catch (err) {
      console.error(err);
      alert("Server error, please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#501914] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.55)] p-6 sm:p-8 text-[#f5e6c8]">
        {/* Logo header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.35)]">
            <div className="w-12 h-12 rounded-full overflow-hidden">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold leading-tight">
              Existing CakeRoven User
            </h2>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Enter your registered phone to see your card.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col">
            <label className="text-sm mb-1">Phone Number</label>
            <input
              type="tel"
              className="p-3 rounded-2xl border border-[#f5e6c8]/40 outline-none bg-[#f5e6c8] text-[#501914] focus:border-[#f5e6c8] transition text-sm"
              placeholder="Registered mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.4)] active:scale-[0.98] transition text-sm"
          >
            {loading ? "Fetching your card..." : "Show My Card"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-xs text-[#f5e6c8]/80">
            New to CakeRoven?{" "}
            <Link
              to="/register"
              className="font-semibold text-[#f5e6c8] underline underline-offset-4"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
