import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Start() {
  const navigate = useNavigate();

  useEffect(() => {
    const code = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    // Existing user – go straight to card
    if (code && phone) {
      navigate(`/card?member=${code}`, { replace: true });
      return;
    }

    // New user – after 2 sec go to register
    const t = setTimeout(() => {
      navigate("/register", { replace: true });
    }, 2000);

    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f5e6c8]">
      {/* soft radial background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      {/* background blobs */}
      <div className="pointer-events-none absolute -left-16 -top-10 h-40 w-40 rounded-full bg-[#501914]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-10 h-44 w-44 rounded-full bg-[#501914]/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#501914]/10 blur-3xl" />

      {/* confetti bursts */}
      <div className="pointer-events-none absolute inset-0">
        {/* left side */}
        <span className="absolute left-6 top-10 h-6 w-2 rounded-sm bg-[#501914] rotate-6 animate-[confettiFall_1.4s_ease-out_infinite]" />
        <span className="absolute left-12 top-4 h-6 w-2 rounded-sm bg-[#e2725b] -rotate-3 animate-[confettiFall_1.7s_ease-out_infinite] delay-[0.1s]" />
        <span className="absolute left-8 top-24 h-6 w-2 rounded-sm bg-[#f5e6c8] rotate-12 animate-[confettiFall_1.9s_ease-out_infinite] delay-[0.2s]" />

        {/* right side */}
        <span className="absolute right-8 top-8 h-6 w-2 rounded-sm bg-[#501914] -rotate-6 animate-[confettiFall_1.6s_ease-out_infinite]" />
        <span className="absolute right-14 top-20 h-6 w-2 rounded-sm bg-[#e2725b] rotate-3 animate-[confettiFall_1.8s_ease-out_infinite] delay-[0.15s]" />
        <span className="absolute right-6 top-32 h-6 w-2 rounded-sm bg-[#f5e6c8] -rotate-8 animate-[confettiFall_2s_ease-out_infinite] delay-[0.25s]" />
      </div>

      {/* little floating dots */}
      <span className="pointer-events-none absolute left-10 top-8 h-3 w-3 rounded-full bg-[#501914] animate-ping" />
      <span className="pointer-events-none absolute right-12 bottom-10 h-3 w-3 rounded-full bg-[#501914] animate-ping delay-150" />
      <span className="pointer-events-none absolute right-6 top-1/2 h-2 w-2 rounded-full bg-[#501914] animate-pulse" />

      {/* center content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-5 px-6"
      >
        {/* glowing logo badge */}
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-[#501914] shadow-[0_0_45px_rgba(0,0,0,0.55)]">
          <div className="absolute h-44 w-44 rounded-full border border-[#501914]/20" />
          <div className="h-32 w-32 overflow-hidden rounded-full shadow-[0_0_25px_rgba(0,0,0,0.4)]">
            <img
              src="/cakeroven-logo.png"
              alt="CakeRoven logo"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-2 text-center"
        >
          <h1 className="text-3xl font-extrabold tracking-[0.08em] text-[#501914]">
            CakeRoven Loyalty
          </h1>
          <p className="text-sm text-[#501914]/85">
            Warming your card in the oven… just a moment ✨
          </p>
        </motion.div>

        {/* loading bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "10rem" }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="h-2 overflow-hidden rounded-full bg-[#501914]/15"
        >
          <div className="h-full w-full animate-[loadBar_2s_ease-in-out_infinite] bg-[#501914]" />
        </motion.div>
      </motion.div>
    </div>
  );
}
