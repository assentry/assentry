"use client";

import { motion } from "framer-motion";

export function Hero() {
  return (
    <section id="platform" className="relative overflow-hidden pt-10 pb-10 sm:pt-14 sm:pb-12">
      <div
        className="grid-texture pointer-events-none absolute inset-0 opacity-60"
        style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)" }}
      />
      <div className="animate-breathe pointer-events-none absolute left-1/2 top-24 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-white/10 blur-[120px]" />
      <div className="animate-breathe pointer-events-none absolute right-0 top-96 h-80 w-80 rounded-full bg-white/10 blur-[100px]" style={{ animationDelay: "-2.5s" }} />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-glow-cyan text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Your AI. Your Identity.
          <br />
          <span className="bg-gradient-to-r from-white via-neutral-300 to-neutral-500 bg-clip-text text-transparent">
            Your Control.
          </span>
        </motion.h1>
      </div>
    </section>
  );
}
