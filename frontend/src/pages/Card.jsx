// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx
 * - Rain falls BEHIND card (z-0).
 * - Stamps are CAKEROVEN LOGO when filled.
 * - 12th Stamp is UNIQUE.
 * - Payment: Accepts ANY amount.
 * - Logic: 
 * - < 1000: No stamp, shows specific "Sorry" toast (2s).
 * - >= 1000: Adds stamp (unless 12th).
 * - FIXED: Responsive "Food Free" Badge.
 * - Professional Toast Notifications.
 */

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

// --- Razorpay Loader Helper ---
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

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
  
  // Payment State
  const [payAmount, setPayAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // Notification State (Toast)
  const [toast, setToast] = useState(null); // { message, type: 'success'|'info'|'error', duration: ms }

  const isMountedRef = useRef(true);

  // Auto-dismiss Toast Logic
  useEffect(() => {
    if (toast) {
      const duration = toast.duration || 3500;
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

  // ---------- Handlers ----------

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };
  const handleInlineLogoError = () => setLogoInlineVisible(false);

  // --- Payment Handler (Razorpay + Backend Logic) ---
  const handlePayment = async () => {
    // 1. Validation (Allows ANY amount > 0)
    if (!payAmount || Number(payAmount) <= 0) {
      setToast({ message: "Please enter a valid amount.", type: "error" });
      return;
    }

    setIsPaying(true);

    // 2. Load the SDK
    const res = await loadRazorpayScript();
    if (!res) {
      setToast({ message: "Razorpay SDK failed to load. Check internet.", type: "error" });
      setIsPaying(false);
      return;
    }

    // 3. Setup Options
    const options = {
      key: "rzp_test_1DP5mmOlF5G5ag", // ✅ Test Key
      amount: Number(payAmount) * 100, // Amount in paise
      currency: "INR",
      name: "CakeRoven",
      description: "Loyalty Stamp Payment",
      image: `${window.location.origin}/cakeroven-logo.png`, 
      
      // ✅ Success Handler calling the NEW Endpoint
      handler: async function (response) {
        try {
          const verifyRes = await fetch(`${API_BASE}/api/customer/add-online-stamp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              memberCode: card?.memberCode,
              amount: Number(payAmount),
              paymentId: response.razorpay_payment_id
            }),
          });
          
          const data = await verifyRes.json();
          
          if (verifyRes.ok) {
            // Update Card State Immediately
            if (data.card) setCard(data.card);

            if (data.stampAdded) {
               // Success: 1 Stamp Added
               setToast({ message: "Payment Successful! 1 Stamp Added. 🎉", type: "success", duration: 4000 });
            } else {
               // Logic for NO stamp added (Low amount or Limit reached)
               if (data.reason === "low_amount") {
                 // ** Specific Message for < 1000 **
                 setToast({ 
                   message: "Sorry, stamp be availed if price is 1000. Make it next time!", 
                   type: "info",
                   duration: 2000 // Disappears after 2 seconds
                 });
               } else if (data.reason === "limit_reached") {
                 setToast({ message: "Payment successful! 12th stamp must be claimed manually.", type: "info", duration: 3500 });
               } else {
                 setToast({ message: "Payment successful.", type: "success" });
               }
            }
          } else {
             setToast({ message: data.message || "Payment succeeded but stamp update failed.", type: "error" });
          }
        } catch (err) {
          console.error("Backend stamp error", err);
          setToast({ message: "Network error. Please contact Admin.", type: "error" });
        } finally {
          setIsPaying(false);
          setPayAmount("");
        }
      },
      prefill: {
        name: card?.name || "",
        contact: card?.phone || "",
      },
      theme: {
        color: "#d97706",
      },
    };

    try {
      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
      
      paymentObject.on('payment.failed', function (response){
          setToast({ message: "Payment Failed: " + response.error.description, type: "error" });
          setIsPaying(false);
      });

    } catch (error) {
      console.error("Payment Error:", error);
      setIsPaying(false);
    }
  };

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

          {/* ======================================================== */}
          {/* ✅ FIXED HOLDER INFO + RESPONSIVE BADGE UI ✅ */}
          {/* ======================================================== */}
          <div className="mb-6 flex flex-row items-end justify-between gap-2 relative">
            
            {/* LEFT SIDE: Name and Phone (Takes available space) */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-xs text-amber-100/70">Card Holder</p>
                <p className="text-base font-semibold truncate pr-1">{card?.name || "—"}</p>
              </div>

              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-xs text-amber-100/70">Phone:</span>
                <span className="font-mono text-sm">
                  {showPhone ? card?.phone : maskedPhone}
                </span>
                <button
                  aria-pressed={showPhone}
                  onClick={() => setShowPhone((s) => !s)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition"
                >
                  {showPhone ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {/* RIGHT SIDE: Animated Promo Badge (Scaled down on mobile to prevent overlap) */}
            <motion.div
              animate={{ 
                scale: [1, 1.02, 1],
                opacity: [0.95, 1, 0.95],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="flex-shrink-0 relative z-10"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-[#fbbf24] blur opacity-20 rounded-lg group-hover:opacity-30 transition"></div>
                <div className="relative px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 shadow-[0_0_15px_rgba(251,191,36,0.15)] backdrop-blur-sm">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#fbbf24]/80 font-bold mb-0.5 text-right leading-none whitespace-nowrap">
                    Unlocks after 11 stamps
                  </p>
                  <p className="text-[11px] sm:text-sm font-extrabold text-[#fbbf24] whitespace-nowrap leading-none shadow-black drop-shadow-md">
                    ₹2000 Food FREE ✨
                  </p>
                </div>
              </div>
            </motion.div>

          </div>
          {/* ======================================================== */}


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

                  const sizeClasses = isFinal ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10 md:h-12 md:w-12";
                  
                  let borderClasses = "";
                  if (filled) {
                    borderClasses = isFinal 
                        ? "border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)] bg-[#501914]" 
                        : "border-transparent bg-amber-100 shadow-md";
                  } else {
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

          {/* ======================================================== */}
          {/* ✅ PAYMENT SECTION (Razorpay + Auto Stamp) ✅ */}
          {/* ======================================================== */}
          <div className="rounded-2xl bg-gradient-to-br from-black/20 to-black/40 border border-amber-100/10 p-4 mb-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/10 p-1 rounded-md">💳</span>
                Make a Payment
              </h3>
              <span className="text-[10px] uppercase text-amber-100/40 tracking-wider">Secure</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-100/50 font-sans">₹</span>
                <input
                  type="number"
                  placeholder="Enter Amount"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  min="1"
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-black/20 border border-amber-100/20 text-amber-100 placeholder-amber-100/20 focus:outline-none focus:border-amber-400/60 focus:bg-black/40 transition-all font-mono"
                />
              </div>
              
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePayment}
                disabled={isPaying}
                className="relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-[#3d0f0b] font-bold text-sm shadow-lg shadow-amber-900/40 hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
              >
                {isPaying ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-[#3d0f0b]/30 border-t-[#3d0f0b] animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Pay Now"
                )}
              </motion.button>
            </div>
            
            {/* Quick Select Helper */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {[500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setPayAmount(amt.toString())}
                  className="px-3 py-1 rounded-lg border border-amber-100/10 bg-amber-100/5 text-xs text-amber-100/60 hover:bg-amber-100/10 hover:border-amber-100/30 transition"
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
          {/* ======================================================== */}


          {/* Info & actions */}
          <div className="text-xs text-amber-100/75 space-y-2">
            <p>
              Cash: Show at counter, Online: Pay using the box above. 
              <span className="font-semibold"> ₹1000 or more</span> earns{" "}
              <span className="font-semibold">1 stamp</span>.
            </p>
            <p>
              On your 12th visit, enjoy up to ₹2000 worth of food FREE.
              If the bill exceeds ₹2000, only the balance amount is payable.
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

      {/* ✅ NEW: Professional Toast Notification System ✅ */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md
              ${toast.type === 'success' ? 'bg-[#501914]/95 text-amber-100 border-amber-500/50' : 
                toast.type === 'error' ? 'bg-red-900/90 text-white border-red-500/50' : 
                'bg-gray-800/90 text-white border-white/10'}`}>
               <span className="text-2xl">{toast.type === 'success' ? '🎉' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
               <div className="flex-1">
                 <p className="text-sm font-medium leading-tight">{toast.message}</p>
               </div>
               <button onClick={()=>setToast(null)} className="opacity-50 hover:opacity-100">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}