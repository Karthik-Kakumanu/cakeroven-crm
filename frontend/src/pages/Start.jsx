// frontend/src/pages/Start.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Start() {
  const navigate = useNavigate();

  useEffect(() => {
    const memberCode = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    // If we have a stored session → go straight to card
    if (memberCode && phone) {
      navigate("/card", { replace: true });
      return;
    }

    // Otherwise, go to registration after a quick splash
    const t = setTimeout(() => {
      navigate("/register", { replace: true });
    }, 2200);

    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#f5e6c8] flex items-center justify-center overflow-hidden relative">
      {/* Soft glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      {/* Decor circles */}
      <div className="absolute -left-10 -top-10 w-40 h-40 bg-[#501914]/10 rounded-full blur-2xl" />
      <div className="absolute -right-16 top-24 w-44 h-44 bg-[#501914]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 w-72 h-40 bg-[#501914]/15 rounded-full blur-3xl" />

      {/* Confetti-like stripes */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-6 top-10 w-1.5 h-6 bg-[#501914] rounded-md rotate-6 animate-bounce" />
        <span className="absolute left-12 top-4 w-1.5 h-6 bg-[#e2725b] rounded-md -rotate-3 animate-[ping_1.6s_ease-out_infinite]" />
        <span className="absolute left-10 top-24 w-1.5 h-6 bg-[#f5e6c8] rounded-md rotate-12 animate-[ping_1.9s_ease-out_infinite]" />

        <span className="absolute right-10 top-12 w-1.5 h-6 bg-[#501914] rounded-md -rotate-6 animate-bounce" />
        <span className="absolute right-6 top-24 w-1.5 h-6 bg-[#e2725b] rounded-md rotate-3 animate-[ping_1.7s_ease-out_infinite]" />
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {/* Logo badge */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#501914]/40 blur-xl" />
          <div className="w-40 h-40 rounded-full bg-[#501914] shadow-[0_18px_40px_rgba(0,0,0,0.55)] flex items-center justify-center">
            {/* circular crop of logo */}
            <div className="w-32 h-32 rounded-full overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.45)] bg-white">
              <img
                src="/cakeroven-logo.png"
                alt="CakeRoven logo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#501914] tracking-wide">
            CakeRoven Loyalty
          </h1>
          <p className="text-sm sm:text-base text-[#501914]/80">
            Baking your rewards… setting up your digital stamp card.
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-44 h-2 rounded-full bg-[#501914]/20 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-[#501914] animate-[loadBar_2s_ease-in-out_infinite]" />
        </div>

        <p className="text-[11px] text-[#501914]/70">
          You’ll be redirected automatically in a moment.
        </p>
      </div>
    </div>
  );
}
