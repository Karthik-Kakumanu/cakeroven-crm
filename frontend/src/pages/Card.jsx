// frontend/src/pages/Card.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

/*
  Fix & improvements:
  - MemberCode only comes from localStorage (not from URL).
  - Send phone value via header "x-customer-phone" because backend checks that header.
  - Handle holiday-blocking (403) and other errors gracefully.
  - Improved stamp UI and accessibility.
*/
export default function Card() {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      // not authorized to view card
      navigate("/start", { replace: true });
      return;
    }

    const ctrl = new AbortController();

    async function fetchCard() {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(memberCode)}`, {
          method: "GET",
          headers: {
            "x-customer-phone": String(phone),
            Accept: "application/json",
          },
          signal: ctrl.signal,
        });

        // handle non-json replies gracefully
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          // got HTML or unexpected content
          console.error("Card fetch non-JSON response:", text);
          setErrorMsg("Unexpected server response. Please try again later.");
          setLoading(false);
          return;
        }

        if (!res.ok) {
          // 403 holiday or 401/404 etc
          setErrorMsg(data.message || "Could not load card");
          if (res.status === 401 || res.status === 403) {
            // if phone mismatch or blocked — redirect to existing page so user can re-login
            // but show message first
            alert(data.message || "Access denied");
            navigate("/existing", { replace: true });
            return;
          }
          setLoading(false);
          return;
        }

        setCard(data.card || data); // server returns { ok:true, card }
        setLoading(false);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Card fetch error:", err);
        setErrorMsg("Server error. Please try again later.");
        setLoading(false);
      }
    }

    fetchCard();
    return () => ctrl.abort();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center">
        <p className="text-[#501914]">Loading your card…</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
        <div className="bg-white/90 p-6 rounded-lg shadow text-center max-w-lg">
          <h3 className="text-lg font-semibold text-[#501914]">Notice</h3>
          <p className="mt-3 text-sm text-[#501914]/80">{errorMsg}</p>
          <div className="mt-4">
            <button onClick={() => navigate("/existing")} className="px-4 py-2 rounded bg-[#501914] text-[#f5e6c8]">Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const maskedPhone =
    card.phone && card.phone.length >= 3
      ? "••••••" + String(card.phone).slice(-3)
      : "••••••••••";

  const stamps = Number(card.currentStamps ?? card.current_stamps ?? 0);
  const rewards = Number(card.totalRewards ?? card.total_rewards ?? 0);

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-2xl shadow-2xl text-[#f5e6c8] p-6 relative overflow-hidden">
        <div className="absolute -top-16 right-[-40px] w-40 h-40 bg-[#f5e6c8]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-30px] left-[-30px] w-32 h-32 bg-[#f5e6c8]/10 rounded-full blur-3xl" />

        <header className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-[#f5e6c8]/70">Cakeroven Loyalty</p>
            <h1 className="text-2xl font-extrabold mt-1">Digital Stamp Card</h1>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#f5e6c8]/60">Member ID</p>
            <p className="text-sm font-mono font-bold mt-0.5">{card.memberCode ?? card.member_code}</p>
          </div>
        </header>

        <section className="mb-4">
          <p className="text-[11px] text-[#f5e6c8]/70">Card Holder</p>
          <p className="text-lg font-semibold">{card.name}</p>

          <div className="flex items-center gap-2 text-sm mt-2">
            <span className="text-[11px] text-[#f5e6c8]/70">Phone:</span>
            <span className="font-mono">{showPhone ? card.phone : maskedPhone}</span>
            <button
              onClick={() => setShowPhone((v) => !v)}
              className="ml-2 px-2 py-0.5 rounded-full text-[11px] border border-[#f5e6c8]/40 hover:bg-[#f5e6c8]/10"
            >
              {showPhone ? "HIDE" : "SHOW"}
            </button>
          </div>
        </section>

        <section className="mb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/25 font-mono text-[11px]">
              {stamps}/12
            </span>
            <span className="text-[#f5e6c8]/80">
              {stamps >= 12 ? "Reward unlocked! 🎉" : "stamps to your next treat."}
            </span>
          </div>
          <div className="text-[10px] px-2 py-1 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">
            PAY ₹500+ = 1 STAMP
          </div>
        </section>

        <section className="mb-4 rounded-2xl bg-[#3d0f0b]/60 border border-[#f5e6c8]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-[#f5e6c8]/80">
              <p>Collect <span className="font-semibold">12 stamps</span> to unlock a special CakeRoven treat 🎁</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5e6c8]/10 border border-[#f5e6c8]/30">BOARD</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => {
              const num = i + 1;
              const filled = stamps >= num;
              return (
                <div
                  key={num}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold transition ${
                    filled
                      ? "bg-[#f5e6c8] text-[#501914] border-transparent shadow"
                      : "border-[#f5e6c8]/35 text-[#f5e6c8]/80"
                  }`}
                  aria-label={`Stamp ${num} ${filled ? "collected" : "empty"}`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="text-[10px] text-[#f5e6c8]/75 space-y-1">
          <p>
            Show this card at the counter after each visit. Every bill of <span className="font-semibold">₹500 or more</span> earns <span className="font-semibold">1 stamp</span>.
          </p>
          <p>After collecting 12 stamps, you’re eligible for a complimentary CakeRoven treat.</p>
        </footer>
      </div>
    </div>
  );
}
