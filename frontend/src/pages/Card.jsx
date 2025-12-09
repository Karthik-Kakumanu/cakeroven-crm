// frontend/src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

const logoSrc = "/cakeroven-logo.png"; // place your logo in public/ or update this path

export default function Card() {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  // Remove optional ?member=CR0002 from URL so path stays /card
  useEffect(() => {
    try {
      if (window?.location?.search) {
        const url = new URL(window.location.href);
        if (url.searchParams.has("member")) {
          url.searchParams.delete("member");
          window.history.replaceState({}, "", url.pathname);
        }
      }
    } catch (e) {
      // noop
    }
  }, []);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    // if no session, redirect to /start
    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const fetchCard = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE}/api/customer/card/${encodeURIComponent(
            memberCode
          )}?phone=${encodeURIComponent(phone)}`,
          { signal: controller.signal }
        );

        const data = await res.json().catch(() => null);

        if (!mountedRef.current) return;

        if (!res.ok) {
          const msg = (data && data.message) || "Could not load card";
          setError(msg);
          // clear session and go to start
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          setLoading(false);
          navigate("/start", { replace: true });
          return;
        }

        setCard(data.card ?? data ?? null);
        setLoading(false);
      } catch (err) {
        if (err.name === "AbortError") {
          setError("Request timed out. Please try again.");
        } else {
          console.error(err);
          setError("Server error while loading your card");
        }
        setLoading(false);
        // on serious error, return to start after clearing session
        localStorage.removeItem("cr_memberCode");
        localStorage.removeItem("cr_phone");
        navigate("/start", { replace: true });
      } finally {
        clearTimeout(timeout);
      }
    };

    fetchCard();

    return () => {
      mountedRef.current = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [navigate]);

  useEffect(() => {
    // reset mounted flag when component mounts
    mountedRef.current = true;
  }, []);

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  // derived values with robust fallbacks
  const memberCode = card?.memberCode ?? card?.member_code ?? "—";
  const stamps = Number(card?.currentStamps ?? card?.current_stamps ?? 0);
  const rewards = Number(card?.totalRewards ?? card?.total_rewards ?? 0);
  const isRewardReady = stamps >= 12;

  const maskedPhone =
    card?.phone && card.phone.length >= 3
      ? "••••••" + card.phone.slice(-3)
      : "••••••••••";

  // motion preferences
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // small helpers for animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { when: "beforeChildren", staggerChildren: 0.04 } },
    exit: { opacity: 0, y: 8, transition: { duration: 0.25 } },
  };

  const itemFade = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-52 rounded-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] p-6 relative overflow-hidden shadow-[0_30px_75px_rgba(0,0,0,0.45)]">
              <div className="h-4 w-3/5 bg-[#f5e6c8]/40 rounded" />
              <div className="mt-4 h-6 w-2/5 bg-[#f5e6c8]/30 rounded" />
              <div className="mt-6 grid grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-10 w-10 rounded-full bg-[#f5e6c8]/15" />
                ))}
              </div>
            </div>
            <div className="h-6 rounded bg-[#f5e6c8]/20" />
          </div>
          <p className="text-center text-sm text-[#501914] mt-3">Loading your card…</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 inline-flex rounded-full px-3 py-1 bg-[#fbefd6] text-[#501914] text-sm font-semibold">
            No card found
          </div>
          <p className="text-[#501914]/90 mb-4">We couldn't find your stamp card. Please sign in again.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate("/start", { replace: true })}
              className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm font-medium hover:opacity-95 transition"
            >
              Go to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={memberCode}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={containerVariants}
          className="w-full max-w-sm"
        >
          <motion.div
            className="relative rounded-[28px] bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] text-[#f5e6c8] p-6 shadow-[0_30px_75px_rgba(0,0,0,0.65)] overflow-hidden"
            aria-live="polite"
          >
            {/* Decorative glows */}
            <div aria-hidden className="absolute -top-16 right-[-44px] w-44 h-44 bg-[#f5e6c8]/8 rounded-full blur-3xl" />
            <div aria-hidden className="absolute bottom-[-36px] left-[-36px] w-40 h-40 bg-[#f5e6c8]/8 rounded-full blur-3xl" />

            {/* Top row: Logo + header */}
            <motion.div variants={itemFade} className="relative z-10 flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <motion.img
                  src={logoSrc}
                  alt="CakeRoven logo"
                  className="w-12 h-12 object-contain rounded-md"
                  animate={
                    reduceMotion
                      ? {}
                      : { y: [0, -6, 0], scale: [1, 1.03, 1] }
                  }
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  style={{ willChange: "transform" }}
                />
                <div>
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#f5e6c8]/70">
                    CAKEROVEN LOYALTY
                  </p>
                  <h1 className="text-lg md:text-xl font-extrabold leading-tight">
                    Digital Stamp Card
                  </h1>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#f5e6c8]/60">
                  Member ID
                </p>
                <p className="text-sm font-mono font-bold mt-1">{memberCode}</p>
              </div>
            </motion.div>

            {/* Holder info */}
            <motion.div variants={itemFade} className="relative z-10 mb-4">
              <p className="text-[11px] text-[#f5e6c8]/70">Card Holder</p>
              <p className="text-lg font-semibold truncate">{card.name ?? "—"}</p>

              <div className="mt-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#f5e6c8]/70">Phone:</span>
                  <span className="font-mono" aria-hidden={!showPhone}>
                    {showPhone ? card.phone : maskedPhone}
                  </span>
                </div>

                <div className="ml-2 flex gap-2">
                  <button
                    onClick={() => setShowPhone((v) => !v)}
                    className="px-2 py-1 rounded-full text-[11px] border border-[#f5e6c8]/40 hover:bg-[#f5e6c8]/10 transition-colors"
                    aria-pressed={showPhone}
                    aria-label={showPhone ? "Hide phone number" : "Show phone number"}
                  >
                    {showPhone ? "HIDE" : "SHOW"}
                  </button>

                  <button
                    onClick={() => {
                      // copy masked or real phone to clipboard
                      const text = showPhone ? card.phone : maskedPhone;
                      try {
                        navigator.clipboard?.writeText(text);
                      } catch {
                        // silent
                      }
                    }}
                    className="px-2 py-1 rounded-full text-[11px] border border-[#f5e6c8]/40 hover:bg-[#f5e6c8]/10 transition-colors"
                    title="Copy phone"
                  >
                    COPY
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Progress & rule */}
            <motion.div variants={itemFade} className="relative z-10 mb-4 flex items-center justify-between text-[11px] gap-3">
              <div className="flex items-baseline gap-3">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/25 font-mono text-[11px]">
                  {stamps}/12
                </span>

                <div className="text-[#f5e6c8]/80">
                  {isRewardReady ? (
                    <span className="font-semibold">Reward unlocked! 🎉 Show this card to claim.</span>
                  ) : (
                    <span>stamps to your next treat.</span>
                  )}
                </div>
              </div>

              <div className="text-[10px] px-2 py-1 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30 whitespace-nowrap">
                PAY ₹500+ = 1 STAMP
              </div>
            </motion.div>

            {/* Stamp board */}
            <motion.div variants={itemFade} className="relative z-10 mb-4 rounded-2xl bg-[#3d0f0b]/60 border border-[#f5e6c8]/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] text-[#f5e6c8]/80 max-w-[65%]">
                  <p>
                    Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁
                  </p>
                  {rewards > 0 && (
                    <p className="mt-1 text-[#ffe8bf]/90">
                      Rewards earned so far: <span className="font-semibold">{rewards}</span>
                    </p>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">
                  BOARD
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 justify-items-center">
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  return (
                    <div
                      key={index}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold transition-all ${
                        filled
                          ? "bg-[#f5e6c8] text-[#501914] border-transparent shadow-[0_6px_18px_rgba(0,0,0,0.45)] transform scale-105"
                          : "border-[#f5e6c8]/35 text-[#f5e6c8]/80 bg-transparent"
                      }`}
                      aria-label={Stamp ${index} ${filled ? "collected" : "empty"}}
                      role="img"
                    >
                      {filled ? "✓" : index}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Footer + actions */}
            <motion.div variants={itemFade} className="relative z-10 flex flex-col gap-3 text-[11px] text-[#f5e6c8]/75">
              <div>
                <p>
                  Show this card at the counter after each visit. Every bill of{" "}
                  <span className="font-semibold">₹500 or more</span> earns{" "}
                  <span className="font-semibold">1 stamp</span>.
                </p>
                <p className="mt-1">
                  After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSwitchUser}
                  className="px-3 py-1 rounded-full border border-[#f5e6c8]/40 text-[11px] text-[#f5e6c8]/80 hover:bg-[#f5e6c8]/10 transition"
                >
                  Not you? Switch user
                </button>

                <button
                  onClick={() => {
                    // quick feedback to user when reward ready
                    if (isRewardReady) {
                      alert("🎉 Reward ready! Show this card to the staff to claim your treat.");
                    } else {
                      alert(You have ${stamps}/12 stamps.);
                    }
                  }}
                  className="ml-auto px-3 py-1 rounded-full bg-[#ffe8bf] text-[#501914] text-sm font-medium hover:brightness-95 transition"
                >
                  {isRewardReady ? "Claim Reward" : "View Progress"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}