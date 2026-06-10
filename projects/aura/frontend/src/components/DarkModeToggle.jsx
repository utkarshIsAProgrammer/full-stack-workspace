import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DarkModeToggle = () => {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aura-theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("aura-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <motion.button
      onClick={() => setDark((prev) => !prev)}
      className="relative flex items-center justify-center w-9 h-9 rounded-full border cursor-pointer"
      style={{
        background: dark
          ? "rgba(42, 31, 69, 0.6)"
          : "rgba(255, 255, 255, 0.25)",
        borderColor: dark
          ? "rgba(58, 45, 90, 0.5)"
          : "rgba(205, 193, 255, 0.35)",
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <AnimatePresence mode="wait">
        {dark ? (
          <motion.svg
            key="moon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#CDC1FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4.5 h-4.5"
            style={{ width: 18, height: 18 }}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8B78E8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4.5 h-4.5"
            style={{ width: 18, height: 18 }}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default DarkModeToggle;
