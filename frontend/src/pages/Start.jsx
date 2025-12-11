// Start.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/**
 * Start screen: shows animation 2200ms then routes:
 * - if localStorage.cr_memberCode exists -> /card/:memberCode
 * - else -> /register
 */

export default function Start() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const memberCode = localStorage.getItem("cr_memberCode");
        if (memberCode) {
          navigate(`/card/${encodeURIComponent(memberCode)}`, { replace: true });
        } else {
          navigate("/register", { replace: true });
        }
      } catch (err) {
        // fallback
        navigate("/register", { replace: true });
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-violet-900 to-indigo-800">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: "anticipate" }}
        className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-xl max-w-lg w-full text-center"
      >
        <motion.img
          src="/cakeroven-logo.png"
          alt="CRM Logo"
          className="mx-auto w-36 h-36 object-contain mb-4"
          initial={{ rotate: -10 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.9 }}
        />
        <motion.h1
          className="text-3xl font-semibold text-white mb-2"
          initial={{ y: 10 }}
          animate={{ y: 0 }}
        >
          CRM by Gekro
        </motion.h1>
        <motion.p
          className="text-white/70"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Welcome — bringing loyalty to life. Loading...
        </motion.p>

        <motion.div
          className="mt-8 h-1 bg-white/10 rounded-full overflow-hidden"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 2.0, ease: "easeInOut" }}
          style={{ transformOrigin: "left" }}
        >
          <div className="h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400 w-full" />
        </motion.div>
      </motion.div>
    </div>
  );
}
