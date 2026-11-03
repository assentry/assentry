"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, Ban, ShieldCheck, ShieldX } from "lucide-react";

export function VerificationSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Not Just Another Bot. An Authorised Agent.
        </h2>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass rounded-2xl border-rose-400/20 p-6"
        >
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">Unknown agent</span>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
            <ArrowRight className="h-4 w-4" />
            Verification failed
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-rose-300">
            <ArrowRight className="h-4 w-4" />
            <Ban className="h-4 w-4" /> Access restricted
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-rose-400/10 px-3 py-2.5">
            <ShieldX className="h-4 w-4 text-rose-300" />
            <span className="text-xs text-rose-200">No identity or authority to check</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl border-cyan-400/20 p-6"
        >
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-cyan-300" />
            <span className="text-sm font-semibold text-slate-200">Authorised agent</span>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-cyan-300">
            <ArrowRight className="h-4 w-4" />
            Identity verified
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-cyan-300">
            <ArrowRight className="h-4 w-4" />
            Permission checked
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-cyan-400/10 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            <span className="text-xs text-cyan-200">Website decides whether to allow access</span>
          </div>
        </motion.div>
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
        HAPI does not eliminate all CAPTCHA or website security requirements. It gives
        participating websites a way to recognise authorised agents while retaining their own
        security controls.
      </p>
    </section>
  );
}
