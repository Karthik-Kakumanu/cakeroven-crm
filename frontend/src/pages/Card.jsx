// frontend/src/pages/Card.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function Card() {
  const navigate = useNavigate();

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);

  // Optional: if someone manually types ?member=CR0002 in URL,
  // we strip it out so the path is always just /card.
  useEffect(() => {
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

    const fetchCard = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(
            phone
          )}`
        );

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || "Could not load card");
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          navigate("/start", { replace: true });
          return;
        }

        setCard(data.card || data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("Server error while loading your card");
        navigate("/start", { replace: true });
      }
    };

    fetchCard();
  }, [navigate]);

  const handleSwitchUser = () => {
    localStorage.removeItem("cr_memberCode");
    localStorage.removeItem("cr_phone");
    navigate("/start", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center">
        <p className="text-[#501914] text-sm">Loading your card…</p>
      </div>
    );
  }

  if (!card) return null;

  const memberCode = card.memberCode || card.member_code;
  const stamps = card.currentStamps ?? card.current_stamps ?? 0;
  const rewards = card.totalRewards ?? card.total_rewards ?? 0;
  const isRewardReady = stamps === 12;

  const maskedPhone =
    card.phone && card.phone.length >= 3
      ? "••••••" + card.phone.slice(-3)
      : "••••••••••";

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-[32px] shadow-[0_30px_75px_rgba(0,0,0,0.65)] text-[#f5e6c8] p-6 relative overflow-hidden">
        {/* Glows */}
        <div className="absolute -top-16 right-[-40px] w-40 h-40 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-30px] left-[-30px] w-36 h-36 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        {/* Header row */}
        <div className="relative z-10 flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#f5e6c8]/70">
              CAKEROVEN LOYALTY
            </p>
            <h1 className="text-xl font-extrabold mt-1">
              Digital Stamp Card
            </h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#f5e6c8]/60">
              Member ID
            </p>
            <p className="text-sm font-mono font-bold mt-0.5">{memberCode}</p>
          </div>
        </div>

        {/* Holder info */}
        <div className="relative z-10 mb-4 space-y-1">
          <p className="text-[11px] text-[#f5e6c8]/70">Card Holder</p>
          <p className="text-lg font-semibold truncate">{card.name}</p>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-[11px] text-[#f5e6c8]/70">Phone:</span>
            <span className="font-mono">
              {showPhone ? card.phone : maskedPhone}
            </span>
            <button
              onClick={() => setShowPhone((v) => !v)}
              className="ml-2 px-2 py-0.5 rounded-full text-[11px] border border-[#f5e6c8]/40 hover:bg-[#f5e6c8]/10 transition-colors"
            >
              {showPhone ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {/* Progress & rule chip */}
        <div className="relative z-10 mb-4 flex items-center justify-between text-[11px]">
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/25 font-mono text-[11px]">
              {stamps}/12
            </span>
            <span className="text-[#f5e6c8]/80">
              {isRewardReady
                ? "Reward unlocked! 🎉 Show this card to claim."
                : "stamps to your next treat."}
            </span>
          </div>
          <div className="text-[10px] px-2 py-1 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30 whitespace-nowrap">
            PAY ₹500+ = 1 STAMP
          </div>
        </div>

        {/* Stamp board */}
        <div className="relative z-10 mb-4 rounded-3xl bg-[#3d0f0b]/70 border border-[#f5e6c8]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-[#f5e6c8]/80">
              <p>
                Collect <span className="font-semibold">12 stamps</span> to
                unlock a special CakeRoven treat 🎁
              </p>
              {rewards > 0 && (
                <p className="mt-1 text-[#ffe8bf]/90">
                  Rewards earned so far:{" "}
                  <span className="font-semibold">{rewards}</span>
                </p>
              )}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">
              BOARD
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => {
              const index = i + 1;
              const filled = stamps >= index;

              return (
                <div
                  key={index}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold transition-all ${
                    filled
                      ? "bg-[#f5e6c8] text-[#501914] border-transparent shadow-[0_0_12px_rgba(0,0,0,0.5)] scale-[1.03]"
                      : "border-[#f5e6c8]/35 text-[#f5e6c8]/80"
                  }`}
                >
                  {index}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer text + switch user */}
        <div className="relative z-10 flex flex-col gap-2 text-[10px] text-[#f5e6c8]/75">
          <p>
            Show this card at the counter after each visit. Every bill of{" "}
            <span className="font-semibold">₹500 or more</span> earns{" "}
            <span className="font-semibold">1 stamp</span>.
          </p>
          <p>
            After collecting 12 stamps, you’re eligible for a complimentary
            CakeRoven treat.
          </p>

          <button
            onClick={handleSwitchUser}
            className="self-start mt-1 px-2.5 py-1 rounded-full border border-[#f5e6c8]/40 text-[10px] text-[#f5e6c8]/80 hover:bg-[#f5e6c8]/10 transition-colors"
          >
            Not you? Switch user
          </button>
        </div>
      </div>
    </div>
  );
}
