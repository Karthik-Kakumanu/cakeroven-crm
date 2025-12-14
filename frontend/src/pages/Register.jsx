import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4 relative overflow-hidden">

      {/* 🍰 Falling Logo Animation (Rain Effect) */}
      <AnimatePresence>
        {[...Array(6)].map((_, i) => (
          <motion.img
            key={i}
            src="/cakeroven-logo.png"
            alt="CakeRoven Rain"
            className="w-10 h-10 absolute opacity-20 pointer-events-none"
            initial={{
              y: -120,
              x: `${Math.random() * 100}vw`,
              opacity: 0,
              scale: 0.6,
            }}
            animate={{
              y: "110vh",
              opacity: [0, 0.35, 0],
              scale: [0.6, 1, 0.8],
            }}
            transition={{
              duration: 6 + Math.random() * 3,
              repeat: Infinity,
              delay: i * 1.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </AnimatePresence>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[#501914] text-[#f5e6c8] rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.65)] p-6 sm:p-8 relative overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-14 -right-14 w-40 h-40 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        {/* Header */}
        <div className="relative z-10 flex items-center gap-3 mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-12 h-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.45)]"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          <div>
            <h1 className="text-lg font-bold leading-tight">
              CakeRoven Loyalty
            </h1>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Earn stamps. Enjoy sweet rewards.
            </p>
          </div>
        </div>

        <h2 className="relative z-10 text-xl font-semibold mb-1">
          New User Registration
        </h2>
        <p className="relative z-10 text-xs text-[#f5e6c8]/80 mb-5">
          Create your digital stamp card in seconds.
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="relative z-10 space-y-4 text-sm"
        >
          <InputField
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Eg: Ananya Sharma"
          />

          <InputField
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="10-digit mobile number"
            maxLength={10}
          />

          <InputField
            label="Date of Birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="mt-2 w-full h-11 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold text-sm shadow-[0_10px_25px_rgba(0,0,0,0.6)] disabled:opacity-70"
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

/* 🔹 Reusable Input Component */
function InputField({
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
      transition={{ duration: 0.4 }}
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
        className="h-11 rounded-2xl px-3 outline-none bg-[#f5e6c8] text-[#501914] border border-transparent focus:border-[#f5e6c8] text-sm"
      />
    </motion.div>
  );
}
