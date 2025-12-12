// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx (Holiday-aware + Mobile-first)
 *
 * Holiday behavior (IST):
 * - Christmas: Dec 25 (00:00 → 23:59 IST) every year — show "Happy Christmas" message, hide card/stamps.
 * - New Year: Dec 31 (00:00 IST) → Jan 1 (23:59 IST) every year — show "Happy New Year" message, hide card/stamps.
 *
 * - Public asset: public/cakeroven-logo.png (inline logo in header)
 * - Framer Motion used for micro-interactions
 * - Tailwind CSS for styling
 */

function getIstDate(now = new Date()) {
  // IST is UTC + 5:30 -> +330 minutes
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist;
}

function getHolidayInfoForIst(dateIst) {
  // dateIst is a Date already adjusted to IST
  const month = dateIst.getUTCMonth(); // 0=Jan .. 11=Dec when using UTC methods on IST-adjusted Date
  const day = dateIst.getUTCDate();

  // Christmas: every year Dec 25
  if (month === 11 && day === 25) {
    return {
      isHoliday: true,
      key: "christmas",
      title: "🎄 Happy Christmas",
      message:
        "Sorry for the inconvenience on Christmas day. Stamp access is temporarily unavailable. We'll be back shortly — enjoy the celebration!",
    };
  }

  // New Year: Dec 31 and Jan 1 (48 hours)
  // Dec 31 => month 11 day 31
  // Jan 1 => month 0 day 1
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

export default function Card() {
  const navigate = useNavigate();

  // ---------- Hooks (top-level only) ----------
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [logoInlineVisible, setLogoInlineVisible] = useState(true);
  const [holiday, setHoliday] = useState({ isHoliday: false });
  const isMountedRef = useRef(true);

  // Ensure isMountedRef for safe setState when async finishes
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check holidays on mount and every minute — using IST
  useEffect(() => {
    const checkHoliday = () => {
      const ist = getIstDate(); // Date adjusted to IST
      const info = getHolidayInfoForIst(ist);
      setHoliday(info);
    };

    checkHoliday();
    const id = setInterval(checkHoliday, 60 * 1000); // re-check every minute
    return () => clearInterval(id);
  }, []);

  // Remove stray "member" query param (safe)
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

  // Fetch card (safe — abortable)
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
          // clear session so user can re-login
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

  // Celebrate micro-animation when card full
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

  // Derived
  const memberCode = card?.memberCode || card?.member_code || "—";
  const maskedPhone =
    card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";

  // Inline logo path (public root)
  const inlineLogoSrc = `${process.env.PUBLIC_URL || ""}/cakeroven-logo.png`;

  const page = {
    hidden: { opacity: 0, y: 8 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.42, ease: "easeOut" } },
  };

  const stampVariants = {
    hidden: { scale: 0.92, opacity: 0 },
    show: (i) => ({ scale: 1, opacity: 1, transition: { delay: i * 0.02, duration: 0.22 } }),
    filledPulse: { scale: [1, 1.06, 1], transition: { duration: 0.42 } },
  };

  // Handlers
  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };
  const handleInlineLogoError = () => setLogoInlineVisible(false);

  // --- If holiday active, show holiday panel and DO NOT show card/stamps ---
  if (holiday?.isHoliday) {
    const { title, message } = holiday;
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center p-6">
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6 text-center"
          aria-live="polite"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-amber-100 p-3 shadow-inner">
              {/* small decorative emoji/logo */}
              <span style={{ fontSize: 28 }}>{holiday.key === "christmas" ? "🎄" : "🎉"}</span>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-amber-900 mb-2">{title}</h2>
          <p className="text-sm text-amber-800/90 mb-4">{message}</p>

          <div className="space-y-3">
            <p className="text-xs text-amber-700/80">
              We apologize for the temporary downtime. Please visit us again after the holiday period.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-700 text-white text-sm shadow hover:brightness-105 transition"
              >
                Refresh
              </button>

              <button
                onClick={handleSwitchUser}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-700 text-amber-700 text-sm hover:bg-amber-50 transition"
              >
                Switch user
              </button>
            </div>
          </div>
        </motion.section>
      </main>
    );
  }

  // Loading
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

  // Error with no card
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

  // --- Main card UI (normal days) ---
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <motion.section
        initial="hidden"
        animate="enter"
        variants={page}
        className="w-full max-w-sm md:max-w-xl relative"
        aria-labelledby="stamp-card-heading"
      >
        <div className="relative z-10 mx-auto bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-lg text-amber-100 p-4 sm:p-6 md:p-8 overflow-hidden">
          {/* subtle decorative glows */}
          <div className="absolute -left-6 -top-10 w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />
          <div className="absolute -right-8 bottom-[-30px] w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />

          {/* Header with inline logo */}
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
                <p className="text-xs tracking-widest uppercase text-amber-100/65">CAKEROVEN LOYALTY</p>
                <h1 id="stamp-card-heading" className="text-lg sm:text-xl font-extrabold leading-tight mt-1">
                  Digital Stamp Card
                </h1>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase text-amber-100/60">Member ID</p>
              <p className="text-sm font-mono font-semibold mt-1">{memberCode}</p>
            </div>
          </div>

          {/* Holder & phone */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-amber-100/70">Card Holder</p>
              <p className="text-base font-semibold truncate">{card?.name || "—"}</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-amber-100/70">Phone:</span>
              <span className="font-mono text-sm">{showPhone ? card?.phone : maskedPhone}</span>
              <button
                aria-pressed={showPhone}
                onClick={() => setShowPhone((s) => !s)}
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition"
              >
                {showPhone ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* Progress + rule */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 font-mono text-sm">
                {stamps}/12
              </span>
              <p className="text-xs text-amber-100/80">
                {isRewardReady ? "Reward unlocked! Claim below." : "stamps to your next treat."}
              </p>
            </div>

            <div className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 whitespace-nowrap">
              PAY ₹1000+ = 1 STAMP
            </div>
          </div>

          {/* Stamp Board (4-per-line) */}
          <div className="rounded-2xl bg-[#3d0f0b]/60 border border-amber-100/6 p-3 mb-3 relative">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="text-sm text-amber-100/80">
                <p className="text-xs">
                  Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁
                </p>
                {rewards > 0 && (
                  <p className="mt-1 text-amber-200/90 text-xs">
                    Rewards earned: <span className="font-semibold">{rewards}</span>
                  </p>
                )}
              </div>

              <span className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20">BOARD</span>
            </div>

            <div className="grid grid-cols-4 gap-2 justify-center">
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
                      className={`flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-full border transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-200/20 text-sm ${
                        filled
                          ? "bg-amber-100 text-[#501914] border-transparent shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
                          : "bg-transparent text-amber-100/80 border-amber-100/20 hover:bg-amber-100/6"
                      }`}
                      onClick={() => {
                        // place for future interactions (keep non-hook-creating)
                      }}
                    >
                      <span className="font-semibold pointer-events-none select-none text-xs md:text-sm">
                        {index}
                      </span>
                    </motion.button>
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
              <span className="font-semibold">₹1000 or more</span> earns <span className="font-semibold">1 stamp</span>.
            </p>
            <p>
              After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat. 
              A Gift Hamper / A Cake.
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
