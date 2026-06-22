import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";

export default function Register() {
  const navigate = useNavigate();
  const logoRain = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        x: `${10 + i * 19}vw`,
        delay: i * 0.65,
      })),
    []
  );

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-[28px] bg-[#501914] p-6 sm:p-8 text-[#f5e6c8] shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
      >
        <div className="absolute -top-14 -right-14 h-36 w-36 rounded-full bg-[#f5e6c8]/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#f5e6c8]/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-[#f5e6c8] flex items-center justify-center shadow-[0_0_22px_rgba(0,0,0,0.3)]">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-white">
              <img src="/cakeroven-logo.png" alt="CakeRoven" className="h-full w-full object-cover" loading="eager" decoding="async" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">CakeRoven Loyalty</h1>
            <p className="text-[11px] text-[#f5e6c8]/80">Earn stamps. Unlock sweet rewards.</p>
          </div>
        </div>

        <h2 className="relative z-10 text-xl font-semibold mb-1">New User Registration</h2>
        <p className="relative z-10 text-xs text-[#f5e6c8]/80 mb-5">Create your digital stamp card in seconds.</p>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-4 text-sm">
          <Field label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Eg: Ananya Sharma" />
          <Field label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile number" maxLength={10} />
          <Field label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="mt-2 w-full h-11 rounded-2xl bg-[#f5e6c8] text-[#501914] font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.4)] disabled:opacity-70"
          >
            {loading ? "Creating your card..." : "Create My CakeRoven Card"}
          </motion.button>
        </form>

        <p className="relative z-10 mt-4 text-[11px] text-center text-[#f5e6c8]/85">
          Already a member?{" "}
          <Link to="/existing" className="underline font-semibold hover:text-[#ffd8b5]">
            Existing user
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, maxLength }) {
  return (
    <div className="flex flex-col gap-1">
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
    </div>
  );
}
