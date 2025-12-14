// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx
 * - Rain falls BEHIND card (z-0), fades at middle.
 * - Stamps are now the CAKEROVEN LOGO when filled.
 * - 12th Stamp is UNIQUE (Golden glow, Gift icon).
 * - ✨ NEW: Added "Rs. 2000 WORTH FREE FOOD!" with fireworks animation. ✨
 */

// --- Holiday Logic ---
function getIstDate(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist;
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
        "We're celebrating the New Year! Stamp access is temporarily unavailable for the New Year period. Wishing you a fantastic year ahead!",
    };
  }

  return { isHoliday: false };
}

// --- New Component: Fireworks Message Animation ---
const FireworksMessage = () => {
  // Create an array for the spark particles
  const sparks = Array.from({ length: 30 });

  const sparkVariants = {
    initial: { opacity: 0, scale: 0, x: 0, y: 0 },
    animate: (i) => {
      const angle = (i / sparks.length) * 360;
      const radius = 80 + Math.random() * 60; // Random distance
      const x = Math.cos((angle * Math.PI) / 180) * radius;
      const y = Math.sin((angle * Math.PI) / 180) * radius;
      const duration = 1.5 + Math.random();

      return {
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0],
        x: x,
        y: y,
        transition: {
          duration: duration,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeOut",
        },
      };
    },
  };

  return (
    <div className="relative flex items-center justify-center py-6 my-2 overflow-visible">
      {/* Fireworks Sparks */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {sparks.map((_, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={sparkVariants}
            initial="initial"
            animate="animate"
            className="absolute w-1.5 h-1.5 bg-amber-300 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.8)]"
            style={{
              // Add some variation in size and color
              width: Math.random() > 0.5 ? '4px' : '6px',
              height: Math.random() > 0.5 ? '4px' : '6px',
              backgroundColor: Math.random() > 0.7 ? '#FBBF24' : '#FCD34D', // amber-400 or amber-300
            }}
          />
        ))}
      </div>

      {/* Main Text with Shimmer Effect */}
      <motion.h2
        initial={{ scale: 0.95 }}
        animate={{ scale: [0.95, 1.02, 0.95] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
        style={{
            textShadow: '0 0 15px rgba(251, 191, 36, 0.5), 0 0 30px rgba(251, 191, 36, 0.3)'
        }}
      >
        ✨ Rs. 2000 WORTH <br /> FREE FOOD! ✨
      </motion.h2>
    </div>
  );
};


// --- Main Card Component ---
export default function Card() {
  const navigate = useNavigate();

  // ---------- Hooks ----------
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [logoInlineVisible, setLogoInlineVisible] = useState(true);
  const [holiday, setHoliday] = useState({ isHoliday: false });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkHoliday = () => {
      const ist = getIstDate();
      const info = getHolidayInfoForIst(ist);
      setHoliday(info);
    };

    checkHoliday();
    const id = setInterval(checkHoliday, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location?.search) {
        const url = new URL(window.location.href);
        if (url.searchParams.has("member")) {
          url.searchParams.delete("member");
          window.history.replaceState({}, "", url.pathname);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const controller = new AbortController();

    const fetchCard = async () => {
      setLoading(true);
      setError("");
      try {
        const url = `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(
          phone
        )}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          const message = d.message || "Unable to load card. Please sign in again.";
          setError(message);
          setLoading(false);
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          return;
        }

        const data = await res.json();
        if (isMountedRef.current) {
          setCard(data.card || data);
          setLoading(false);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("fetchCard error:", err);
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
    card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";

  const inlineLogoSrc = `${process.env.PUBLIC_URL || ""}/cakeroven-logo.png`;

  const page = {
    hidden: { opacity: 0, y: 8 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.42, ease: "easeOut" } },
  };

  const stampVariants = {
    hidden: { scale: 0.92, opacity: 0 },
    show: (i) => ({ scale: 1, opacity: 1, transition: { delay: i * 0.02, duration: 0.22 } }),
    filledPulse: { scale: [1, 1.15, 1], transition: { duration: 0.5, type: "spring" } },
  };

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };
  const handleInlineLogoError = () => setLogoInlineVisible(false);

  // --- Holiday View ---
  if (holiday?.isHoliday) {
    const { title, message } = holiday;
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center p-6">
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6 text-center"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-amber-100 p-3 shadow-inner">
              <span style={{ fontSize: 28 }}>{holiday.key === "christmas" ? "🎄" : "🎉"}</span>
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-amber-900 mb-2">{title}</h2>
          <p className="text-sm text-amber-800/90 mb-4">{message}</p>
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-700 text-white text-sm shadow hover:brightness-105 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        </motion.section>
      </main>
    );
  }

  // --- Loading View ---
  if (loading) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-sm animate-fade-in p-5 rounded-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] shadow-xl text-amber-100">
          <div className="h-3 w-32 rounded-full bg-amber-100/20 mb-3" />
          <div className="h-4 w-44 rounded-full bg-amber-100/12 mb-5" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-9 rounded-full border border-amber-100/12 bg-black/5 animate-pulse"
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-amber-100/70">Loading your card…</p>
        </div>
      </main>
    );
  }

  // --- Error View ---
  if (error && !card) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm p-6 rounded-2xl bg-white/5 border border-amber-100/8 shadow-lg text-amber-900">
          <h3 className="text-lg font-semibold mb-2">Could not load card</h3>
          <p className="text-sm mb-4 text-amber-700/90">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm"
            >
              Retry
            </button>
            <button
              onClick={handleSwitchUser}
              className="px-4 py-2 rounded-full border border-amber-600 text-amber-600 text-sm"
            >
              Switch user
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- Main Card UI ---
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* ✅ CAKEROVEN LOGO RAIN ANIMATION (Behind Card) ✅ */}
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.img
            key={i}
            src="/cakeroven-logo.png"
            alt=""
            className="absolute w-12 h-12 md:w-16 md:h-16 object-contain"
            initial={{
              y: -150,
              x: `${Math.random() * 100}vw`,
              opacity: 0,
            }}
            animate={{
              y: "55vh", 
              opacity: [0, 1, 1, 0], 
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              delay: i * 0.8,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ 
               left: `${Math.random() * 100}%`,
               filter: "brightness(0.9) opacity(0.5)" 
            }}
          />
        ))}
      </div>

      <motion.section
        initial="hidden"
        animate="enter"
        variants={page}
        className="w-full max-w-sm md:max-w-xl relative z-10"
        aria-labelledby="stamp-card-heading"
      >
        <div className="relative z-10 mx-auto bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-lg text-amber-100 p-4 sm:p-6 md:p-8 overflow-hidden">
          {/* subtle decorative glows */}
          <div className="absolute -left-6 -top-10 w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />
          <div className="absolute -right-8 bottom-[-30px] w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {logoInlineVisible && (
                <img
                  src={inlineLogoSrc}
                  alt="CakeRoven logo"
                  onError={handleInlineLogoError}
                  className="h-10 w-10 rounded-full object-contain bg-white/3 p-1 flex-shrink-0"
                />
              )}

              <div className="min-w-0">
                <p className="text-xs tracking-widest uppercase text-amber-100/65">
                  CAKEROVEN LOYALTY
                </p>
                <h1
                  id="stamp-card-heading"
                  className="text-lg sm:text-xl font-extrabold leading-tight mt-1"
                >
                  Digital Stamp Card
                </h1>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase text-amber-100/60">Member ID</p>
              <p className="text-sm font-mono font-semibold mt-1">{memberCode}</p>
            </div>
          </div>

          {/* Holder Info */}
          <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-amber-100/70">Card Holder</p>
              <p className="text-base font-semibold truncate">{card?.name || "—"}</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-amber-100/70">Phone:</span>
              <span className="font-mono text-sm">
                {showPhone ? card?.phone : maskedPhone}
              </span>
              <button
                aria-pressed={showPhone}
                onClick={() => setShowPhone((s) => !s)}
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition"
              >
                {showPhone ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* ✨ NEW: Fireworks Message Animation ✨ */}
          {/* This is placed between the phone number and the progress bar */}
          <FireworksMessage />

          {/* Progress Bar */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 font-mono text-sm">
                {stamps}/12
              </span>
              <p className="text-xs text-amber-100/80">
                {isRewardReady
                  ? "Reward unlocked! Claim below."
                  : "stamps to your next treat."}
              </p>
            </div>

            <div className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 whitespace-nowrap">
              PAY ₹1000+ = 1 STAMP
            </div>
          </div>

          {/* Stamp Board */}
          <div className="rounded-2xl bg-[#3d0f0b]/60 border border-amber-100/6 p-3 mb-3 relative">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="text-sm text-amber-100/80">
                <p className="text-xs">
                  Collect <span className="font-semibold">12 stamps</span> to
                  unlock a special CakeRoven treat 🎁
                </p>
                {rewards > 0 && (
                  <p className="mt-1 text-amber-200/90 text-xs">
                    Rewards earned: <span className="font-semibold">{rewards}</span>
                  </p>
                )}
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20">
                BOARD
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 justify-center">
              <AnimatePresence initial={false}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  const isFinal = index === 12;

                  // Define base classes
                  // Standard stamp size: h-10 w-10
                  // 12th stamp size: h-12 w-12 (slightly bigger) + Golden styling
                  const sizeClasses = isFinal ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10 md:h-12 md:w-12";
                  
                  let borderClasses = "";
                  if (filled) {
                    borderClasses = isFinal 
                        ? "border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)] bg-[#501914]" 
                        : "border-transparent bg-amber-100 shadow-md";
                  } else {
                     // Empty state
                    borderClasses = isFinal 
                        ? "border-amber-400/50 bg-amber-400/5 shadow-[0_0_10px_rgba(251,191,36,0.2)]" 
                        : "border-amber-100/20 bg-transparent hover:bg-amber-100/6";
                  }

                  return (
                    <motion.div
                      key={index}
                      aria-label={`Stamp ${index} ${filled ? "collected" : "empty"}`}
                      initial="hidden"
                      animate={filled ? "filledPulse" : "show"}
                      variants={stampVariants}
                      custom={i}
                      className={`relative flex items-center justify-center rounded-full border transition-all ${sizeClasses} ${borderClasses}`}
                    >
                      {filled ? (
                         /* ✅ FILLED STATE: Render Logo */
                         /* If it's the 12th, we add a golden ring animation around the logo */
                        <div className="relative w-full h-full p-1.5 flex items-center justify-center">
                           <motion.img 
                             src="/cakeroven-logo.png"
                             alt="Stamped"
                             className="w-full h-full object-contain drop-shadow-sm"
                             initial={{ scale: 0, rotate: -45 }}
                             animate={{ scale: 1, rotate: 0 }}
                             transition={{ type: "spring", stiffness: 200 }}
                           />
                           {isFinal && (
                             <div className="absolute inset-0 rounded-full border-2 border-amber-300 animate-ping opacity-20" />
                           )}
                        </div>
                      ) : (
                        /* ❌ EMPTY STATE */
                        <span className={`font-semibold pointer-events-none select-none ${isFinal ? "text-xl" : "text-xs md:text-sm"} text-amber-100/80`}>
                          {isFinal ? "🎁" : index}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* inner border */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-100/8 m-0.5" />
          </div>

          {/* Info & actions */}
          <div className="text-xs text-amber-100/75 space-y-2">
            <p>
              Show this card at the counter after each visit. Every bill of{" "}
              <span className="font-semibold">₹1000 or more</span> earns{" "}
              <span className="font-semibold">1 stamp</span>.
            </p>
            <p>
              After collecting 11 stamps, you’re eligible for a complimentary
              CakeRoven treat With Rs. 2000 Worth Free Food and 12th stamp. 
            </p>
            <p>
              And on 12th stamp time no need make any type of bill.
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleSwitchUser}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-100/20 text-xs hover:bg-amber-100/6 transition"
              >
                Not you? Switch user
              </button>

              {isRewardReady && (
                <motion.button
                  onClick={() => {
                    setCelebrate(true);
                    setTimeout(() => setCelebrate(false), 1200);
                  }}
                  className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/10 border border-amber-100/30 text-xs"
                >
                  🎉 Claim Reward
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* celebrate overlay */}
        <AnimatePresence>
          {celebrate && (
            <motion.div
              key="celebrate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.28 }}
                className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-amber-100/6 to-transparent"
              />
              <div className="absolute inset-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ y: 0, x: 0, opacity: 0 }}
                    animate={{
                      y: [-6 - i * 2, -12 - i * 2, -6 - i * 2],
                      x: [-8 + i * 3, 8 - i * 2, -8 + i * 3],
                      opacity: 1,
                    }}
                    transition={{ duration: 1.1, delay: i * 0.04 }}
                    className="absolute bg-amber-100 rounded-full"
                    style={{
                      width: `${4 + (i % 3)}px`,
                      height: `${4 + (i % 3)}px`,
                      left: `${8 + i * 10}%`,
                      top: `${60 - i * 6}%`,
                      opacity: 0.9,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}