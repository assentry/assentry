"use client";

import { motion } from "framer-motion";
import { Fingerprint, ShieldAlert, SlidersHorizontal } from "lucide-react";

const PROBLEMS = [
  {
    icon: Fingerprint,
    title: "Identity",
    body: "Websites cannot consistently recognise authorised AI agents.",
    color: "text-cyan-300",
    ring: "ring-cyan-400/20",
    bg: "bg-cyan-400/10",
  },
  {
    icon: ShieldAlert,
    title: "Verification",
    body: "Human-oriented login and CAPTCHA processes interrupt legitimate automated activity.",
    color: "text-violet-300",
    ring: "ring-violet-400/20",
    bg: "bg-violet-400/10",
  },
  {
    icon: SlidersHorizontal,
    title: "Control",
    body: "People need granular control over what AI agents can access and execute.",
    color: "text-sky-300",
    ring: "ring-sky-400/20",
    bg: "bg-sky-400/10",
  },
];

export function ProblemSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          AI Can Think. But Can It Act on Your Behalf?
        </h2>
        <p className="mt-4 text-slate-400">
          AI assistants are becoming capable of performing real-world online tasks, but websites
          still lack a consistent way to establish who an AI agent represents and what it is
          allowed to do.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {PROBLEMS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="glass rounded-2xl p-6"
          >
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${p.bg} ${p.ring}`}>
              <p.icon className={`h-5 w-5 ${p.color}`} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-semibold text-white">{p.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
