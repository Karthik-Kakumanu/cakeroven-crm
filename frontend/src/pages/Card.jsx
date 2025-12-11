// frontend/src/pages/Card.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/**
 * Secure Card page:
 * - Only shows card if localStorage has a matching memberCode and phone (or token).
 * - Does not allow reading arbitrary ?member= from URL unless localStorage has it.
 * - Displays 12 tick boxes with dates, reward date, masked phone, show/hide,
 *   and clear messaging if the system is disabled for holiday dates.
 */

const HOLIDAY_DATES = [
  { month: 11, day: 25, message: "Happy Christmas — we are closed today." }, // Dec 25
  { month: 11, day: 31, message: "Sorry — we are closed for New Year's Eve." }, // Dec 31
  { month: 0, day: 1, message: "Happy New Year — we are closed today." }, // Jan 1
];

function isHolidayIST(now = new Date()) {
  // Convert to India time by using locale string with Asia/Kolkata
  // Create a new Date from that locale string to get local date components.
  const indian = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const m = indian.getMonth();
  const d = indian.getDate();
  const hit = HOLIDAY_DATES.find((h) => h.month === m && h.day === d);
  return hit || null;
}

export default function Card() {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [serverMessage, setServerMessage] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // small notification sound
    audioRef.current = new Audio("/ding.mp3"); // include a small ding.mp3 in /public
  }, []);

  useEffect(() => {
    const storedMember = localStorage.getItem("cr_memberCode");
    const storedPhone = localStorage.getItem("cr_phone");
    const storedToken = localStorage.getItem("cr_customerToken"); // optional if you use token

    // Nothing stored → redirect to start/register
    if (!storedMember || (!storedPhone && !storedToken)) {
      navigate("/start", { replace: true });
      return;
    }

    async function fetchCard() {
      setLoading(true);
      setServerMessage(null);

      try {
        // Security: send phone (or token) as header/body so server can verify.
        const res = await fetch(
          `${API_BASE}/api/customer/card/${encodeURIComponent(storedMember)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              // prefer token if available
              ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
              "x-customer-phone": storedPhone || "",
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          setServerMessage(data.message || "Could not load card");
          // force-out if unauthorized or invalid
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("cr_memberCode");
            localStorage.removeItem("cr_phone");
            navigate("/start", { replace: true });
            return;
          }
          setLoading(false);
          return;
        }

        // success: play a gentle sound if card loaded and not first load
        if (audioRef.current) audioRef.current.play().catch(() => {});
        setCard(data.card || data);
      } catch (err) {
        console.error("Card fetch error:", err);
        setServerMessage("Server error");
      } finally {
        setLoading(false);
      }
    }

    // check holiday first and don't call backend if holiday
    const holiday = isHolidayIST();
    if (holiday) {
      setServerMessage(holiday.message);
      setLoading(false);
      return;
    }

    fetchCard();
    // no dependencies except navigate — we want to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center">
        <p className="text-[#501914]">Loading your card…</p>
      </div>
    );
  }

  if (serverMessage) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
        <div className="bg-white/95 rounded-2xl p-8 shadow-md max-w-xl text-center">
          <h2 className="text-xl font-semibold text-[#501914] mb-2">Notice</h2>
          <p className="text-[#501914]/80">{serverMessage}</p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate("/start")}
              className="px-4 py-2 bg-[#501914] text-[#f5e6c8] rounded-full"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  // Normalize fields returned by server
  const memberCode = card.memberCode || card.member_code;
  const name = card.name;
  const phone = card.phone;
  const current = Number(card.currentStamps ?? card.current_stamps ?? 0);
  const totalRewards = Number(card.totalRewards ?? card.total_rewards ?? 0);
  const stampHistory = Array.isArray(card.stamp_history)
    ? card.stamp_history // expected array of ISO strings or nulls, length <=12
    : []; // backend should provide it

  // Ensure stampHistory has 12 items (fill missing with null)
  const history = Array.from({ length: 12 }).map((_, i) =>
    stampHistory[i] ? stampHistory[i] : null
  );

  const maskedPhone = phone && phone.length >= 3 ? "••••••" + phone.slice(-3) : "••••••••";

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] text-[#f5e6c8] p-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs tracking-widest uppercase text-[#f5e6c8]/70">
              CakeRoven Loyalty
            </p>
            <h1 className="text-2xl font-extrabold mt-1">Digital Stamp Card</h1>
            <p className="text-sm text-[#f5e6c8]/80 mt-1">Card Holder</p>
            <p className="text-lg font-semibold">{name}</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-[#f5e6c8]/60">Member ID</p>
            <p className="text-sm font-mono font-bold mt-1">{memberCode}</p>

            <div className="mt-3 text-sm">
              <div className="flex items-center justify-end gap-2">
                <div className="text-xs text-[#f5e6c8]/75">Phone</div>
                <div className="font-mono">{showPhone ? phone : maskedPhone}</div>
                <button
                  onClick={() => setShowPhone((v) => !v)}
                  className="ml-2 px-2 py-1 rounded-full text-xs bg-[#f5e6c8]/10 border border-[#f5e6c8]/20"
                >
                  {showPhone ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-2 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/25 font-mono text-sm">
              {current}/12
            </span>
            <div className="text-sm text-[#f5e6c8]/80">
              {current >= 12 ? "Reward unlocked!" : "stamps to your next treat."}
            </div>
          </div>

          <div className="text-xs px-3 py-2 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">
            PAY ₹500+ = 1 STAMP
          </div>
        </div>

        {/* Stamp board area */}
        <div className="bg-[#3d0f0b]/60 rounded-xl p-4 border border-[#f5e6c8]/10 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#f5e6c8]/80">
              Collect <span className="font-semibold">12 stamps</span> to unlock a CakeRoven treat 🎁
            </div>

            {card.reward_issued_at || card.rewardIssuedAt ? (
              <div className="text-xs bg-[#f5e6c8]/10 px-3 py-1 rounded-full border border-[#f5e6c8]/20">
                Reward issued:{" "}
                <span className="font-semibold text-[#f5e6c8]">
                  {new Date(card.reward_issued_at || card.rewardIssuedAt).toLocaleDateString()}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {history.map((d, i) => {
              const n = i + 1;
              const filled = Boolean(d);
              return (
                <div key={n} className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-shadow ${
                      filled
                        ? "bg-[#f5e6c8] text-[#501914] shadow-md"
                        : "bg-transparent border border-[#f5e6c8]/30 text-[#f5e6c8]/80"
                    }`}
                    title={filled ? new Date(d).toLocaleString() : "Not stamped"}
                  >
                    {n}
                  </div>
                  <div className="text-xs text-[#f5e6c8]/70">
                    {filled ? new Date(d).toLocaleDateString() : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rules / footer */}
        <div className="text-xs text-[#f5e6c8]/80">
          <p>
            Show this card at the counter after each visit. Every bill of{" "}
            <span className="font-semibold">₹500 or more</span> earns <span className="font-semibold">1 stamp</span>.
          </p>
          <p className="mt-1">After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.</p>
        </div>
      </div>
    </div>
  );
}
