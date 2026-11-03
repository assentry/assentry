"use client";

import { useEffect, useState } from "react";

// Three.js/R3F scenes, Framer Motion sequences and raw CSS keyframes all key
// off this one hook so "respect prefers-reduced-motion" is a single source
// of truth instead of three separate checks drifting out of sync.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}
