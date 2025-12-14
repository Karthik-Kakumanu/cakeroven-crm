// src/pages/Card.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../apiConfig";

/**
 * Card.jsx (Holiday-aware + Mobile-first)
 */

function getIstDate(now = new Date()) {
  return new Date(now.getTime() + 330 * 60 * 1000);
}

function getHolidayInfoForIst(dateIst) {
  const month = dateIst.getUTCMonth();
  const day = dateIst.getUTCDate();

  if (month === 11 && day === 25) {
    return {
      isHoliday: true,
      key: "christmas",
      title: "🎄 Happy Christmas",
      message:
        "Sorry for the inconvenience on Christmas day. Stamp access is temporarily unavailable.",
    };
  }

  if ((month === 11 && day === 31) || (month === 0 && day === 1)) {
    return {
      isHoliday: true,
      key: "newyear",
      title: "🎉 Happy New Year",
      message:
        "We're celebrating the New Year! Stamp access is temporarily unavailable.",
    };
  }

  return { isHoliday: false };
}

export default function Card() {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [logoInlineVisible, setLogoInlineVisible] = useState(true);
  const [holiday, setHoliday] = useState({ isHoliday: false });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkHoliday = () => {
      setHoliday(getHolidayInfoForIst(getIstDate()));
    };
    checkHoliday();
    const id = setInterval(checkHoliday, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (!memberCode || !phone) {
      navigate("/start", { replace: true });
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/customer/card/${memberCode}?phone=${encodeURIComponent(
            phone
          )}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed");

        const data = await res.json();
        if (isMountedRef.current) {
          setCard(data.card || data);
          setLoading(false);
        }
      } catch (e) {
        if (isMountedRef.current) {
          setError("Unable to load card");
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [navigate]);

  const stamps = Number(card?.currentStamps ?? card?.current_stamps ?? 0);
  const rewards = Number(card?.totalRewards ?? card?.total_rewards ?? 0);
  const isRewardReady = stamps >= 12;

  useEffect(() => {
    if (isRewardReady) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
  }, [isRewardReady]);

  const memberCode = card?.memberCode || card?.member_code || "—";
  const maskedPhone =
    card?.phone ? "••••••" + card.phone.slice(-3) : "••••••••••";

  const inlineLogoSrc = `${process.env.PUBLIC_URL || ""}/cakeroven-logo.png`;

  const handleSwitchUser = () => {
    localStorage.clear();
    navigate("/start", { replace: true });
  };

  if (holiday.isHoliday) {
    return (
      <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="bg-white p-6 rounded-2xl text-center shadow-xl">
          <h2 className="text-2xl font-bold mb-2">{holiday.title}</h2>
          <p className="text-sm mb-4">{holiday.message}</p>
          <button
            onClick={handleSwitchUser}
            className="px-4 py-2 bg-amber-700 text-white rounded-full"
          >
            Switch user
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-amber-50 flex items-center justify-center p-4 overflow-hidden">
      {/* CAKEROVEN LOGO RAIN */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.img
            key={i}
            src="/cakeroven-logo.png"
            className="absolute w-16 h-16"
            initial={{ y: -150, x: `${Math.random() * 100}vw`, opacity: 0 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 8, delay: i * 0.6, repeat: Infinity }}
          />
        ))}
      </div>

      {/* MAIN CARD */}
      <motion.section className="relative z-10 w-full max-w-sm bg-[#3a0f0b] text-amber-100 p-6 rounded-3xl">
        <div className="flex justify-between mb-4">
          {logoInlineVisible && (
            <img
              src={inlineLogoSrc}
              onError={() => setLogoInlineVisible(false)}
              className="h-10"
              alt="logo"
            />
          )}
          <span className="font-mono">{memberCode}</span>
        </div>

        <p className="mb-2">{card?.name}</p>
        <p className="text-sm mb-4">
          Phone: {showPhone ? card?.phone : maskedPhone}
          <button
            onClick={() => setShowPhone((s) => !s)}
            className="ml-2 underline"
          >
            {showPhone ? "Hide" : "Show"}
          </button>
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                stamps > i ? "bg-amber-100 text-black" : "border"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <button
          onClick={handleSwitchUser}
          className="text-xs underline text-amber-200"
        >
          Switch user
        </button>
      </motion.section>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </main>
  );
}
