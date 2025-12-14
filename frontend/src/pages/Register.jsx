import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f5e6c8] flex items-center justify-center px-4">

      {/* background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      {/* 🍰 LOUD FALLING LOGOS */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(9)].map((_, i) => (
          <motion.img
            key={i}
            src="/cakeroven-logo.png"
            alt=""
            className="absolute w-14 h-14"
            initial={{
              y: -120,
              x: `${Math.random() * 100}vw`,
              opacity: 0,
              rotate: -10,
            }}
            animate={{
              y: "110vh",
              opacity: [0, 0.9, 0.9, 0.7, 0],
              rotate: [ -10, 5, -5, 10 ],
            }}
            transition={{
              duration: 7,
              delay: i * 0.6,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              filter: "contrast(1.25) brightness(0.9)",
            }}
          />
        ))}
      </div>

      {/* MAIN CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-[32px] bg-[#501914] p-6 sm:p-8 text-[#f5e6c8] shadow-[0_30px_70px_rgba(0,0,0,0.6)]"
      >
        {/* glow */}
        <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full bg-[#f5e6c8]/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#f5e6c8]/10 blur-3xl" />

        {/* header */}
        <div className="relative z-10 flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.4)]">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-white">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              CakeRoven Loyalty
            </h1>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Earn stamps. Unlock sweet rewards.
            </p>
          </div>
        </div>

        <h2 className="relative z-10 text-xl font-semibold mb-1">
          New User Registration
        </h2>
        <p className="relative z-10 text-xs text-[#f5e6c8]/80 mb-5">
          Create your digital stamp card in seconds.
        </p>

        {/* form */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-4 text-sm">

          <Field
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Eg: Ananya Sharma"
          />

          <Field
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="10-digit mobile number"
            maxLength={10}
          />

          <Field
            label="Date of Birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="mt-2 w-full h-11 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold shadow-[0_10px_25px_rgba(0,0,0,0.55)] disabled:opacity-70"
          >
            {loading ? "Creating your card..." : "Create My CakeRoven Card"}
          </motion.button>
        </form>

        <p className="relative z-10 mt-4 text-[11px] text-center text-[#f5e6c8]/85">
          Already a member?{" "}
          <Link
            to="/existing"
            className="underline font-semibold hover:text-[#ffd8b5]"
          >
            Existing user
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

/* reusable input */
function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  maxLength,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-1"
    >
      <label className="text-xs font-semibold">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-11 rounded-2xl px-3 outline-none bg-[#f5e6c8] text-[#501914] border border-transparent focus:border-[#f5e6c8]"
      />
    </motion.div>
  );
}
