import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";

export default function ExistingUser() {
  const navigate = useNavigate();
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

      {/* background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      {/* LOUD FALLING LOGOS */}
      <div className="pointer-events-none absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <motion.img
            key={i}
            src="/cakeroven-logo.png"
            className="absolute w-14 h-14"
            initial={{
              y: -120,
              x: `${Math.random() * 100}vw`,
              opacity: 0,
              rotate: -10,
            }}
            animate={{
              y: "110vh",
              opacity: [0, 0.95, 0.8, 0],
              rotate: [-10, 5, -5, 10],
            }}
            transition={{
              duration: 7,
              delay: i * 0.7,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ filter: "contrast(1.3) brightness(0.9)" }}
          />
        ))}
      </div>

      {/* CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md bg-[#501914] text-[#f5e6c8] rounded-[32px] p-6 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.6)]"
      >
        {/* header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-lg">
            <img src="/cakeroven-logo.png" className="w-9 h-9 rounded-full" />
          </div>
          <div>
            <h1 className="font-bold text-lg">CakeRoven Loyalty</h1>
            <p className="text-xs text-[#f5e6c8]/80">
              Access your digital stamp card
            </p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1">Existing User Login</h2>
        <p className="text-xs text-[#f5e6c8]/80 mb-5">
          Enter your registered mobile number
        </p>

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
            whileTap={{ scale: 0.97 }}
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
