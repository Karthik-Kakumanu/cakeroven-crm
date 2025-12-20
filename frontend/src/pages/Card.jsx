// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx (Final Version - Full Text Restored)
 * - Main Card: Stamps, Payment, and ALL Rules/Instructions.
 * - Second Card: Journey History (Separate box below).
 * - Logic: Auto-detects Payment Keys, Handles History Table.
 */

// --- Helpers ---
function getIstDate(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist;
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatTime(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function getHolidayInfoForIst(dateIst) {
  const month = dateIst.getUTCMonth();
  const day = dateIst.getUTCDate();

  if (month === 11 && day === 25) {
    return {
      isHoliday: true,
      key: "christmas",
      title: "🎄 Happy Christmas",
      message: "Sorry for the inconvenience on Christmas day. Stamp access is temporarily unavailable.",
    };
  }

  if ((month === 11 && day === 31) || (month === 0 && day === 1)) {
    return {
      isHoliday: true,
      key: "newyear",
      title: "🎉 Happy New Year",
      message: "We're celebrating the New Year! Stamp access is temporarily unavailable.",
    };
  }

  return { isHoliday: false };
}

// --- Razorpay Loader ---
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

  // Notification State
  const [toast, setToast] = useState(null); 

  const isMountedRef = useRef(true);

  // Auto-dismiss Toast
  useEffect(() => {
    if (toast) {
      const duration = toast.duration || 3500;
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
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

  // Sync URL
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location?.search) {
        const url = new URL(window.location.href);
        if (url.searchParams.has("member")) {
          url.searchParams.delete("member");
          window.history.replaceState({}, "", url.pathname);
        }
      }
    } catch (e) {}
  }, []);

  // Load Card
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
        const url = `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(phone)}`;
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
  // Get history safely
  const history = Array.isArray(card?.history) ? card.history : [];
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

  // --- Payment Handler ---
  const handlePayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) {
      setToast({ message: "Please enter a valid amount.", type: "error" });
      return;
    }

    let keyId = null;
    try {
        // eslint-disable-next-line
        if (import.meta.env && import.meta.env.VITE_RAZORPAY_KEY_ID) {
            keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
        }
    } catch (e) { /* Ignore */ }

    if (!keyId) {
        try {
            if (process.env.REACT_APP_RAZORPAY_KEY_ID) {
                keyId = process.env.REACT_APP_RAZORPAY_KEY_ID;
            }
        } catch (e) { /* Ignore */ }
    }

    if (!keyId) {
      setToast({ message: "System Error: Payment Key Missing.", type: "error" });
      return;
    }

    setIsPaying(true);

    const res = await loadRazorpayScript();
    if (!res) {
      setToast({ message: "Razorpay SDK failed. Check internet.", type: "error" });
      setIsPaying(false);
      return;
    }

    try {
        const orderRes = await fetch(`${API_BASE}/api/customer/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: Number(payAmount) }),
        });

        const orderData = await orderRes.json();

        if (!orderData.success) {
            throw new Error(orderData.message || "Could not create order ID");
        }

        const options = {
          key: keyId, 
          amount: orderData.amount, 
          currency: orderData.currency,
          name: "CakeRoven",
          description: "Loyalty Stamp Payment",
          image: `${window.location.origin}/cakeroven-logo.png`, 
          order_id: orderData.orderId,
          
          handler: async function (response) {
            try {
              const verifyRes = await fetch(`${API_BASE}/api/customer/add-online-stamp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  memberCode: card?.memberCode,
                  amount: Number(payAmount),
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id, 
                  signature: response.razorpay_signature
                }),
              });
              
              const data = await verifyRes.json();
              
              if (verifyRes.ok) {
                if (data.card) setCard(data.card);
                if (data.stampAdded) {
                   setToast({ message: "Payment Successful! 1 Stamp Added.", type: "success" });
                } else {
                   if (data.reason === "low_amount") {
                     setToast({ message: "Payment success, but <1000. No stamp.", type: "info" });
                   } else if (data.reason === "limit_reached") {
                     setToast({ message: "Payment success! 12th stamp is manual.", type: "info" });
                   } else {
                     setToast({ message: "Payment successful.", type: "success" });
                   }
                }
                setTimeout(() => window.location.reload(), 2000);
              } else {
                 setToast({ message: data.message || "Payment failed.", type: "error" });
              }
            } catch (err) {
              console.error("Backend stamp error", err);
              setToast({ message: "Network error.", type: "error" });
            } finally {
              setIsPaying(false);
              setPayAmount("");
            }
          },
          modal: {
            ondismiss: function() {
              setIsPaying(false);
              setToast({ message: "Payment cancelled.", type: "error" });
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

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
        
        paymentObject.on('payment.failed', function (response){
            setToast({ message: "Payment Failed.", type: "error" });
            setIsPaying(false);
        });

    } catch (error) {
      console.error("Payment Error:", error);
      setToast({ message: "Could not initiate payment.", type: "error" });
      setIsPaying(false);
    }
  };

  const memberCode = card?.memberCode || card?.member_code || "—";
  const maskedPhone = card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";
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

  // --- Views ---
  if (holiday?.isHoliday) {
    const { title, message } = holiday;
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center p-6">
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6 text-center">
          <div className="flex items-center justify-center mb-4"><span style={{ fontSize: 28 }}>{holiday.key === "christmas" ? "🎄" : "🎉"}</span></div>
          <h2 className="text-2xl font-extrabold text-amber-900 mb-2">{title}</h2>
          <p className="text-sm text-amber-800/90 mb-4">{message}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-amber-700 text-white rounded-full">Refresh</button>
        </motion.section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-sm p-5 rounded-2xl bg-[#3a0f0b] shadow-xl text-amber-100 animate-pulse">
          <p className="text-center text-xs">Loading card...</p>
        </div>
      </main>
    );
  }

  if (error && !card) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm p-6 rounded-2xl bg-white border border-amber-200 shadow-lg text-amber-900">
          <h3 className="text-lg font-semibold mb-2">Error</h3>
          <p className="text-sm mb-4">{error}</p>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-amber-600 text-white rounded-full">Retry</button>
            <button onClick={handleSwitchUser} className="px-4 py-2 border border-amber-600 rounded-full">Switch</button>
          </div>
        </div>
      </main>
    );
  }

  // --- Main Layout ---
  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Rain */}
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.img
            key={i}
            src="/cakeroven-logo.png"
            alt=""
            className="absolute w-12 h-12 md:w-16 md:h-16 object-contain"
            initial={{ y: -150, x: `${Math.random() * 100}vw`, opacity: 0 }}
            animate={{ y: "55vh", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 5 + Math.random() * 5, delay: i * 0.8, repeat: Infinity, ease: "linear" }}
            style={{ left: `${Math.random() * 100}%`, filter: "brightness(0.9) opacity(0.5)" }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm md:max-w-xl relative z-10 flex flex-col gap-6">
        
        {/* ======================================================== */}
        {/* ✅ CARD 1: STAMP CARD (Top) ✅ */}
        {/* ======================================================== */}
        <motion.section initial="hidden" animate="enter" variants={page} className="relative z-10 mx-auto w-full bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-lg text-amber-100 p-4 sm:p-6 md:p-8 overflow-hidden">
          {/* Decorative Glows */}
          <div className="absolute -left-6 -top-10 w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />
          <div className="absolute -right-8 bottom-[-30px] w-36 h-36 rounded-full bg-amber-100/6 blur-2xl opacity-70 pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {logoInlineVisible && <img src={inlineLogoSrc} onError={handleInlineLogoError} className="h-10 w-10 rounded-full object-contain bg-white/3 p-1 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs tracking-widest uppercase text-amber-100/65">CAKEROVEN LOYALTY</p>
                <h1 className="text-lg sm:text-xl font-extrabold leading-tight mt-1">Digital Stamp Card</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-amber-100/60">Member ID</p>
              <p className="text-sm font-mono font-semibold mt-1">{memberCode}</p>
            </div>
            {/* ⚠️ Payment Warning Message */}
<div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
  <p className="font-semibold flex items-center gap-2">
    ⚠️ Important Payment Notice
  </p>
  <p className="mt-1 leading-relaxed text-amber-100/90">
    After completing payment, please <span className="font-semibold">do not press Back</span>, 
    <span className="font-semibold"> do not refresh</span>, or 
    <span className="font-semibold"> close this page</span>.
  </p>
  <p className="mt-1 leading-relaxed text-amber-100/80">
    Your payment will be securely verified and accepted by the website automatically.
  </p>
</div>

          </div>

          {/* User Info */}
          <div className="mb-6 flex flex-row items-end justify-between gap-2 relative">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-xs text-amber-100/70">Card Holder</p>
                <p className="text-base font-semibold truncate pr-1">{card?.name || "—"}</p>
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-xs text-amber-100/70">Phone:</span>
                <span className="font-mono text-sm">{showPhone ? card?.phone : maskedPhone}</span>
                <button onClick={() => setShowPhone(!showPhone)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-amber-100/20 hover:bg-amber-100/6 transition">{showPhone ? "HIDE" : "SHOW"}</button>
              </div>
            </div>
            <motion.div animate={{ scale: [1, 1.02, 1], opacity: [0.95, 1, 0.95] }} transition={{ duration: 2.5, repeat: Infinity }} className="flex-shrink-0 relative z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-[#fbbf24] blur opacity-20 rounded-lg group-hover:opacity-30 transition"></div>
                <div className="relative px-2.5 py-1.5 border border-[#fbbf24]/40 bg-[#fbbf24]/10 shadow-[0_0_15px_rgba(251,191,36,0.15)] backdrop-blur-sm rounded-xl">
                  <p className="text-[9px] uppercase text-[#fbbf24]/80 font-bold mb-0.5 text-right">Unlocks after 11</p>
                  <p className="text-sm font-extrabold text-[#fbbf24]">₹2000 Food FREE ✨</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stamps Grid */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 font-mono text-sm">{stamps}/12</span>
              <p className="text-xs text-amber-100/80">{isRewardReady ? "Reward unlocked! Claim below." : "stamps to your next treat."}</p>
            </div>
            <div className="text-xs px-2 py-1 rounded-full bg-amber-100/8 border border-amber-100/20 whitespace-nowrap">PAY ₹1000+ = 1 STAMP</div>
          </div>

          <div className="rounded-2xl bg-[#3d0f0b]/60 border border-amber-100/6 p-3 mb-3 relative">
            <div className="grid grid-cols-4 gap-3 justify-center">
              <AnimatePresence initial={false}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  const isFinal = index === 12;
                  const sizeClasses = isFinal ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10 md:h-12 md:w-12";
                  const borderClasses = filled ? (isFinal ? "border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)] bg-[#501914]" : "border-amber-200 bg-amber-100 shadow-md") : (isFinal ? "border-amber-400/50 bg-amber-400/5 shadow-[0_0_10px_rgba(251,191,36,0.2)]" : "border-amber-100/20 bg-transparent hover:bg-amber-100/6");

                  return (
                    <motion.div key={index} initial="hidden" animate={filled ? "filledPulse" : "show"} variants={stampVariants} custom={i} className={`relative flex items-center justify-center rounded-full border transition-all ${sizeClasses} ${borderClasses}`}>
                      {filled ? (
                          <div className="relative w-full h-full p-1.5 flex items-center justify-center">
                           <motion.img src="/cakeroven-logo.png" alt="Stamped" className="w-full h-full object-contain drop-shadow-sm" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} />
                           {isFinal && <div className="absolute inset-0 rounded-full border-2 border-amber-300 animate-ping opacity-20" />}
                        </div>
                      ) : (
                        <span className={`font-semibold pointer-events-none select-none ${isFinal ? "text-xl" : "text-xs md:text-sm"} text-amber-100/80`}>{isFinal ? "🎁" : index}</span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Payment Section */}
          <div className="rounded-2xl bg-gradient-to-br from-black/20 to-black/40 border border-amber-100/10 p-4 mb-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-amber-100 flex items-center gap-2"><span className="bg-amber-500/10 p-1 rounded-md">💳</span> Make a Payment</h3>
              <span className="text-[10px] uppercase text-amber-100/40 tracking-wider">Secure</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-100/50 font-sans">₹</span>
                <input type="number" placeholder="Enter Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} min="1" className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-black/20 border border-amber-100/20 text-amber-100 placeholder-amber-100/20 focus:outline-none focus:border-amber-400/60 focus:bg-black/40 transition-all font-mono" />
              </div>

              {/* ⚠️ Processing Warning (Only during payment) */}
{isPaying && (
  <div className="mb-2 w-full text-center text-[11px] font-semibold text-amber-300 animate-pulse">
    ⏳ Payment is being processed…  
    Please do not refresh, go back, or close this page.
  </div>
)}

              <motion.button whileTap={{ scale: 0.97 }} onClick={handlePayment} disabled={isPaying} className="relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-[#3d0f0b] font-bold text-sm shadow-lg shadow-amber-900/40 hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]">
                {isPaying ? <><div className="h-4 w-4 rounded-full border-2 border-[#3d0f0b]/30 border-t-[#3d0f0b] animate-spin" /><span>Wait...</span></> : "Pay Now"}
              </motion.button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {[500, 1000, 2000, 5000].map((amt) => (
                <button key={amt} onClick={() => setPayAmount(amt.toString())} className="px-3 py-1 rounded-lg border border-amber-100/10 bg-amber-100/5 text-xs text-amber-100/60 hover:bg-amber-100/10 hover:border-amber-100/30 transition">₹{amt}</button>
              ))}
            </div>
          </div>

          {/* ✅ RESTORED ALL TEXT ✅ */}
          <div className="text-xs text-amber-100/75 space-y-2">
            <p>
              Cash: Show at counter, Online: Pay using the box above. <span className="font-semibold">₹1000 or more</span> earns <span className="font-semibold">1 stamp</span>.
            </p>
            <p>
              On your 12th visit, enjoy up to ₹2000 worth of food FREE. If the bill exceeds ₹2000, only the balance amount is payable. Unused free value does not carry forward.
            </p>
            <p>
              Only 1 bill = 1 stamp. No bill splitting allowed.
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button onClick={handleSwitchUser} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-100/20 text-xs hover:bg-amber-100/6 transition">Not you? Switch user</button> 
              {isRewardReady && <motion.button onClick={() => { setCelebrate(true); setTimeout(() => setCelebrate(false), 1200); }} className="ml-auto px-3 py-1.5 rounded-full bg-amber-100/10 border border-amber-100/30 text-xs">🎉 Claim Reward</motion.button>}
            </div>
            <p>
              * Conditions apply on 25th Dec & 31st Dec - 1st Jan.
            </p> 
          </div>

          {/* Celebrate Overlay */}
          <AnimatePresence>
            {celebrate && (
              <motion.div key="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-amber-100/10" />
                <div className="absolute inset-0 flex justify-center items-center"><span className="text-6xl">🎉</span></div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ======================================================== */}
        {/* ✅ CARD 2: JOURNEY HISTORY (Separate Box Below) ✅ */}
        {/* ======================================================== */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }}
          className="relative z-10 w-full bg-gradient-to-b from-[#2a0a08]/90 to-[#1a0504]/90 rounded-3xl border border-amber-500/20 shadow-2xl backdrop-blur-md overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-amber-500/10 bg-[#3d0f0b]/40 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-100/90 flex items-center gap-2">
              <span className="text-amber-400 text-base">📜</span> Journey History
            </h3>
            <span className="text-[10px] text-amber-100/40 bg-black/20 px-2 py-1 rounded-full">Current Cycle</span>
          </div>

          {/* List */}
          <div className="p-3 max-h-[350px] overflow-y-auto custom-scrollbar">
            {history && history.length > 0 ? (
              <div className="space-y-2">
                {history.map((tx, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                  >
                    {/* Left: Index & Date */}
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#3d0f0b] font-bold font-mono text-base shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform border border-amber-200/30">
                        {tx.stamp_index || idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-amber-100/90">
                          {formatDate(tx.created_at)}
                        </span>
                        <span className="text-[11px] text-amber-100/50">
                          {formatTime(tx.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div className="text-right">
                      <span className="block font-mono text-base font-bold text-amber-400">
                        ₹{tx.amount || 0}
                      </span>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-green-500/10 text-green-400 border border-green-500/20">
                        Paid
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center flex flex-col items-center gap-3 opacity-50">
                <div className="text-4xl grayscale brightness-75">🏺</div>
                <p className="text-sm text-amber-100/60">No stamps collected yet.<br/>Start your journey!</p>
              </div>
            )}
          </div>
          
          {/* Total Footer */}
          {history.length > 0 && (
            <div className="px-5 py-3 bg-black/30 border-t border-amber-500/10 flex justify-between items-center text-xs font-medium">
              <span className="text-amber-100/60 uppercase tracking-widest">Total Spent</span>
              <span className="font-mono text-lg font-bold text-amber-400">
                ₹{history.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)}
              </span>
            </div>
          )}
        </motion.section>

      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 20, x: "-50%" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="fixed bottom-10 left-1/2 z-50 w-[90%] max-w-[360px]">
            <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${toast.type === 'success' ? 'bg-[#501914]/95 text-amber-100 border-amber-500/50' : toast.type === 'error' ? 'bg-red-900/90 text-white border-red-500/50' : 'bg-gray-800/95 text-white border-white/10'}`}>
              <span className="text-2xl flex-shrink-0">{toast.type === 'success' ? '🎉' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
              <div className="flex-1"><p className="text-sm font-medium leading-snug">{toast.message}</p></div>
              <button onClick={()=>setToast(null)} className="opacity-50 hover:opacity-100 p-1">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}