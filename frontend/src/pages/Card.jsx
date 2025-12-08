import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../apiConfig";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Card() {
  const navigate = useNavigate();
  const query = useQuery();

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState("");
  const [highlightReward, setHighlightReward] = useState(false);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    // keep URL member in sync (for QR scans etc.)
    const linkMember = query.get("member");
    if (!linkMember || linkMember !== memberCode) {
      navigate(`/card?member=${memberCode}`, { replace: true });
      return;
    }

    const fetchCard = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}/api/customer/card`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberCode, phone }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.message || "Unable to load your card.");
          setLoading(false);
          return;
        }

        setCard(data.card);
      } catch (err) {
        console.error(err);
        setError("Server error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, [navigate, query]);

  useEffect(() => {
    if (!card) return;
    if (card.lastAction === "reward-earned") {
      setHighlightReward(true);
      const t = setTimeout(() => setHighlightReward(false), 1600);
      return () => clearTimeout(t);
    }
  }, [card]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8]">
        <div className="rounded-full border-4 border-[#501914]/20 border-t-[#501914] p-4 animate-spin" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5e6c8] px-4">
        <p className="mb-4 text-sm text-[#501914]">
          We couldn&apos;t find your CakeRoven card.
        </p>
        <button
          onClick={() => navigate("/register")}
          className="rounded-2xl bg-[#501914] px-5 py-2 text-sm font-semibold text-[#f5e6c8] shadow-md"
        >
          Register now
        </button>
      </div>
    );
  }

  const maskedPhone = `••••••${card.phone.slice(-4)}`;
  const stamps = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-[2.5rem] bg-[#501914] px-7 py-8 text-[#f5e6c8] shadow-[0_45px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="mb-5 flex items-center justify-between text-[11px] tracking-[0.15em] text-[#f5e6c8]/80">
          <span>CAKEROVEN LOYALTY</span>
          <span>
            MEMBER ID{" "}
            <span className="font-semibold tracking-[0.2em]">
              {card.memberCode}
            </span>
          </span>
        </div>

        <h2 className="mb-5 text-2xl font-semibold leading-snug">
          Digital Stamp Card
        </h2>

        {/* card holder */}
        <div className="mb-5 space-y-1 text-sm">
          <p className="text-xs text-[#f5e6c8]/70">Card Holder</p>
          <p className="text-base font-semibold">{card.name}</p>

          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-[#f5e6c8]/70">Phone</span>
            <span className="font-mono text-sm">
              {showPhone ? card.phone : maskedPhone}
            </span>
            <button
              type="button"
              onClick={() => setShowPhone((v) => !v)}
              className="rounded-full border border-[#f5e6c8]/40 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#f5e6c8]/90 hover:bg-[#f5e6c8]/10"
            >
              {showPhone ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* progress / CTA */}
        <div className="mb-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 items-center rounded-full bg-[#f5e6c8]/10 px-3 font-mono">
              {card.currentStamps}/12
            </span>
            <span className="text-[#f5e6c8]/80">
              {card.currentStamps === 0
                ? "12 stamps to your next treat."
                : `${12 - card.currentStamps} to your next treat.`}
            </span>
          </div>
          <span className="rounded-full bg-[#f5e6c8]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#f5e6c8]/90">
            Pay ₹500+ = 1 stamp
          </span>
        </div>

        {/* stamp board */}
        <div className="rounded-3xl bg-[#3f120f] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
          <div className="mb-3 flex items-center justify-between text-xs">
            <p>
              Collect{" "}
              <span className="font-semibold">12 stamps</span> to unlock a
              special CakeRoven treat 🎁
            </p>
            <span className="rounded-full bg-[#f5e6c8]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
              Board
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {stamps.map((num) => {
              const filled = num <= card.currentStamps;
              return (
                <div
                  key={num}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm transition ${
                    filled
                      ? "border-[#f5e6c8] bg-[#f5e6c8]/90 text-[#501914]"
                      : "border-[#f5e6c8]/35 text-[#f5e6c8]/80"
                  }`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* footer text */}
        <div className="mt-4 space-y-1 text-[11px] text-[#f5e6c8]/75">
          <p>
            Show this card at the counter after each visit. Every bill of{" "}
            <span className="font-semibold">₹500 or more</span> earns one stamp.
          </p>
          <p>
            After collecting 12 stamps, you&apos;re eligible for a complimentary
            CakeRoven treat. Rewards completed:{" "}
            <span className="font-semibold">{card.totalRewards}</span>
          </p>
        </div>

        {highlightReward && (
          <div className="mt-3 rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-50">
            🎉 This customer just completed 12 stamps! They&apos;re eligible for
            a complimentary CakeRoven treat.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-2xl bg-red-500/15 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
}
