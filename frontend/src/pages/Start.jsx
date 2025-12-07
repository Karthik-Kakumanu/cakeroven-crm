import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Start() {
  const navigate = useNavigate();

  useEffect(() => {
    const storedMember = localStorage.getItem("cr_memberCode");

    if (storedMember) {
      // Existing user – go straight to card
      navigate(`/card?member=${storedMember}`, { replace: true });
      return;
    }

    // New user – after 2 sec go to register
    const t = setTimeout(() => {
      navigate("/register", { replace: true });
    }, 2000);

    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#f5e6c8] flex items-center justify-center overflow-hidden relative">
      {/* Soft radial glow behind everything */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_40%,_#f5e6c8_100%)]" />

      {/* Background circles */}
      <div className="absolute -left-10 -top-10 w-40 h-40 bg-[#501914]/10 rounded-full blur-2xl" />
      <div className="absolute -right-10 top-16 w-36 h-36 bg-[#501914]/15 rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#501914]/10 rounded-full blur-3xl" />

      {/* Confetti "blasts" */}
      <div className="pointer-events-none absolute inset-0">
        {/* left blast */}
        <span className="absolute left-4 top-10 w-2 h-5 bg-[#501914] rounded-sm rotate-6 animate-[confettiFall_1.4s_ease-out_infinite]" />
        <span className="absolute left-10 top-4 w-2 h-5 bg-[#e2725b] rounded-sm -rotate-3 animate-[confettiFall_1.6s_ease-out_infinite] delay-[0.1s]" />
        <span className="absolute left-6 top-24 w-2 h-5 bg-[#f5e6c8] rounded-sm rotate-12 animate-[confettiFall_1.7s_ease-out_infinite] delay-[0.2s]" />

        {/* right blast */}
        <span className="absolute right-6 top-8 w-2 h-5 bg-[#501914] rounded-sm -rotate-6 animate-[confettiFall_1.5s_ease-out_infinite]" />
        <span className="absolute right-10 top-20 w-2 h-5 bg-[#e2725b] rounded-sm rotate-3 animate-[confettiFall_1.8s_ease-out_infinite] delay-[0.15s]" />
        <span className="absolute right-4 top-28 w-2 h-5 bg-[#f5e6c8] rounded-sm -rotate-8 animate-[confettiFall_1.9s_ease-out_infinite] delay-[0.25s]" />
      </div>

      {/* Tiny floating dots */}
      <span className="absolute top-8 left-8 w-3 h-3 bg-[#501914] rounded-full animate-ping" />
      <span className="absolute bottom-10 right-10 w-3 h-3 bg-[#501914] rounded-full animate-ping delay-150" />
      <span className="absolute top-1/2 right-6 w-2 h-2 bg-[#501914] rounded-full animate-pulse" />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6">
        {/* Glowing logo badge with pop-in animation */}
        <div className="w-40 h-40 rounded-full bg-[#501914] shadow-[0_0_45px_rgba(0,0,0,0.5)] flex items-center justify-center animate-[popIn_0.7s_ease-out]">
          {/* decorative inner ring */}
          <div className="absolute w-44 h-44 rounded-full border border-[#501914]/20" />
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.35)]">
            <img
              src="/cakeroven-logo.png"
              alt="CakeRoven logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="text-center space-y-2 animate-[fadeUp_0.8s_ease-out]">
          <h1 className="text-3xl font-extrabold text-[#501914] tracking-wide">
            CakeRoven Loyalty
          </h1>
          <p className="text-sm text-[#501914]/80">
            Your digital stamp card is getting ready…
          </p>
        </div>

        {/* Little loading bar */}
        <div className="w-40 h-2 rounded-full bg-[#501914]/15 overflow-hidden">
          <div className="h-full bg-[#501914] animate-[loadBar_2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
