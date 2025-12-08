import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";

export default function ExistingUser() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter the 10-digit phone number you registered with.");
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
        setError(data.message || "This phone number is not registered.");
        setLoading(false);
        return;
      }

      localStorage.setItem("cr_memberCode", data.memberCode);
      localStorage.setItem("cr_phone", data.phone);

      navigate(`/card?member=${data.memberCode}`);
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-[2.25rem] bg-[#501914] px-7 py-8 text-[#f5e6c8] shadow-[0_40px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5e6c8] shadow-[0_0_18px_rgba(0,0,0,0.35)]">
            <div className="h-10 w-10 overflow-hidden rounded-full">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              Existing CakeRoven User
            </h1>
            <p className="text-[11px] text-[#f5e6c8]/80">
              Fetch your digital stamp card with your registered phone number.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#f5e6c8]/70">
              Phone Number
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Registered mobile number"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))
              }
              required
              className="w-full rounded-2xl border border-[#f5e6c8]/30 bg-[#f5e6c8] px-4 py-3 text-sm text-[#501914] outline-none transition focus:border-[#f5e6c8] focus:ring-2 focus:ring-[#f5e6c8]/60"
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/15 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-[#f5e6c8] px-4 py-3 text-sm font-semibold text-[#501914] shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {loading ? "Fetching your card…" : "Fetch my card"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#f5e6c8]/80">
          New to CakeRoven?{" "}
          <Link
            to="/register"
            className="font-semibold underline decoration-[#f5e6c8]/60 underline-offset-2"
          >
            Register here
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
