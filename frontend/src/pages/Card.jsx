// frontend/src/pages/Card.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

const logoSrc = "/cakeroven-logo.png"; // Place your logo in public/

export default function Card() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState(null);

  // remove ?member=... from URL if present
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
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
    mountedRef.current = true;
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    async function fetchCard() {
      try {
        setLoading(true);
        setError(null);

        const url =
          API_BASE +
          "/api/customer/card/" +
          encodeURIComponent(memberCode) +
          "?phone=" +
          encodeURIComponent(phone);

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => null);

        if (!mountedRef.current) return;

        if (!res.ok) {
          const msg = (data && data.message) || "Could not load card";
          setError(msg);
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          navigate("/start", { replace: true });
          return;
        }

        setCard(data && data.card ? data.card : data);
      } catch (err) {
        if (err && err.name === "AbortError") {
          setError("Request timed out. Please try again.");
        } else {
          console.error(err);
          setError("Server error while loading your card");
        }
        localStorage.removeItem("cr_memberCode");
        localStorage.removeItem("cr_phone");
        navigate("/start", { replace: true });
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    fetchCard();

    return () => {
      mountedRef.current = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  // Derived values with fallbacks
  const memberCode = (card && (card.memberCode || card.member_code)) || "—";
  const stamps = Number(card && (card.currentStamps || card.current_stamps)) || 0;
  const rewards = Number(card && (card.totalRewards || card.total_rewards)) || 0;
  const isRewardReady = stamps >= 12;
  const maskedPhone =
    card && card.phone && card.phone.length >= 3
      ? "••••••" + card.phone.slice(-3)
      : "••••••••••";

  // Build aria label without template literals to avoid parsing issues
  const buildAriaLabel = function (index, filled) {
    return "Stamp " + index + " " + (filled ? "collected" : "empty");
  };

  // Card background style using logo as subtle background
  const cardBackgroundStyle = {
    backgroundImage: "url(" + logoSrc + ")",
    backgroundPosition: "12px 12px",
    backgroundRepeat: "no-repeat",
    backgroundSize: "88px",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] p-6 shadow-lg animate-pulse">
            <div className="h-6 bg-[#f5e6c8]/30 rounded w-2/3 mb-3" />
            <div className="h-4 bg-[#f5e6c8]/20 rounded w-1/3 mb-6" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-10 w-10 rounded-full bg-[#f5e6c8]/15" />
              ))}
            </div>
          </div>
          <p className="text-center text-sm text-[#501914] mt-4">Loading your card…</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#fbefd6] text-[#501914] font-semibold mb-4">
            No card found
          </div>
          <p className="text-[#501914]/90 mb-4">We couldn't find your stamp card. Please sign in again.</p>
          <button
            onClick={() => navigate("/start", { replace: true })}
            className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] text-sm font-medium hover:opacity-95 transition"
          >
            Go to Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div
          className="relative rounded-[28px] text-[#f5e6c8] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] overflow-hidden"
          style={cardBackgroundStyle}
        >
          {/* gradient overlay so logo background looks subtle */}
          <div className="absolute inset-0 rounded-[28px] bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] opacity-95" />

          {/* glows */}
          <div className="absolute -top-16 right-[-44px] w-44 h-44 bg-[#f5e6c8]/8 rounded-full blur-3xl" />
          <div className="absolute bottom-[-36px] left-[-36px] w-40 h-40 bg-[#f5e6c8]/8 rounded-full blur-3xl" />

          {/* content */}
          <div className="relative z-10">
            {/* header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* small visible logo */}
                <img
                  src={logoSrc}
                  alt="CakeRoven logo"
                  className="w-12 h-12 object-contain rounded-md bg-[#f5e6c8]/5 p-1"
                />
                <div>
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#f5e6c8]/70">CAKEROVEN LOYALTY</p>
                  <h1 className="text-lg font-extrabold mt-1">Digital Stamp Card</h1>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#f5e6c8]/60">Member ID</p>
                <p className="text-sm font-mono font-bold mt-1">{memberCode}</p>
              </div>
            </div>

            {/* holder */}
            <div className="mb-4 space-y-1">
              <p className="text-[11px] text-[#f5e6c8]/70">Card Holder</p>
              <p className="text-lg font-semibold truncate">{card.name || "—"}</p>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-[11px] text-[#f5e6c8]/70">Phone:</span>
                <span className="font-mono">{showPhone ? card.phone : maskedPhone}</span>

                <button
                  onClick={() => setShowPhone((v) => !v)}
                  className="ml-2 px-2 py-0.5 rounded-full text-[11px] border border-[#f5e6c8]/40 hover:bg-[#f5e6c8]/10 transition-colors"
                  aria-pressed={showPhone}
                >
                  {showPhone ? "HIDE" : "SHOW"}
                </button>
                {/* COPY removed as requested */}
              </div>
            </div>

            {/* progress */}
            <div className="mb-4 flex items-center justify-between text-[11px]">
              <div className="flex items-baseline gap-2">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/25 font-mono text-[11px]">
                  {stamps}/12
                </span>
                <span className="text-[#f5e6c8]/80">
                  {isRewardReady ? "Reward unlocked! 🎉 Show this card to claim." : "stamps to your next treat."}
                </span>
              </div>

              <div className="text-[10px] px-2 py-1 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30 whitespace-nowrap">
                PAY ₹1000+ = 1 STAMP
              </div>
            </div>

            {/* stamp board */}
            <div className="mb-4 rounded-3xl bg-[#3d0f0b]/70 border border-[#f5e6c8]/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] text-[#f5e6c8]/80 max-w-[65%]">
                  <p>
                    Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven gift.
                  </p>
                  {rewards > 0 && (
                    <p className="mt-1 text-[#ffe8bf]/90">
                      Rewards earned so far: <span className="font-semibold">{rewards}</span>
                    </p>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">BOARD</span>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => {
                  const index = i + 1;
                  const filled = stamps >= index;
                  const ariaLabel = buildAriaLabel(index, filled);
                  return (
                    <div
                      key={index}
                      className={
                        filled
                          ? "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-[#f5e6c8] text-[#501914] shadow"
                          : "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border border-[#f5e6c8]/35 text-[#f5e6c8]/80"
                      }
                      aria-label={ariaLabel}
                      role="img"
                    >
                      {filled ? "✓" : index}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* complimentary gift options */}
            <div className="mb-4 rounded-xl bg-[#42120f]/40 border border-[#f5e6c8]/10 p-4 text-[11px]">
              <p className="font-semibold mb-2">Complimentary gift options</p>
              <p className="text-sm mb-3">
                We offer three easy complimentary gift options. Choose one when you redeem:
              </p>

              <ul className="list-inside list-disc space-y-1 pl-4 mb-3">
                <li>gift hamper</li>
                <li>Cake</li>
              </ul>

              <p className="text-[#ffe8bf]/90 text-sm">
                These gifts are available as complimentary prizes when you unlock the reward — good, easy gift.
              </p>
            </div>

            {/* footer */}
            <div className="flex flex-col gap-2 text-[10px] text-[#f5e6c8]/75">
              <p>
                Show this card at the counter after each visit. Every bill of{" "}
                <span className="font-semibold">₹1000 or more</span> earns{" "}
                <span className="font-semibold">1 stamp</span>.
              </p>
              <p>
                After collecting 12 stamps, you’re eligible to claim one of the complimentary gifts listed above.
              </p>

              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleSwitchUser}
                  className="self-start px-2.5 py-1 rounded-full border border-[#f5e6c8]/40 text-[10px] text-[#f5e6c8]/80 hover:bg-[#f5e6c8]/10 transition-colors"
                >
                  Not you? Switch user
                </button>

                {/* No View Progress button as requested — keep a contextual claim alert button */}
                {isRewardReady && (
                  <button
                    onClick={() => {
                      // Simple confirmation flow; replace later with modal/toast
                      alert("🎉 Reward ready! You can claim one complimentary gift: 10% off, Rs. 2000 hamper, or half kg cake.");
                    }}
                    className="ml-auto px-3 py-1 rounded-full bg-[#ffe8bf] text-[#501914] text-sm font-medium hover:brightness-95 transition"
                  >
                    Claim Reward
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* local slow bounce animation (if you want a subtle logo move later) */}
      <style>{".animate-bounce-slow{animation: bounce 3s infinite;} @keyframes bounce {0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}"}</style>
    </div>
  );
}