import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiConfig";

export default function Card() {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const fetchCard = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/customer/card/${encodeURIComponent(memberCode)}`, {
          headers: {
            "x-customer-phone": String(phone),
            "Accept": "application/json",
          },
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.message || "Could not load card");
          navigate("/start", { replace: true });
          return;
        }
        setCard(data.card || data);
      } catch (err) {
        console.error(err);
        alert("Server error");
        navigate("/start", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f5e6c8]">Loading…</div>;
  if (!card) return null;

  const maskedPhone = card.phone && card.phone.length >= 3 ? "••••••" + card.phone.slice(-3) : "••••••••";

  return (
    <div className="min-h-screen bg-[#f5e6c8] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] rounded-3xl text-[#f5e6c8] p-6">
        <h3 className="text-xl font-bold">Digital Stamp Card</h3>
        <div className="mt-4">
          <div className="text-sm">Holder</div>
          <div className="font-semibold text-lg">{card.name}</div>
          <div className="mt-2 text-sm">
            Phone: <span className="font-mono">{showPhone ? card.phone : maskedPhone}</span>
            <button onClick={()=>setShowPhone(s=>!s)} className="ml-3 px-2 py-0.5 bg-[#f5e6c8]/10 rounded"> {showPhone ? "Hide":"Show"}</button>
          </div>
        </div>

        <div className="mt-6 bg-[#3a0f0b]/60 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2">
              <div className="px-2 py-1 rounded-full bg-[#fff4d8] text-[#501914]">{card.currentStamps}/12</div>
              <div className="text-sm">{card.currentStamps === 12 ? "Reward unlocked!" : "Stamps to next treat"}</div>
            </div>
            <div className="text-xs px-2 py-1 rounded bg-[#f5e6c8]/10">PAY ₹500+ = 1 STAMP</div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {Array.from({length:12}).map((_,i)=>{
              const n=i+1;
              const filled = (card.currentStamps || 0) >= n;
              return (
                <div key={n} className={`w-10 h-10 rounded-full flex items-center justify-center ${filled ? "bg-[#f5e6c8] text-[#501914]" : "border border-[#f5e6c8]/30 text-[#f5e6c8]/80"}`}>
                  {n}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
