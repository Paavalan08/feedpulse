"use client";

import { useEffect, useState } from "react";

type MotionPreference = "normal" | "reduced";

const STORAGE_KEY = "feedpulse-motion";

const getMotionPreference = (): MotionPreference => {
  if (typeof window === "undefined") return "normal";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "normal" || stored === "reduced") return stored;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "normal";
};

export default function MotionToggle() {
  const [motion, setMotion] = useState<MotionPreference>(() => getMotionPreference());

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.setAttribute("data-reduce-motion", motion === "reduced" ? "true" : "false");
    localStorage.setItem(STORAGE_KEY, motion);
  }, [motion]);

  return (
    <button
      type="button"
      onClick={() => setMotion((current) => (current === "normal" ? "reduced" : "normal"))}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 transition-colors"
      aria-label={motion === "normal" ? "Enable reduced motion" : "Enable normal motion"}
    >
      {motion === "normal" ? "Reduce Motion" : "Normal Motion"}
    </button>
  );
}
