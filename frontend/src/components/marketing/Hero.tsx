"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function Hero() {
  return (
    <section id="platform" className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-20">
      <div
        className="grid-texture pointer-events-none absolute inset-0 opacity-60"
        style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)" }}
      />
      <div className="animate-breathe pointer-events-none absolute left-1/2 top-24 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="animate-breathe pointer-events-none absolute right-0 top-96 h-80 w-80 rounded-full bg-violet-500/10 blur-[100px]" style={{ animationDelay: "-2.5s" }} />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-cyan-200"
        >
          The trust layer connecting people, AI agents and the internet
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-glow-cyan text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          Your AI. Your Identity.
          <br />
          <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
            Your Control.
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/developers"
            className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 px-8 py-3.5 text-sm font-semibold text-navy-950 shadow-lg shadow-cyan-500/25 transition-transform hover:scale-105"
          >
            For Developers
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-white/15 px-8 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
          >
            For End Users
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
