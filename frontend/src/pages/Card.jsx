import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/* -------------------- IST HELPERS -------------------- */
function getIstDate(now = new Date()) {
  return new Date(now.getTime() + 330 * 60 * 1000);
}

function getHolidayInfoForIst(dateIst) {
  const month = dateIst.getUTCMonth();
  const day = dateIst.getUTCDate();

  if (month === 11 && day === 25) {
    return {
      isHoliday: true,
      key: "christmas",
      title: "🎄 Happy Christmas",
      message:
        "Sorry for the inconvenience on Christmas day. Stamp access is temporarily unavailable. We'll be back shortly — enjoy the celebration!",
    };
  }

  if ((month === 11 && day === 31) || (month === 0 && day === 1)) {
    return {
      isHoliday: true,
      key: "newyear",
      title: "🎉 Happy New Year",
      message:
        "We're celebrating the New Year! Stamp access is temporarily unavailable. Wishing you a fantastic year ahead!",
    };
  }

  return { isHoliday: false };
}

/* -------------------- COMPONENT -------------------- */
export default function Card() {
  const navigate = useNavigate();

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [holiday, setHoliday] = useState({ isHoliday: false });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => (isMountedRef.current = false);
  }, []);

  /* -------- Holiday check -------- */
  useEffect(() => {
    const checkHoliday = () => {
      const ist = getIstDate();
      setHoliday(getHolidayInfoForIst(ist));
    };
    checkHoliday();
    const id = setInterval(checkHoliday, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* -------- Fetch card -------- */
  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const controller = new AbortController();

    const fetchCard = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(
            phone
          )}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          setError("Unable to load card. Please sign in again.");
          localStorage.clear();
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (isMountedRef.current) {
          setCard(data.card || data);
          setLoading(false);
        }
      } catch {
        if (isMountedRef.current) {
          setError("Server error while loading your card.");
          setLoading(false);
        }
      }
    };

    fetchCard();
    return () => controller.abort();
  }, [navigate]);

  const stamps = Number(card?.currentStamps ?? card?.current_stamps ?? 0);
  const rewards = Number(card?.totalRewards ?? card?.total_rewards ?? 0);
  const isRewardReady = stamps >= 12;

  useEffect(() => {
    if (isRewardReady) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
  }, [isRewardReady]);

  const memberCode = card?.memberCode || card?.member_code || "—";
  const maskedPhone =
    card?.phone && card.phone.length >= 3
      ? "••••••" + card.phone.slice(-3)
      : "••••••••••";

  const handleSwitchUser = () => {
    localStorage.clear();
    navigate("/start", { replace: true });
  };

  /* -------------------- HOLIDAY VIEW -------------------- */
  if (holiday.isHoliday) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-6 shadow-xl text-center max-w-md w-full">
          <h2 className="text-2xl font-bold mb-2">{holiday.title}</h2>
          <p className="text-sm mb-4">{holiday.message}</p>
          <button
            onClick={handleSwitchUser}
            className="px-4 py-2 rounded-full bg-amber-700 text-white text-sm"
          >
            Switch user
          </button>
        </div>
      </main>
    );
  }

  /* -------------------- LOADING -------------------- */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5e6c8] flex items-center justify-center">
        <p className="text-[#501914] font-semibold">Loading your card…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f5e6c8] flex items-center justify-center">
        <p className="text-[#501914] font-semibold">{error}</p>
      </main>
    );
  }

  /* -------------------- MAIN UI -------------------- */
  return (
    <main className="relative min-h-screen bg-[#f5e6c8] overflow-hidden flex items-center justify-center p-4">

      {/* 🔥 LOUD FALLING CAKEROVEN LOGOS */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(7)].map((_, i) => (
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
              opacity: [0, 0.95, 0.85, 0],
              rotate: [-10, 5, -5, 10],
            }}
            transition={{
              duration: 7,
              delay: i * 0.8,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ filter: "contrast(1.3) brightness(0.9)" }}
          />
        ))}
      </div>

      {/* CARD */}
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-sm md:max-w-xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-2xl text-amber-100 p-6"
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <img
              src="/cakeroven-logo.png"
              className="w-10 h-10 rounded-full bg-white p-1"
              alt="CakeRoven"
            />
            <div>
              <p className="text-xs tracking-widest opacity-70">
                CAKEROVEN LOYALTY
              </p>
              <h1 className="text-lg font-bold">Digital Stamp Card</h1>
            </div>
          </div>
          <p className="text-xs font-mono">{memberCode}</p>
        </div>

        {/* USER */}
        <div className="mb-3">
          <p className="text-xs opacity-70">Card Holder</p>
          <p className="font-semibold truncate">{card?.name}</p>
        </div>

        {/* PHONE */}
        <div className="flex items-center gap-2 text-xs mb-3">
          <span>{showPhone ? card?.phone : maskedPhone}</span>
          <button
            onClick={() => setShowPhone((s) => !s)}
            className="px-2 py-0.5 rounded-full border border-amber-100/30"
          >
            {showPhone ? "HIDE" : "SHOW"}
          </button>
        </div>

        {/* STAMPS */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 12 }).map((_, i) => {
            const filled = stamps > i;
            return (
              <motion.div
                key={i}
                className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold ${
                  filled
                    ? "bg-amber-100 text-[#501914]"
                    : "border border-amber-100/30"
                }`}
                animate={filled ? { scale: [1, 1.08, 1] } : {}}
              >
                {i + 1}
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs opacity-80 mb-3">
          Spend ₹1000+ to earn 1 stamp. Collect 12 stamps to unlock rewards.
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSwitchUser}
            className="text-xs px-3 py-1.5 rounded-full border border-amber-100/30"
          >
            Switch user
          </button>

          {isRewardReady && (
            <motion.button
              onClick={() => setCelebrate(true)}
              className="ml-auto text-xs px-3 py-1.5 rounded-full bg-amber-100/10 border border-amber-100/30"
            >
              🎉 Claim Reward
            </motion.button>
          )}
        </div>

        {/* CELEBRATION */}
        <AnimatePresence>
          {celebrate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-3xl bg-amber-100/5"
            />
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}
