// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Upgraded Card.jsx (modified per request)
 *
 * Key changes from your copy:
 * - All hooks run unconditionally (kept at top-level)
 * - Added `error` fallback UI instead of returning null
 * - Small UX improvements and safe fetch handling
 * - Mobile-first responsive styling with Tailwind
 *
 * Requirements:
 * - cakeroven-logo.png should be in public/
 * - framer-motion installed: npm i framer-motion
 */

export default function Card() {
  const navigate = useNavigate();

  // --- Hooks (always at top level) ---
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // new: expose fetch errors
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // remove stray query param on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("member")) {
        url.searchParams.delete("member");
        window.history.replaceState({}, "", url.pathname);
      }
    } catch (e) {
      // ignore malformed url
    }
  }, []);

  // fetch card (safe, AbortController)
  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      // If no session, redirect early (this is safe; all hooks already invoked)
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
          const data = await res.json().catch(() => ({}));
          const msg = data.message || "Could not load card. Please sign in again.";
          setError(msg);
          // Clear session and navigate back to start for safety
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          if (isMountedRef.current) {
            setLoading(false);
          }
          return;
        }

        const data = await res.json();
        if (isMountedRef.current) {
          setCard(data.card || data);
          setLoading(false);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Card fetch error:", err);
        if (isMountedRef.current) {
          setError("Server error while loading your card.");
          setLoading(false);
        }
      }
    };

    fetchCard();
    return () => controller.abort();
  }, [navigate]);

  // utility handlers
  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  const handleRetry = () => {
    // simple page reload to re-trigger the fetch effect. Keeps hooks stable.
    window.location.reload();
  };

  // Derived values (safe even if card is null)
  const memberCode = (card && (card.memberCode || card.member_code)) || "—";
  const stamps = Number(card?.currentStamps ?? card?.current_stamps ?? 0);
  const rewards = Number(card?.totalRewards ?? card?.total_rewards ?? 0);
  const isRewardReady = stamps >= 12;
  const maskedPhone =
    card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";

  // asset path (public)
  const logoSrc = process.env.PUBLIC_URL + "/cakeroven-logo.png";

  // motion variants
  const pageVariant = {
    hidden: { opacity: 0, y: 12 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  };

  const stampVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    show: (i) => ({
      scale: 1,
      opacity: 1,
      transition: { delay: i * 0.03, duration: 0.28, ease: "easeOut" },
    }),
    filledPulse: { scale: [1, 1.06, 1], transition: { duration: 0.45 } },
  };

  const blastVariantLeft = {
    hidden: { x: -60, opacity: 0, rotate: -6, scale: 0.9 },
    enter: {
      x: -6,
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: { duration: 0.9, ease: "circOut" },
    },
  };
  const blastVariantRight = {
    hidden: { x: 60, opacity: 0, rotate: 6, scale: 0.9 },
    enter: {
      x: 6,
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: { duration: 0.9, ease: "circOut" },
    },
  };

  // celebrate when full (small automatic confetti-like scale)
  useEffect(() => {
    if (isRewardReady) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1600);
      return () => clearTimeout(t);
    }
  }, [isRewardReady]);

  // --- Render states ---

  // Loading skeleton (mobile-first)
  if (loading) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in px-5 py-8 rounded-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] shadow-2xl relative overflow-hidden">
          <div className="h-5 w-40 rounded-full bg-amber-100/20 mb-5" />
          <div className="h-6 w-56 rounded-full bg-amber-100/12 mb-6" />
          <div className="grid grid-cols-4 gap-3 mt-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-10 rounded-full border border-amber-100/10 bg-black/5 animate-pulse"
              />
            ))}
          </div>
          <p className="text-sm text-amber-100/60 mt-6">Loading your card…</p>
        </div>
      </main>
    );
  }

  // Error fallback UI (safer than returning null)
  if (error && !card) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md px-6 py-8 rounded-2xl bg-white/5 border border-amber-100/8 shadow-lg text-amber-900">
          <h2 className="text-lg font-semibold mb-2">Unable to load card</h2>
          <p className="text-sm mb-4 text-amber-700/80">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-amber-600 text-white text-sm hover:brightness-105 transition"
            >
              Retry
            </button>
            <button
              onClick={handleSwitchUser}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-amber-600 text-amber-600 text-sm hover:bg-amber-600/6 transition"
            >
              Switch user
            </button>
          </div>
        </div>
      </main>
    );
  }

  // If card exists, render main UI
  return (
    <main className="min-h-screen bg-amber-50 flex items-start md:items-center justify-center p-4 md:p-8">
      <motion.section
        initial="hidden"
        animate="enter"
        variants={pageVariant}
        className="w-full max-w-xl relative"
        aria-labelledby="stamp-card-heading"
      >
        {/* left & right blast ambient shapes (subtle) */}
        <motion.div
          variants={blastVariantLeft}
          initial="hidden"
          animate="enter"
          className="pointer-events-none absolute left-[-40px] top-6 hidden md:block"
        >
          <div className="w-40 h-80 rounded-l-full bg-gradient-to-br from-amber-200/8 to-transparent blur-xl" />
        </motion.div>

        <motion.div
          variants={blastVariantRight}
          initial="hidden"
          animate="enter"
          className="pointer-events-none absolute right-[-40px] top-6 hidden md:block"
        >
          <div className="w-40 h-80 rounded-r-full bg-gradient-to-bl from-amber-200/8 to-transparent blur-xl" />
        </motion.div>

        {/* Floating logo (both mobile & desktop) */}
        <motion.img
          src={logoSrc}
          alt="CakeRoven logo background"
          aria-hidden
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: [0.04, 0.08, 0.04],
            rotate: [0, 1.5, 0],
            scale: [1, 1.02, 1],
            x: [0, 6, 0],
          }}
          transition={{ duration: 9, repeat: Infinity, repeatType: "mirror" }}
          className="pointer-events-none absolute inset-0 m-auto w-[62%] max-w-[740px] opacity-6 mix-blend-overlay transform -translate-y-8"
        />

        {/* Main card */}
        <div className="relative z-10 mx-auto bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-[0_28px_60px_rgba(3,2,0,0.6)] text-amber-100 p-5 sm:p-8 md:p-10 overflow-hidden">
          {/* top decorative glows */}
          <div className="absolute -left-8 -top-12 w-44 h-44 rounded-full bg-amber-100/6 blur-2xl" />
          <div className="absolute -right-10 bottom-[-36px] w-44 h-44 rounded-full bg-amber-100/6 blur-2xl" />

          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-xs tracking-widest uppercase text-amber-100/65">CAKEROVEN LOYALTY</p>
              <h1
                id="stamp-card-heading"
                className={`text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight mt-1 tracking-tight ${celebrate ? "text-amber-50" : ""}`}
              >
                Digital Stamp Card
              </h1>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-amber-100/60">Member ID</p>
              <p className="text-sm font-mono font-semibold mt-1">{memberCode}</p>
            </div>
          </div>

          {/* Holder + phone */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-amber-100/70">Card Holder</p>
              <p className="text-lg md:text-xl font-semibold truncate">{card?.name || "—"}</p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-xs text-amber-100/70">Phone:</span>
              <span className="font-mono">{showPhone ? card?.phone : maskedPhone}</span>
              <button
                aria-pressed={showPhone}
                onClick={() => setShowPhone((v) => !v)}
                className="ml-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition"
              >
                {showPhone ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* Progress row */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 font-mono text-sm">
                {stamps}/12
              </span>
              <p className="text-sm text-amber-100/80">
                {isRewardReady ? "Reward unlocked! 🎉 Tap to claim." : "stamps to your next treat."}
              </p>
            </div>

            <div className="text-xs px-3 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 whitespace-nowrap">
              PAY ₹1000+ = 1 STAMP
            </div>
          </div>

          {/* Stamp board */}
          <div className="rounded-2xl bg-[#3d0f0b]/60 border border-amber-100/6 p-4 md:p-6 mb-4 relative">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="text-sm text-amber-100/80">
                <p>
                  Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁
                </p>
                {rewards > 0 && (
                  <p className="mt-1 text-amber-200/90">Rewards earned: <span className="font-semibold">{rewards}</span></p>
                )}
              </div>

              <span className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20">BOARD</span>
            </div>

            {/* grid: mobile 3 cols, tablet 4 cols */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 justify-center">
              <AnimatePresence initial={false}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  return (
                    <motion.button
                      key={index}
                      aria-label={`Stamp ${index} ${filled ? "filled" : "empty"}`}
                      initial="hidden"
                      animate={filled ? "filledPulse" : "show"}
                      variants={stampVariants}
                      custom={i}
                      whileTap={{ scale: 0.96 }}
                      title={filled ? `Collected (${index})` : `Stamp ${index}`}
                      className={`flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-full border transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-200/30 ${
                        filled
                          ? "bg-amber-100 text-[#501914] border-transparent shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                          : "bg-transparent text-amber-100/80 border-amber-100/20 hover:bg-amber-100/6"
                      }`}
                      onClick={() => {
                        // placeholder for future interactions (non-destructive)
                        // keep logic client-side and non-hook-creating
                      }}
                    >
                      <span className="font-semibold select-none pointer-events-none">{index}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* subtle border decoration */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-100/8 m-0.5" />
          </div>

          {/* Info and actions */}
          <div className="text-sm text-amber-100/75 space-y-3">
            <p>
              Show this card at the counter after each visit. Every bill of{" "}
              <span className="font-semibold">₹1000 or more</span> earns <span className="font-semibold">1 stamp</span>.
            </p>
            <p>
              After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-3">
              <button
                onClick={handleSwitchUser}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-amber-100/20 text-sm hover:bg-amber-100/6 transition"
              >
                Not you? Switch user
              </button>

              {isRewardReady && (
                <motion.button
                  onClick={() => {
                    // show a small celebratory micro-modal or action
                    setCelebrate(true);
                    setTimeout(() => setCelebrate(false), 1200);
                  }}
                  className="ml-0 sm:ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100/10 to-amber-100/12 border border-amber-100/30 text-sm hover:brightness-105 transition"
                  initial={{ scale: 0.98 }}
                >
                  🎉 Claim Reward
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* celebrate overlay (confetti-like circles) */}
        <AnimatePresence>
          {celebrate && (
            <motion.div
              key="celebrate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.28 }}
                className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-amber-100/6 to-transparent"
              />
              {/* small animated bursts */}
              <div className="absolute inset-0 flex items-center justify-between px-6">
                <motion.span
                  initial={{ x: -10, scale: 0.6, opacity: 0 }}
                  animate={{ x: -40, scale: 1.05, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="hidden md:block w-24 h-24 rounded-full bg-amber-200/20 blur-lg"
                />
                <motion.span
                  initial={{ x: 10, scale: 0.6, opacity: 0 }}
                  animate={{ x: 40, scale: 1.05, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="hidden md:block w-24 h-24 rounded-full bg-amber-200/20 blur-lg"
                />
              </div>

              {/* floating tiny dots */}
              <div className="absolute inset-0">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ y: 0, x: 0, opacity: 0 }}
                    animate={{
                      y: [-6 - idx, -10 - idx, -6 - idx],
                      x: [(-8 + idx) * 2, (8 - idx) * 2, (-8 + idx) * 2],
                      opacity: 1,
                    }}
                    transition={{ duration: 1.2, delay: idx * 0.04, repeat: 0 }}
                    className="absolute bg-amber-100 rounded-full"
                    style={{
                      width: `${4 + (idx % 3)}px`,
                      height: `${4 + (idx % 3)}px`,
                      left: `${8 + idx * 6}%`,
                      top: `${48 - idx}%`,
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
