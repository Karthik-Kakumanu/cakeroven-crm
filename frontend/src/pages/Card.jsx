import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";


export default function Card() {
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let memberCode = params.get("member");

    if (!memberCode) {
      memberCode = localStorage.getItem("cr_memberCode");
    }

    if (!memberCode) {
      navigate("/register", { replace: true });
      return;
    }

    async function fetchCard() {
      try {
        const res = await fetch(`${API_BASE}/api/customer/card/${memberCode}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || "Unable to load card.");
        } else {
          setCard(data.card);
        }
      } catch (err) {
        console.error(err);
        setError("Server error. Please try again.");
      }
    }

    fetchCard();
  }, [location.search, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] text-[#501914] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-xs">
          <p>{error}</p>
          <button
            onClick={() => navigate("/register")}
            className="px-4 py-2 rounded-xl bg-[#501914] text-[#f5e6c8] font-semibold"
          >
            Go to Register
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] text-[#501914] flex items-center justify-center">
        <p>Loading your CakeRoven card…</p>
      </div>
    );
  }

  // mask phone – show only last 3 digits
  const maskedPhone =
    card.phone?.replace(/.(?=.{3})/g, "•") || "";

  const stamps = card.currentStamps ?? 0;
  const stampsLeft = Math.max(12 - stamps, 0);

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[28px] shadow-[0_20px_45px_rgba(0,0,0,0.45)] overflow-hidden bg-gradient-to-b from-[#61211b] to-[#3b120f] text-[#f5e6c8] relative">
        {/* top glow */}
        <div className="absolute inset-x-0 -top-10 h-16 bg-gradient-to-b from-[#f5e6c8]/50 to-transparent opacity-60 pointer-events-none" />

        <div className="relative p-6 space-y-4">
          {/* header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#f5e6c8]/70">
                CakeRoven Loyalty
              </p>
              <h1 className="text-xl font-bold">
                Digital Stamp Card
              </h1>
            </div>

            <div className="text-right text-[11px] text-[#f5e6c8]/80">
              <p className="uppercase tracking-[0.15em] text-[9px]">
                Member ID
              </p>
              <p className="font-mono font-bold text-xl tracking-wide">
                {card.memberCode}
              </p>
            </div>
          </div>

          {/* holder info */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-[#f5e6c8]/70">
              Card Holder
            </p>
            <p className="text-lg font-semibold leading-none">
              {card.name}
            </p>

            {/* phone: hidden / show toggle */}
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-[#f5e6c8]/70">
                Phone:
              </span>
              <span className="font-mono">
                {showPhone ? card.phone : maskedPhone}
              </span>
              <button
                type="button"
                onClick={() => setShowPhone((v) => !v)}
                className="ml-1 px-2 py-0.5 rounded-full border border-[#f5e6c8]/40 text-[10px] uppercase tracking-wide hover:bg-[#f5e6c8]/10 transition"
              >
                {showPhone ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* progress + rule badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border border-[#f5e6c8]/40 flex items-center justify-center text-[11px] font-semibold">
                {stamps}/12
              </div>
              <div className="text-[11px] leading-snug text-[#f5e6c8]/80">
                <p>
                  {stampsLeft === 0
                    ? "Reward ready! Use at counter."
                    : `${stampsLeft} stamp${stampsLeft === 1 ? "" : "s"} to your next treat.`}
                </p>
              </div>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30 text-[10px] uppercase tracking-wide">
              Pay ₹500+ = 1 stamp
            </div>
          </div>

          {/* divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#f5e6c8]/20 to-transparent my-2" />

          {/* stamp box */}
<div className="mt-2 rounded-2xl bg-[#f5e6c8]/5 border border-[#f5e6c8]/25 px-4 py-3 space-y-2 shadow-[0_0_18px_rgba(0,0,0,0.35)]">
  {/* box header */}
  <div className="flex items-center justify-between gap-2">
    <p className="text-[12px] text-[#f5e6c8]/90">
      Collect <span className="font-semibold">12 stamps</span> to unlock a
      special CakeRoven treat 🎁
    </p>
    <span className="text-[10px] px-2 py-2 rounded-full bg-[#501914]/60 border border-[#f5e6c8]/60 font-semibold uppercase tracking-wide">
      Board
    </span>
  </div>

  {/* circles grid */}
  <div className="grid grid-cols-4 gap-3 pt-2">
    {Array.from({ length: 12 }).map((_, idx) => {
      const filled = idx < stamps;
      return (
        <div
          key={idx}
          className={`w-11 h-11 rounded-full flex items-center justify-center border-[1.8px] text-xs font-semibold transition-transform duration-150
          ${
            filled
              ? "bg-[#f5e6c8] text-[#501914] border-[#f5e6c8] shadow-[0_0_12px_rgba(0,0,0,0.6)] scale-105"
              : "border-[#f5e6c8]/40 text-[#f5e6c8]/60 bg-transparent"
          }`}
        >
          {filled ? "★" : idx + 1}
        </div>
      );
    })}
  </div>
</div>


          {/* footer instructions */}
          <div className="pt-3 space-y-1.5 text-[11px] text-[#f5e6c8]/70">
            <p>
              Show this card at the counter after each visit.{" "}
              <span className="font-semibold text-[#f5e6c8]">
                Every bill of ₹500 or more earns 1 stamp.
              </span>
            </p>
            <p>
              After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
