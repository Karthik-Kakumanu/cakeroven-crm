import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Start() {
  const navigate = useNavigate();

  useEffect(() => {
    const code = localStorage.getItem("cr_memberCode");
    const phone = localStorage.getItem("cr_phone");

    navigate(code && phone ? "/card" : "/register", { replace: true });
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f5e6c8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#ffffff_0,_#f5e6c8_45%,_#f5e6c8_100%)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-4 px-6"
      >
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#501914] shadow-[0_12px_35px_rgba(0,0,0,0.35)]">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-white">
            <img
              src="/cakeroven-logo.png"
              alt="CakeRoven logo"
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-[0.08em] text-[#501914]">
            CakeRoven Loyalty
          </h1>
          <p className="text-sm text-[#501914]/85">Opening your card...</p>
        </div>
      </motion.div>
    </div>
  );
}
