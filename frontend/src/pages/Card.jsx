// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx
 * - Payment: Accepts ANY amount.
 * - Logic: 
 * - < 1000: No stamp, shows specific "Sorry" toast (2s).
 * - >= 1000: Adds stamp (unless 12th).
 * - UI: Responsive Badge, Toast Notification, Persistence.
 */

function getIstDate(now = new Date()) {
  return new Date(now.getTime() + 330 * 60 * 1000);
}

function getHolidayInfoForIst(dateIst) {
  const month = dateIst.getUTCMonth();
  const day = dateIst.getUTCDate();
  if (month === 11 && day === 25) return { isHoliday: true, title: "🎄 Happy Christmas", message: "Stamp access temporarily unavailable." };
  if ((month === 11 && day === 31) || (month === 0 && day === 1)) return { isHoliday: true, title: "🎉 Happy New Year", message: "Stamp access temporarily unavailable." };
  return { isHoliday: false };
}

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

  // Toast State { message, type, duration }
  const [toast, setToast] = useState(null);

  const isMountedRef = useRef(true);

  // Auto-dismiss Toast
  useEffect(() => {
    if (toast) {
      const duration = toast.duration || 3000;
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initial Checks
  useEffect(() => {
    isMountedRef.current = true;
    const checkHoliday = () => { setHoliday(getHolidayInfoForIst(getIstDate())); };
    checkHoliday();
    const id = setInterval(checkHoliday, 60000);
    return () => { clearInterval(id); isMountedRef.current = false; };
  }, []);

  // Fetch Card Data
  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");
    if (!memberCode || !phone) { navigate("/start", { replace: true }); return; }

    const controller = new AbortController();
    const fetchCard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(phone)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Unable to load card");
        const data = await res.json();
        if (isMountedRef.current) {
          setCard(data.card);
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== "AbortError" && isMountedRef.current) {
          setError("Server error loading card.");
          setLoading(false);
        }
      }
    };
    fetchCard();
    return () => controller.abort();
  }, [navigate]);

  const stamps = Number(card?.currentStamps || 0);
  const rewards = Number(card?.totalRewards || 0);
  const isRewardReady = stamps >= 12;

  useEffect(() => {
    if (isRewardReady) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
  }, [isRewardReady]);

  // --- Payment Handler ---
  const handlePayment = async () => {
    // 1. Validation (Allows < 1000)
    if (!payAmount || Number(payAmount) <= 0) {
      setToast({ message: "Please enter a valid amount.", type: "error" });
      return;
    }

    setIsPaying(true);
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setToast({ message: "Network error. Check connection.", type: "error" });
      setIsPaying(false);
      return;
    }

    const options = {
      key: "rzp_test_1DP5mmOlF5G5ag", // Test Key
      amount: Number(payAmount) * 100, // Paise
      currency: "INR",
      name: "CakeRoven",
      description: "Loyalty Payment",
      image: `${window.location.origin}/cakeroven-logo.png`,
      
      handler: async function (response) {
        try {
          // Call backend
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
            // Update Card State (Immediate Persistence)
            if (data.card) setCard(data.card);

            if (data.stampAdded) {
               // Success: 4 seconds toast
               setToast({ message: "Payment Successful! 1 Stamp Added. 🎉", type: "success", duration: 4000 });
            } else {
               // Logic for NO stamp
               if (data.reason === "low_amount") {
                 // ** SPECIFIC MESSAGE requested by user **
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
             setToast({ message: "Server error updating stamp.", type: "error" });
          }
        } catch (err) {
          console.error(err);
          setToast({ message: "Network error. Show Payment ID to Admin.", type: "error" });
        } finally {
          setIsPaying(false);
          setPayAmount("");
        }
      },
      prefill: {
        name: card?.name || "",
        contact: card?.phone || "",
      },
      theme: { color: "#d97706" },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
      rzp.on('payment.failed', function () {
          setToast({ message: "Payment Cancelled or Failed.", type: "error" });
          setIsPaying(false);
      });
    } catch (error) {
      setIsPaying(false);
    }
  };

  // --- Render Helpers ---
  const memberCode = card?.memberCode || "—";
  const maskedPhone = card?.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";
  const stampVariants = {
    hidden: { scale: 0.92, opacity: 0 },
    show: (i) => ({ scale: 1, opacity: 1, transition: { delay: i * 0.02 } }),
    filledPulse: { scale: [1, 1.15, 1], transition: { duration: 0.5 } },
  };

  if (holiday?.isHoliday) return <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6 text-center text-amber-900 font-bold">{holiday.title}<br/>{holiday.message}</div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50 text-amber-900">Loading card...</div>;
  if (error && !card) return <div className="min-h-screen flex items-center justify-center bg-amber-50 text-red-600">{error}</div>;

  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Animation */}
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.img key={i} src="/cakeroven-logo.png" className="absolute w-12 h-12 opacity-20"
            initial={{ y: -100, x: Math.random() * 100 + "vw" }}
            animate={{ y: "100vh" }}
            transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <motion.section initial="hidden" animate="enter" variants={{ hidden: { opacity: 0, y: 10 }, enter: { opacity: 1, y: 0 } }} 
        className="w-full max-w-sm md:max-w-xl relative z-10">
        
        <div className="relative z-10 mx-auto bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl shadow-lg text-amber-100 p-5 sm:p-6 md:p-8 overflow-hidden">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-3 items-center">
              {logoInlineVisible && <img src="/cakeroven-logo.png" className="w-10 h-10 rounded-full bg-white/10 p-1" onError={() => setLogoInlineVisible(false)} alt="logo" />}
              <div>
                <h1 className="text-xl font-bold leading-tight">Digital Stamp Card</h1>
                <p className="text-xs text-amber-100/60 uppercase tracking-widest">CakeRoven Loyalty</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-100/60 uppercase">Member ID</p>
              <p className="text-sm font-mono font-bold">{memberCode}</p>
            </div>
          </div>

          {/* User Info & Badge */}
          <div className="flex items-end justify-between mb-6 relative">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-100/70">Card Holder</p>
              <p className="font-bold text-lg truncate pr-2">{card?.name}</p>
              <p className="text-sm font-mono text-amber-100/80 mt-1">
                {showPhone ? card?.phone : maskedPhone} 
                <button onClick={() => setShowPhone(!showPhone)} className="ml-2 text-[10px] border border-amber-100/30 px-1 rounded hover:bg-white/10">
                  {showPhone ? "HIDE" : "SHOW"}
                </button>
              </p>
            </div>
            
            {/* Responsive Badge */}
            <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="flex-shrink-0 relative z-10">
              <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/40 shadow-[0_0_15px_rgba(251,191,36,0.2)] backdrop-blur-sm text-right">
                <p className="text-[9px] sm:text-[10px] text-[#fbbf24]/80 font-bold uppercase mb-0.5 whitespace-nowrap">Unlocks after 11 stamps</p>
                <p className="text-[11px] sm:text-sm font-extrabold text-[#fbbf24] shadow-black drop-shadow-md whitespace-nowrap">₹2000 Food FREE ✨</p>
              </div>
            </motion.div>
          </div>

          {/* Progress */}
          <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-100/10 border border-amber-100/20 px-2 py-0.5 rounded-full text-sm font-mono">{stamps}/12</span>
              <span className="text-xs text-amber-100/80">{isRewardReady ? "Reward Unlocked!" : "stamps to next treat"}</span>
            </div>
            <span className="text-[10px] bg-amber-100/10 border border-amber-100/20 px-2 py-1 rounded-full whitespace-nowrap">PAY ₹1000+ = 1 STAMP</span>
          </div>

          {/* Board */}
          <div className="bg-[#3d0f0b]/60 border border-amber-100/10 rounded-2xl p-4 mb-4 grid grid-cols-4 gap-3 relative">
             <AnimatePresence>
                {Array.from({length: 12}).map((_, i) => {
                   const idx = i + 1;
                   const filled = stamps >= idx;
                   const isFinal = idx === 12;
                   return (
                      <motion.div key={idx} 
                        initial="hidden" animate={filled ? "filledPulse" : "show"} variants={stampVariants} custom={i}
                        className={`aspect-square rounded-full flex items-center justify-center border transition-all
                           ${filled ? (isFinal ? "bg-[#501914] border-amber-300 shadow-[0_0_10px_orange]" : "bg-amber-100 border-transparent") : "bg-transparent border-amber-100/20"}
                        `}>
                         {filled ? (
                            <motion.img src="/cakeroven-logo.png" className="w-full h-full object-contain p-1.5" 
                              initial={{scale:0}} animate={{scale:1}} />
                         ) : (
                            <span className="text-amber-100/30 font-bold">{isFinal ? "🎁" : idx}</span>
                         )}
                      </motion.div>
                   )
                })}
             </AnimatePresence>
          </div>

          {/* Payment Section */}
          <div className="bg-black/20 border border-amber-100/10 rounded-2xl p-4 mb-4 backdrop-blur-sm">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">💳 Make a Payment</h3>
                <span className="text-[10px] opacity-50 uppercase tracking-widest">Secure</span>
             </div>
             <div className="flex gap-2">
                <div className="relative flex-1">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-100/50">₹</span>
                   <input type="number" placeholder="Enter Amount" value={payAmount} onChange={e=>setPayAmount(e.target.value)}
                      className="w-full bg-black/30 border border-amber-100/20 rounded-xl py-2 pl-8 pr-3 text-amber-100 focus:border-amber-400 outline-none placeholder-amber-100/30" />
                </div>
                <button onClick={handlePayment} disabled={isPaying}
                   className="bg-gradient-to-r from-amber-400 to-amber-600 text-[#3d0f0b] font-bold px-4 py-2 rounded-xl shadow-lg hover:brightness-110 disabled:opacity-50 whitespace-nowrap min-w-[100px]">
                   {isPaying ? "..." : "Pay Now"}
                </button>
             </div>
             <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {[500, 1000, 2000, 5000].map(amt => (
                   <button key={amt} onClick={()=>setPayAmount(amt.toString())} className="text-[10px] bg-amber-100/5 border border-amber-100/10 px-3 py-1.5 rounded-lg hover:bg-amber-100/10 transition whitespace-nowrap">₹{amt}</button>
                ))}
             </div>
          </div>

          <p className="text-xs text-center opacity-60">
             Cash: Show at counter. Online: Use box above. <br/>
             12th Stamp must be claimed in-store manually.
          </p>

        </div>
      </motion.section>

      {/* Professional Toast Notification System */}
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