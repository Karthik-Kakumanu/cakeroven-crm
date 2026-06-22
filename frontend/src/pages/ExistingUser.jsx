import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";

export default function ExistingUser() {
  const navigate = useNavigate();
  const logoRain = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        x: `${12 + i * 18}vw`,
        delay: i * 0.7,
      })),
    []
  );
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(phone.trim())) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/customer/login-by-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        setLoading(false);
        return;
      }

      const card = data.card || {};
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
    <div className="relative min-h-screen bg-[#f5e6c8] overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      <div className="pointer-events-none absolute inset-0">
        {logoRain.map((item) => (
          <motion.img
            key={item.id}
            src="/cakeroven-logo.png"
            alt=""
            className="absolute w-12 h-12"
            initial={{ y: -90, x: item.x, opacity: 0, rotate: -10 }}
            animate={{ y: "110vh", opacity: [0, 0.75, 0], rotate: [-10, 5, 10] }}
            transition={{ duration: 8, delay: item.delay, repeat: Infinity, ease: "linear" }}
            style={{ filter: "contrast(1.15) brightness(0.95)" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative z-10 w-full max-w-md bg-[#501914] text-[#f5e6c8] rounded-[28px] p-6 sm:p-8 shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-lg">
            <img src="/cakeroven-logo.png" alt="CakeRoven" className="w-9 h-9 rounded-full" loading="eager" decoding="async" />
          </div>
          <div>
            <h1 className="font-bold text-lg">CakeRoven Loyalty</h1>
            <p className="text-xs text-[#f5e6c8]/80">Access your digital stamp card</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1">Existing User Login</h2>
        <p className="text-xs text-[#f5e6c8]/80 mb-5">Enter your registered mobile number</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold">Registered Phone</label>
            <input
              type="tel"
              maxLength={10}
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile number"
              className="w-full h-11 mt-1 rounded-2xl bg-[#f5e6c8] text-[#501914] px-3 outline-none"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full h-11 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold shadow-lg disabled:opacity-70"
          >
            {loading ? "Finding your card..." : "Open My CakeRoven Card"}
          </motion.button>
        </form>

        <p className="mt-4 text-xs text-center text-[#f5e6c8]/85">
          New here?{" "}
          <Link to="/register" className="underline font-semibold">
            Create a new card
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
