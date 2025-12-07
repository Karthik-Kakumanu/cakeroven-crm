import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";


export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanedName = name.trim();
    const cleanedPhone = phone.trim();

    if (!cleanedName || !cleanedPhone || !dob) {
      alert("All fields are required.");
      setLoading(false);
      return;
    }

    if (cleanedPhone.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanedName,
          phone: cleanedPhone,
          dob,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        alert(
          data.message ||
            "You are already a CakeRoven member. Please use Existing User."
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        alert(data.message || "Registration failed.");
        setLoading(false);
        return;
      }

      const memberCode = data.card.memberCode;
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
            <h1 className="text-lg font-bold leading-tight">
              CakeRoven Loyalty
            </h1>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Earn 12 stamps, unlock sweet rewards.
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-2">New User Registration</h2>
        <p className="text-sm text-[#f5e6c8]/80 mb-5">
          All fields are mandatory to generate your digital stamp card.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col">
            <label className="text-sm mb-1">Full Name</label>
            <input
              type="text"
              className="p-3 rounded-2xl border border-[#f5e6c8]/40 outline-none bg-[#f5e6c8] text-[#501914] focus:border-[#f5e6c8] transition text-sm"
              placeholder="Eg: Ananya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm mb-1">Phone Number</label>
            <input
              type="tel"
              className="p-3 rounded-2xl border border-[#f5e6c8]/40 outline-none bg-[#f5e6c8] text-[#501914] focus:border-[#f5e6c8] transition text-sm"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm mb-1">Date of Birth</label>
            <input
              type="date"
              className="p-3 rounded-2xl border border-[#f5e6c8]/40 outline-none bg-[#f5e6c8] text-[#501914] focus:border-[#f5e6c8] transition text-sm"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.4)] active:scale-[0.98] transition text-sm"
          >
            {loading ? "Creating your card..." : "Create My CakeRoven Card"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-xs text-[#f5e6c8]/80">
            Already a CakeRoven member?{" "}
            <Link
              to="/existing"
              className="font-semibold text-[#f5e6c8] underline underline-offset-4"
            >
              Existing user?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
