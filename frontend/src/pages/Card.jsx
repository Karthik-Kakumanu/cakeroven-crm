// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx (Luxury Edition)
 * - Fixed: Logos fall BEHIND the card (z-0 vs z-10).
 * - Fixed: Logos do NOT rotate.
 * - Style: Premium Dark Chocolate & Gold theme.
 */

// --- Helpers ---
function getIstDate(now = new Date()) {
  // IST is UTC + 5:30 -> +330 minutes
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist;
}

function getHolidayInfoForIst(dateIst) {
  const month = dateIst.getUTCMonth();
  const day = dateIst.getUTCDate();

  // Christmas: Dec 25
  if (month === 11 && day === 25) {
    return {
      isHoliday: true,
      key: "christmas",
      title: "🎄 Merry Christmas",
      message:
        "We are closed for the celebrations! Stamp access is paused today. Wishing you a joyous holiday.",
    };
  }

  // New Year: Dec 31 & Jan 1
  if ((month === 11 && day === 31) || (month === 0 && day === 1)) {
    return {
      isHoliday: true,
      key: "newyear",
      title: "🎉 Happy New Year",
      message:
        "Celebrating the New Year! System is paused. Wishing you a fantastic year ahead!",
    };
  }

  return { isHoliday: false };
}

export default function Card() {
  const navigate = useNavigate();

  // --- State ---
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [logoInlineVisible, setLogoInlineVisible] = useState(true);
  const [holiday, setHoliday] = useState({ isHoliday: false });
  const isMountedRef = useRef(true);

  // --- Effects ---
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Holiday Check
  useEffect(() => {
    const checkHoliday = () => {
      const ist = getIstDate();
      setHoliday(getHolidayInfoForIst(ist));
    };
    checkHoliday();
    const id = setInterval(checkHoliday, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // URL Cleanup
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("member")) {
        url.searchParams.delete("member");
        window.history.replaceState({}, "", url.pathname);
      }
    }
  }, []);

  // Fetch Data
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
          throw new Error(d.message || "Unable to load card.");
        }

        const data = await res.json();
        if (isMountedRef.current) {
          setCard(data.card || data);
          setLoading(false);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (isMountedRef.current) {
          setError(err.message || "Server connection failed.");
          setLoading(false);
          if (err.message.includes("Unable")) {
            localStorage.removeItem("cr_memberCode");
            localStorage.removeItem("cr_phone");
          }
        }
      }
    };

    fetchCard();
    return () => controller.abort();
  }, [navigate]);

  // Logic
  const stamps = Number(card?.currentStamps ?? card?.current_stamps ?? 0);
  const rewards = Number(card?.totalRewards ?? card?.total_rewards ?? 0);
  const isRewardReady = stamps >= 12;

  useEffect(() => {
    if (isRewardReady) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isRewardReady]);

  const memberCode = card?.memberCode || card?.member_code || "—";
  const maskedPhone =
    card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";
  const inlineLogoSrc = `${process.env.PUBLIC_URL || ""}/cakeroven-logo.png`;

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  // --- UI Constants ---
  const stampVariants = {
    hidden: { scale: 0.8, opacity: 0.5 },
    show: { scale: 1, opacity: 1, transition: { duration: 0.3 } },
    filledPulse: {
      scale: [1, 1.1, 1],
      boxShadow: [
        "0px 0px 0px rgba(251, 191, 36, 0)",
        "0px 0px 15px rgba(251, 191, 36, 0.5)",
        "0px 0px 0px rgba(251, 191, 36, 0)",
      ],
      transition: { duration: 0.6 },
    },
  };

  // --- Render: Holiday Mode ---
  if (holiday?.isHoliday) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#2a0a0a] text-[#e8dcc0]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center bg-[#3d1010] border border-[#6b2c2c] p-8 rounded-2xl shadow-2xl"
        >
          <div className="text-6xl mb-4">{holiday.key === "christmas" ? "🎄" : "🥂"}</div>
          <h1 className="text-3xl font-serif text-[#d4af37] mb-3">{holiday.title}</h1>
          <p className="text-white/80 leading-relaxed mb-6">{holiday.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#d4af37] text-[#2a0a0a] font-bold rounded-full hover:bg-[#f1c40f] transition-colors"
          >
            Refresh Status
          </button>
        </motion.div>
      </main>
    );
  }

  // --- Render: Loading / Error ---
  if (loading || (error && !card)) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#2a0a0a] p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#d4af37] font-serif tracking-widest text-sm animate-pulse">
              RETRIEVING CARD...
            </p>
          </div>
        ) : (
          <div className="text-center max-w-xs">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={handleSwitchUser}
              className="text-[#d4af37] border-b border-[#d4af37] pb-0.5 text-sm hover:text-white transition"
            >
              Back to Login
            </button>
          </div>
        )}
      </main>
    );
  }

  // --- Render: Main Card ---
  return (
    <>
      {/* Import Font for Premium Look */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');`}
      </style>

      {/* Main Container */}
      <main className="relative min-h-screen w-full overflow-hidden bg-[#1a0505] flex items-center justify-center p-4">
        
        {/* 1. BACKGROUND GRADIENT & NOISE */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a0808] via-[#1a0505] to-[#0f0202] z-0" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
        </div>

        {/* 2. FALLING LOGOS (BACKGROUND z-0) */}
        {/* Strictly behind the card. No rotation. */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.img
              key={i}
              src="/cakeroven-logo.png"
              alt=""
              initial={{ y: -150, x: `${Math.random() * 100}vw`, opacity: 0 }}
              animate={{
                y: "110vh",
                opacity: [0, 0.4, 0.4, 0], // Subtle visibility
              }}
              transition={{
                duration: 8 + Math.random() * 7,
                delay: i * 0.5,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute w-12 h-12 md:w-20 md:h-20 object-contain opacity-20 grayscale brightness-50"
            />
          ))}
        </div>

        {/* 3. THE LUXURY CARD (z-10) */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[420px] md:max-w-[480px]"
        >
          {/* Card Body */}
          <div className="relative overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-[#d4af37]/30 bg-gradient-to-b from-[#3a1010] to-[#1f0505]">
            
            {/* Top Shine Effect */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#ffffff]/10 to-transparent pointer-events-none" />

            {/* Content Padding */}
            <div className="relative p-6 md:p-8 flex flex-col h-full">
              
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  {logoInlineVisible && (
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-[#d4af37]/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                      <img
                        src={inlineLogoSrc}
                        alt="Logo"
                        onError={() => setLogoInlineVisible(false)}
                        className="w-8 h-8 object-contain drop-shadow-md"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="text-[#d4af37] font-serif font-bold text-xl tracking-wide">
                      CakeRoven
                    </h2>
                    <p className="text-[#d4af37]/60 text-[10px] tracking-[0.2em] uppercase font-sans">
                      Exclusive Loyalty
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <div className="px-3 py-1 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-lg backdrop-blur-md">
                     <p className="text-[#d4af37]/50 text-[9px] uppercase tracking-widest mb-0.5">Member ID</p>
                     <p className="text-[#d4af37] font-mono text-xs font-bold">{memberCode}</p>
                   </div>
                </div>
              </div>

              {/* User Strip */}
              <div className="bg-[#000000]/20 rounded-xl p-4 border border-[#ffffff]/5 backdrop-blur-sm mb-6 flex items-center justify-between">
                <div>
                   <p className="text-[#d4af37]/50 text-[10px] uppercase tracking-wider">Card Holder</p>
                   <p className="text-[#f3e5c0] font-serif text-lg leading-tight truncate max-w-[150px]">
                     {card?.name || "Valued Guest"}
                   </p>
                </div>
                <div className="flex flex-col items-end">
                   <p className="text-[#d4af37]/50 text-[10px] uppercase tracking-wider">Phone</p>
                   <div className="flex items-center gap-2">
                     <span className="text-[#f3e5c0] font-mono text-sm tracking-tight">
                       {showPhone ? card?.phone : maskedPhone}
                     </span>
                     <button
                        onClick={() => setShowPhone(!showPhone)}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37] hover:text-[#2a0a0a] transition-all"
                     >
                       <span className="text-[10px] font-bold">{showPhone ? "✕" : "👁"}</span>
                     </button>
                   </div>
                </div>
              </div>

              {/* Progress Text */}
              <div className="flex justify-between items-end mb-3 px-1">
                <div>
                  <p className="text-[#f3e5c0] text-sm">
                    Stamps collected
                  </p>
                  <div className="h-1 w-32 bg-[#ffffff]/10 rounded-full mt-1 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stamps / 12) * 100}%` }}
                      className="h-full bg-gradient-to-r from-[#d4af37] to-[#f1c40f]"
                    />
                  </div>
                </div>
                <div className="text-right">
                   <span className="text-3xl font-serif text-[#d4af37] font-bold">{stamps}</span>
                   <span className="text-[#d4af37]/50 text-sm font-serif">/12</span>
                </div>
              </div>

              {/* The Grid */}
              <div className="bg-[#1a0505]/60 rounded-xl p-4 border border-[#d4af37]/20 shadow-inner relative">
                 {/* Decorative Corner Borders */}
                 <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#d4af37]/40 rounded-tl-lg m-2"></div>
                 <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#d4af37]/40 rounded-tr-lg m-2"></div>
                 <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#d4af37]/40 rounded-bl-lg m-2"></div>
                 <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#d4af37]/40 rounded-br-lg m-2"></div>

                 <div className="grid grid-cols-4 gap-3 sm:gap-4 relative z-10">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const index = i + 1;
                      const isFilled = stamps >= index;
                      
                      return (
                        <motion.div
                          key={i}
                          initial="hidden"
                          animate={isFilled ? "filledPulse" : "show"}
                          variants={stampVariants}
                          custom={i}
                          className="aspect-square flex items-center justify-center relative"
                        >
                          {/* Empty State: Dotted Gold Circle */}
                          <div className={`absolute inset-0 rounded-full border-2 border-dashed border-[#d4af37]/30 ${isFilled ? 'opacity-0' : 'opacity-100'}`} />
                          
                          {/* Filled State: Gold Coin / Stamp */}
                          {isFilled && (
                            <motion.div 
                              layoutId={`stamp-${i}`}
                              className="absolute inset-0 rounded-full bg-gradient-to-b from-[#f1c40f] to-[#b8860b] shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center border border-[#ffecb3]/50"
                            >
                               {/* Inner embossing */}
                               <div className="w-[85%] h-[85%] rounded-full border border-[#7a5907]/30 flex items-center justify-center">
                                  <span className="text-[#3d1010] font-bold text-xs">CR</span>
                               </div>
                            </motion.div>
                          )}

                          {/* Number Label (only visible if empty) */}
                          {!isFilled && (
                            <span className="text-[#d4af37]/30 font-mono text-xs">{index}</span>
                          )}
                        </motion.div>
                      );
                    })}
                 </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-6 flex items-center justify-between">
                <button
                   onClick={handleSwitchUser}
                   className="text-[#d4af37]/60 hover:text-[#d4af37] text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <span>←</span> Switch Account
                </button>

                {isRewardReady && (
                   <motion.button
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     onClick={() => setCelebrate(true)}
                     className="bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#2a0a0a] px-4 py-2 rounded-full font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2"
                   >
                     <span>🎁</span> Claim Reward
                   </motion.button>
                )}
              </div>
              
              <div className="mt-4 text-center">
                 <p className="text-[10px] text-[#d4af37]/40">Spend ₹1000+ to earn 1 Stamp</p>
              </div>

            </div>
          </div>
        </motion.section>

        {/* 4. CELEBRATION OVERLAY */}
        <AnimatePresence>
          {celebrate && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
               />
               <motion.div
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.8, opacity: 0 }}
                 className="relative z-10 bg-gradient-to-br from-[#d4af37] to-[#b8860b] p-8 rounded-3xl shadow-2xl text-center border-4 border-[#ffecb3]"
               >
                 <h2 className="text-2xl font-serif font-bold text-[#3d1010] mb-2">Congratulations!</h2>
                 <p className="text-[#3d1010]/80 font-medium">You've unlocked a sweet reward!</p>
                 <div className="mt-4 text-4xl">🍰</div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </>
  );
}