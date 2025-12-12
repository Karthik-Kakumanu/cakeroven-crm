// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Mobile-first Card.jsx
 * - Mobile-first (phone) layout & UX, but also looks good on tablet/desktop
 * - Animated background logo shown ONLY on mobile (hidden on md+)
 * - Robust logo fallback + onError hide so 404 won't break UI
 * - Smooth Framer Motion micro-interactions
 * - All hooks run at top-level (no conditional hooks)
 *
 * Requirements:
 * - cakeroven-logo.png in public/
 * - framer-motion installed
 */

export default function Card() {
  const navigate = useNavigate();

  // ---------- Hooks (always at top level) ----------
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Remove stray query param on mount (safe)
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

  // Fetch card (safe, AbortController)
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
          // Clear local session so user can re-login
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

  // Celebrate when card is full
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

  // Derived / fallback values
  const memberCode = card?.memberCode || card?.member_code || "—";
  const maskedPhone =
    card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";

  // Logo src fallbacks (public)
  const publicSrc = (process.env.PUBLIC_URL || "") + "/cakeroven-logo.png";
  const originSrc =
    typeof window !== "undefined" ? window.location.origin + "/cakeroven-logo.png" : publicSrc;
  const logoSrc = publicSrc || originSrc;

  // ---------- Motion variants ----------
  const page = {
    hidden: { opacity: 0, y: 10 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  };

  const stampVariants = {
    hidden: { scale: 0.92, opacity: 0 },
    show: (i) => ({ scale: 1, opacity: 1, transition: { delay: i * 0.03, duration: 0.26 } }),
    filledPulse: { scale: [1, 1.06, 1], transition: { duration: 0.42 } },
  };

  // ---------- Handlers ----------
  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  const handleLogoError = () => setLogoVisible(false);

  // ---------- Render decisions ----------
  if (loading) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md animate-fade-in p-6 rounded-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] shadow-xl text-amber-100">
          <div className="h-4 w-36 rounded-full bg-amber-100/20 mb-4" />
          <div className="h-5 w-52 rounded-full bg-amber-100/10 mb-6" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-10 w-10 rounded-full border border-amber-100/12 bg-black/5 animate-pulse" />
            ))}
          </div>
          <p className="mt-5 text-sm text-amber-100/70">Loading your digital stamp card…</p>
        </div>
      </main>
    );
  }

  if (error && !card) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md p-6 rounded-2xl bg-white/5 border border-amber-100/8 shadow-lg text-amber-900">
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

  // ---------- Main UI ----------
  return (
    <main className="min-h-screen bg-amber-50 flex items-start md:items-center justify-center p-4">
      <motion.section
        initial="hidden"
        animate="enter"
        variants={page}
        className="w-full max-w-md relative"
        aria-labelledby="stamp-card-heading"
      >
        {/* MOBILE only animated logo (hidden on md+) */}
        {logoVisible && (
          <motion.img
            src={logoSrc}
            alt=""
            onError={handleLogoError}
            aria-hidden
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: [0.03, 0.08, 0.03], y: [0, 6, 0], rotate: [0, 1.2, 0] }}
            transition={{ duration: 9, repeat: Infinity, repeatType: "mirror" }}
            className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 w-[62%] max-w-[380px] opacity-6 mix-blend-overlay transform md:hidden"
          />
        )}

        {/* card container */}
        <div className="relative z-10 mx-auto bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-lg text-amber-100 p-5 sm:p-6 md:p-8 overflow-hidden">
          {/* decorative glows */}
          <div className="absolute -left-6 -top-10 w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />
          <div className="absolute -right-8 bottom-[-30px] w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-xs tracking-widest uppercase text-amber-100/65">CAKEROVEN LOYALTY</p>
              <h1 id="stamp-card-heading" className="text-2xl font-extrabold leading-tight mt-1">
                Digital Stamp Card
              </h1>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-amber-100/60">Member ID</p>
              <p className="text-sm font-mono font-semibold mt-1">{memberCode}</p>
            </div>
          </div>

          {/* Holder + phone */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-amber-100/70">Card Holder</p>
              <p className="text-lg font-semibold truncate">{card?.name || "—"}</p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-xs text-amber-100/70">Phone:</span>
              <span className="font-mono">{showPhone ? card?.phone : maskedPhone}</span>
              <button
                aria-pressed={showPhone}
                onClick={() => setShowPhone((s) => !s)}
                className="ml-1 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition"
              >
                {showPhone ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* progress + rule */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 font-mono text-sm">
                {stamps}/12
              </span>
              <p className="text-sm text-amber-100/80">
                {isRewardReady ? "Reward unlocked! Claim below." : "stamps to your next treat."}
              </p>
            </div>

            <div className="text-xs px-3 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 whitespace-nowrap">
              PAY ₹1000+ = 1 STAMP
            </div>
          </div>

          {/* stamp board */}
          <div className="rounded-2xl bg-[#3d0f0b]/60 border border-amber-100/6 p-4 mb-4 relative">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="text-sm text-amber-100/80">
                <p>
                  Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁
                </p>
                {rewards > 0 && <p className="mt-1 text-amber-200/90">Rewards earned: <span className="font-semibold">{rewards}</span></p>}
              </div>

              <span className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20">BOARD</span>
            </div>

            {/* grid: mobile 3 columns, small spacing for compactness */}
            <div className="grid grid-cols-3 gap-3 justify-center">
              <AnimatePresence initial={false}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  return (
                    <motion.button
                      key={index}
                      aria-label={`Stamp ${index} ${filled ? "collected" : "empty"}`}
                      initial="hidden"
                      animate={filled ? "filledPulse" : "show"}
                      variants={stampVariants}
                      custom={i}
                      whileTap={{ scale: 0.96 }}
                      className={`flex items-center justify-center h-12 w-12 rounded-full border transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-200/20 text-sm ${
                        filled
                          ? "bg-amber-100 text-[#501914] border-transparent shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
                          : "bg-transparent text-amber-100/80 border-amber-100/20 hover:bg-amber-100/6"
                      }`}
                      onClick={() => {
                        // Keep this click non-hook-creating to avoid hooks issues
                        // Future: open modal to confirm stamping (server call)
                      }}
                    >
                      <span className="font-semibold pointer-events-none select-none">{index}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* subtle inner border */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-100/8 m-0.5" />
          </div>

          {/* instructions & actions */}
          <div className="text-sm text-amber-100/75 space-y-3">
            <p>
              Show this card at the counter after each visit. Every bill of <span className="font-semibold">₹1000 or more</span> earns <span className="font-semibold">1 stamp</span>.
            </p>
            <p>After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.</p>

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleSwitchUser}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-amber-100/20 text-sm hover:bg-amber-100/6 transition"
              >
                Not you? Switch user
              </button>

              {isRewardReady && (
                <motion.button
                  onClick={() => {
                    setCelebrate(true);
                    setTimeout(() => setCelebrate(false), 1200);
                  }}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/10 border border-amber-100/30 text-sm"
                >
                  🎉 Claim Reward
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* celebrate overlay (subtle burst for mobile) */}
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
              {/* tiny floating dots */}
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
