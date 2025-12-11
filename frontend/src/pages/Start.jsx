// frontend/src/pages/Start.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

const logoSrc = "/cakeroven-logo.png";

export default function Start() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    if (memberCode && phone) {
      navigate("/card", { replace: true });
      return;
    }

    const t = setTimeout(() => {
      navigate("/register", { replace: true });
    }, 2200);

    return () => clearTimeout(t);
  }, [navigate]);

  // motion variants
  const container = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 80, when: "beforeChildren" } },
  };

  const pop = {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const float = reduceMotion
    ? {}
    : { y: [0, -6, 0], transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } };

  return (
    <div className="min-h-screen w-full bg-[#f7efe1] flex items-center justify-center overflow-hidden relative">
      {/* subtle radial background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% 12%, rgba(255,255,255,0.95) 0%, rgba(247,239,225,1) 28%, rgba(247,239,225,1) 100%)",
        }}
      />

      {/* decorative blobs */}
      <div className="absolute -left-12 -top-12 w-44 h-44 bg-[#501914]/12 rounded-full blur-3xl" />
      <div className="absolute -right-16 top-24 w-52 h-52 bg-[#501914]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-44px] left-1/2 -translate-x-1/2 w-80 h-44 bg-[#501914]/14 rounded-full blur-3xl" />

      {/* confetti stripes (purely decorative) */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-6 top-10 w-1.5 h-6 bg-[#501914] rounded-md rotate-6 animate-[bounce_1.6s_ease-in-out_infinite]" />
        <span className="absolute left-12 top-4 w-1.5 h-6 bg-[#e37258] rounded-md -rotate-3 animate-[ping_1.8s_ease-out_infinite]" />
        <span className="absolute left-10 top-24 w-1.5 h-6 bg-[#f5e6c8] rounded-md rotate-12 animate-[ping_1.9s_ease-out_infinite]" />
        <span className="absolute right-10 top-12 w-1.5 h-6 bg-[#501914] rounded-md -rotate-6 animate-[bounce_1.5s_ease-in-out_infinite]" />
        <span className="absolute right-6 top-24 w-1.5 h-6 bg-[#e37258] rounded-md rotate-3 animate-[ping_1.7s_ease-out_infinite]" />
      </div>

      {/* central card */}
      <motion.main
        initial="hidden"
        animate="show"
        variants={container}
        className="relative z-10 flex items-center justify-center w-full max-w-md p-6"
        aria-live="polite"
      >
        <motion.section
          variants={pop}
          className="relative w-full rounded-3xl shadow-[0_28px_60px_rgba(0,0,0,0.18)] overflow-hidden bg-gradient-to-b from-[#4b130f] to-[#3a0f0b] text-[#f5e6c8] p-6 sm:p-8"
        >
          {/* watermark logo (subtle) */}
          <img
            src={logoSrc}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-[-36px] top-[-28px] opacity-10 w-44 h-44 object-contain select-none"
            style={{ filter: "blur(0.6px)" }}
          />

          <div className="relative z-10 flex flex-col items-center gap-5">
            {/* logo badge */}
            <motion.div
              style={{ willChange: "transform" }}
              animate={float}
              className="relative flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-[#501914]/40 blur-xl" />
              <div className="w-36 h-36 rounded-full bg-[#501914] shadow-[0_18px_42px_rgba(0,0,0,0.45)] flex items-center justify-center">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-white shadow-[0_0_30px_rgba(0,0,0,0.28)]">
                  <img
                    src={logoSrc}
                    alt="CakeRoven logo"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
            </motion.div>

            {/* heading and subtitle */}
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-wide text-[#ffe8bf]">
                CakeRoven Loyalty
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#f5e6c8]/90 max-w-[26rem]">
                Baking your rewards — setting up your digital stamp card. You’ll be
                redirected automatically in a moment.
              </p>
            </div>

            {/* progress / loader */}
            <div className="w-full max-w-xs">
              <div className="relative h-3 rounded-full bg-[#f5e6c8]/12 overflow-hidden">
                {/* animated sliding gradient */}
                <motion.div
                  className="absolute inset-0"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: reduceMotion ? 0 : 2.2, ease: "linear" }}
                >
                  <div
                    style={{
                      width: "40%",
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.22), rgba(255,255,255,0.08))",
                    }}
                    className="h-full"
                  />
                </motion.div>

                {/* solid progress (subtle) */}
                <motion.div
                  aria-hidden
                  initial={{ width: "20%" }}
                  animate={{ width: "60%" }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="absolute left-0 top-0 bottom-0 rounded-full bg-[#ffe8bf]/95"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-[#f5e6c8]/80">
                <span>Preparing your card</span>
                <span>⏳</span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-[#f5e6c8]/75">
              Redirecting to registration — or opening your saved card if you’re
              already a member.
            </p>
          </div>
        </motion.section>
      </motion.main>
    </div>
  );
}
