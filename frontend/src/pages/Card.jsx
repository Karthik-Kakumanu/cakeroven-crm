// frontend/src/pages/Card.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/**
 * Helper: Return { blocked: boolean, key: string|null, message: string|null }
 * blocked - whether today (IST) is one of the blocked dates
 * key - one of 'christmas' | 'newyear-eve' | 'newyear-day' or null
 * message - friendly message to display
 *
 * Uses Indian Standard Time (UTC+5:30). Compares month/day ignoring year.
 */
function getIstHolidayStatus() {
  // Get current UTC time then convert to IST by adding 5.5 hours
  const now = new Date();
  // milliseconds offset for IST = 5.5 * 60 * 60 * 1000 = 19800000
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);

  const d = ist.getDate(); // 1..31
  const m = ist.getMonth() + 1; // 1..12

  // Map days
  if (m === 12 && d === 25) {
    return {
      blocked: true,
      key: "christmas",
      message: "Happy Christmas 🎄 — we are sorry for the inconvenience. CakeRoven is closed today.",
      istDateString: ist.toISOString(),
    };
  }

  if (m === 12 && d === 31) {
    return {
      blocked: true,
      key: "newyear-eve",
      message: "Sorry — New Year's Eve 🎆. CakeRoven is not available today.",
      istDateString: ist.toISOString(),
    };
  }

  if (m === 1 && d === 1) {
    return {
      blocked: true,
      key: "newyear-day",
      message: "Happy New Year 🎉 — we're taking a break. CakeRoven is closed today.",
      istDateString: ist.toISOString(),
    };
  }

  return { blocked: false, key: null, message: null, istDateString: ist.toISOString() };
}

export default function Card() {
  const navigate = useNavigate();

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState({ blocked: false, key: null, message: null });
  const [serverBlockedMessage, setServerBlockedMessage] = useState(null); // message returned by API if blocked

  useEffect(() => {
    // Frontend holiday check (IST)
    setHolidayInfo(getIstHolidayStatus());
  }, []);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    // If nothing stored → user shouldn’t be here
    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    // If frontend-level holiday check blocks, we still hit API to confirm block server-side,
    // but we will show the overlay regardless.
    const fetchCard = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(phone)}`
        );

        const data = await res.json();

        if (!res.ok) {
          // If server responds with 403 and a holiday message, capture it
          if (res.status === 403 && data && data.message) {
            setServerBlockedMessage(data.message);
            setLoading(false);
            return;
          }

          alert(data.message || "Could not load card");
          // clear session and send to start
          localStorage.removeItem("cr_memberCode");
          localStorage.removeItem("cr_phone");
          navigate("/start", { replace: true });
          return;
        }

        setCard(data.card || data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("Server error");
        navigate("/start", { replace: true });
      }
    };

    fetchCard();
  }, [navigate]);

  // If either frontend computed holiday OR server explicitly blocked, we show blocked overlay.
  const isBlocked = holidayInfo.blocked || Boolean(serverBlockedMessage);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center">
        <p className="text-[#501914]">Loading your card…</p>
      </div>
    );
  }

  if (isBlocked) {
    // Prefer server message if present (server authoritative), else frontend message
    const message = serverBlockedMessage || holidayInfo.message;
    const sub = `Unavailable date (IST): ${holidayInfo.istDateString?.slice(0, 10) || ""}`;

    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-6 text-center border border-[#f3dcaa]">
          <div className="text-6xl mb-3">⛔</div>
          <h2 className="text-xl font-semibold text-[#501914] mb-2">Service temporarily unavailable</h2>
          <p className="text-sm text-[#501914]/80 mb-4">{message}</p>
          <p className="text-xs text-[#501914]/60 mb-4">{sub}</p>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                // let user go back to start
                navigate("/start", { replace: true });
              }}
              className="px-4 py-2 rounded-full bg-[#501914] text-[#f5e6c8] font-semibold"
            >
              Back
            </button>

            <button
              onClick={() => {
                // allow user to keep card stored and check later
                localStorage.removeItem("cr_memberCode");
                localStorage.removeItem("cr_phone");
                navigate("/start", { replace: true });
              }}
              className="px-4 py-2 rounded-full border border-[#501914] text-[#501914] font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const maskedPhone =
    card.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••••";

  const currentStamps = card.currentStamps ?? card.current_stamps ?? 0;
  const rewardUnlocked = currentStamps >= 12;

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-[32px] shadow-[0_25px_60px_rgba(0,0,0,0.55)] text-[#f5e6c8] p-6 relative overflow-hidden">
        {/* Small glow accents */}
        <div className="absolute -top-16 right-[-40px] w-40 h-40 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-30px] left-[-30px] w-32 h-32 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#f5e6c8]/70">CakeRoven Loyalty</p>
            <h1 className="text-xl font-extrabold mt-1">Digital Stamp Card</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#f5e6c8]/60">Member ID</p>
            <p className="text-sm font-mono font-bold mt-0.5">{card.memberCode || card.member_code}</p>
          </div>
        </div>

        {/* Holder info */}
        <div className="relative z-10 mb-4 space-y-1">
          <p className="text-[11px] text-[#f5e6c8]/70">Card Holder</p>
          <p className="text-lg font-semibold">{card.name}</p>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-[11px] text-[#f5e6c8]/70">Phone:</span>
            <span className="font-mono">{showPhone ? card.phone : maskedPhone}</span>
            <button
              onClick={() => setShowPhone((v) => !v)}
              className="ml-2 px-2 py-0.5 rounded-full text-[11px] border border-[#f5e6c8]/40 hover:bg-[#f5e6c8]/10"
            >
              {showPhone ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="relative z-10 mb-4 flex items-center justify-between text-[11px]">
          <div className="flex items-baseline gap-1">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/25 font-mono text-[11px]">
              {currentStamps}/12
            </span>
            <span className="text-[#f5e6c8]/80">
              {rewardUnlocked ? "Reward unlocked! 🎉" : "stamps to your next treat."}
            </span>
          </div>
          <div className="text-[10px] px-2 py-1 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">
            PAY ₹500+ = 1 STAMP
          </div>
        </div>

        {/* Stamp board */}
        <div className="relative z-10 mb-4 rounded-3xl bg-[#3d0f0b]/70 border border-[#f5e6c8]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-[#f5e6c8]/80">
              <p>
                Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">BOARD</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => {
              const num = i + 1;
              const filled = currentStamps >= num;
              return (
                <div
                  key={num}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold ${filled ? "bg-[#f5e6c8] text-[#501914] border-transparent shadow-[0_0_12px_rgba(0,0,0,0.4)]" : "border-[#f5e6c8]/35 text-[#f5e6c8]/80"}`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[10px] text-[#f5e6c8]/75 space-y-1">
          <p>
            Show this card at the counter after each visit. Every bill of <span className="font-semibold">₹500 or more</span> earns <span className="font-semibold">1 stamp</span>.
          </p>
          <p>After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.</p>
        </div>
      </div>
    </div>
  );
}
