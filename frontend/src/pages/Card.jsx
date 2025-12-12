// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card Component
 * - Modern responsive layout using Tailwind CSS
 * - Framer Motion animations for entrance and stamp fills
 * - Background animated logo (place cakeroven-logo.png in public/)
 * - Robust fetch with AbortController and graceful error handling
 */

export default function Card() {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const isMountedRef = useRef(true);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // remove member query param if set manually
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window?.location?.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("member")) {
        url.searchParams.delete("member");
        window.history.replaceState({}, "", url.pathname);
      }
    }
  }, []);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    // If no session → send to start
    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const controller = new AbortController();

    const fetchCard = async () => {
      setLoading(true);
      try {
        const url = `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(
          phone
        )}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.message || "Could not load card. Please sign in again.");
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          navigate("/start", { replace: true });
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
          alert("Server error while loading your card.");
          navigate("/start", { replace: true });
        }
      }
    };

    fetchCard();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  // Loading skeleton
  if (loading) {
    return (
      <main className="min-h-screen bg-amber-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-fade-in px-6 py-10 rounded-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] shadow-xl relative overflow-hidden">
          <div className="h-5 w-48 rounded-full bg-[#f5e6c8]/20 mb-6" />
          <div className="h-6 w-64 rounded-full bg-[#f5e6c8]/12 mb-4" />
          <div className="grid grid-cols-4 gap-3 mt-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-10 rounded-full border border-[#f5e6c8]/10 bg-[#000000]/5 animate-pulse"
              />
            ))}
          </div>
          <p className="text-sm text-[#f5e6c8]/60 mt-6">Loading your card…</p>
        </div>
      </main>
    );
  }

  if (!card) return null;

  const memberCode = card.memberCode || card.member_code || "—";
  const stamps = Number(card.currentStamps ?? card.current_stamps ?? 0);
  const rewards = Number(card.totalRewards ?? card.total_rewards ?? 0);
  const isRewardReady = stamps >= 12;

  const maskedPhone =
    card.phone && card.phone.length >= 3
      ? "••••••" + card.phone.slice(-3)
      : "••••••••••";

  // paths for background logo - recommend placing file in public/
  const logoSrc =
    process.env.PUBLIC_URL + "/cakeroven-logo.png" || "/cakeroven-logo.png";

  // Framer motion variants
  const containerVariants = {
    hidden: { opacity: 0, y: 14 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const stampVariants = {
    hidden: { scale: 0.85, opacity: 0 },
    visible: (i) => ({
      scale: 1,
      opacity: 1,
      transition: { delay: i * 0.03, duration: 0.25 },
    }),
    filled: { scale: [1, 1.06, 1], transition: { duration: 0.36 } },
  };

  return (
    <main className="min-h-screen bg-amber-100 flex items-center justify-center p-6">
      <motion.section
        initial="hidden"
        animate="enter"
        variants={containerVariants}
        className="w-full max-w-2xl relative"
        aria-labelledby="stamp-card-heading"
      >
        {/* Animated background logo */}
        <motion.img
          aria-hidden
          src={logoSrc}
          alt=""
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: [0.06, 0.08, 0.06],
            rotate: [0, 1.2, 0],
            scale: [1, 1.02, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, repeatType: "mirror" }}
          className="pointer-events-none absolute inset-0 m-auto w-[60%] max-w-[700px] opacity-5 mix-blend-overlay transform -translate-y-6"
        />

        <div className="relative z-10 mx-auto bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-[0_30px_80px_rgba(10,8,6,0.6)] text-amber-100 p-6 md:p-10 overflow-hidden">
          {/* soft ambient glows */}
          <div className="absolute -left-10 -top-14 w-56 h-56 rounded-full bg-amber-100/6 blur-2xl" />
          <div className="absolute -right-12 bottom-[-40px] w-44 h-44 rounded-full bg-amber-100/6 blur-2xl" />

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs tracking-widest uppercase text-amber-100/70">
                CAKEROVEN LOYALTY
              </p>
              <h1
                id="stamp-card-heading"
                className="text-2xl md:text-3xl font-extrabold leading-tight mt-1"
              >
                Digital Stamp Card
              </h1>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-amber-100/60">
                Member ID
              </p>
              <p className="text-sm font-mono font-semibold mt-1">{memberCode}</p>
            </div>
          </div>

          {/* Holder */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-amber-100/70">Card Holder</p>
              <p className="text-lg md:text-xl font-semibold truncate">
                {card.name || "—"}
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-xs text-amber-100/70">Phone:</span>
              <span className="font-mono">{showPhone ? card.phone : maskedPhone}</span>
              <button
                aria-pressed={showPhone}
                onClick={() => setShowPhone((v) => !v)}
                className="ml-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition"
              >
                {showPhone ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 font-mono text-sm">
                {stamps}/12
              </span>
              <p className="text-sm text-amber-100/80 truncate">
                {isRewardReady
                  ? "Reward unlocked! 🎉 Show this card to claim."
                  : "stamps to your next treat."}
              </p>
            </div>

            <div className="text-xs px-3 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 whitespace-nowrap">
              PAY ₹1000+ = 1 STAMP
            </div>
          </div>

          {/* Stamp board card */}
          <div className="rounded-2xl bg-[#3d0f0b]/60 border border-amber-100/6 p-5 mb-4">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="text-sm text-amber-100/80">
                <p>
                  Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁
                </p>
                {rewards > 0 && (
                  <p className="mt-1 text-amber-200/90">
                    Rewards earned so far: <span className="font-semibold">{rewards}</span>
                  </p>
                )}
              </div>

              <span className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20">
                BOARD
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-4 justify-center">
              <AnimatePresence>
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  return (
                    <motion.button
                      key={index}
                      aria-label={`Stamp ${index} ${filled ? "filled" : "empty"}`}
                      initial="hidden"
                      animate={filled ? "filled" : "visible"}
                      variants={stampVariants}
                      custom={i}
                      whileTap={{ scale: 0.96 }}
                      className={`flex items-center justify-center h-12 w-12 md:h-12 md:w-12 rounded-full border transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-200/30 ${
                        filled
                          ? "bg-amber-100 text-[#501914] border-transparent shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
                          : "bg-transparent text-amber-100/80 border-amber-100/20"
                      }`}
                      onClick={() => {
                        // Optional: you could open a modal or animate on click for unfilled stamps.
                        // keep non-destructive by default
                      }}
                    >
                      <span className="font-semibold select-none pointer-events-none">{index}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer / Instructions */}
          <div className="text-sm text-amber-100/75 space-y-3">
            <p>
              Show this card at the counter after each visit. Every bill of{" "}
              <span className="font-semibold">₹1000 or more</span> earns <span className="font-semibold">1 stamp</span>.
            </p>
            <p>
              After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.
            </p>

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleSwitchUser}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-amber-100/20 text-sm hover:bg-amber-100/6 transition"
              >
                Not you? Switch user
              </button>

              {isRewardReady && (
                <motion.div
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-amber-100/8 border border-amber-100/30 text-sm">
                    🎉 Reward ready
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
