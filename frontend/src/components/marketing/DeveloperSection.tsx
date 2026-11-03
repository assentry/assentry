"use client";

import { motion } from "framer-motion";
import { ArrowDown, Bot, Globe2, KeyRound, ShieldCheck, Smartphone } from "lucide-react";

const LAYERS = [
  { icon: Smartphone, title: "HAPI App", detail: "Where a person manages identity, grants and revocation." },
  {
    icon: ShieldCheck,
    title: "HAPI Identity & Authorisation",
    detail: "Signed credentials issued per grant; /verify and /profile re-check revocation and consent on every call.",
  },
  {
    icon: Bot,
    title: "AI Agent Integration",
    detail: "OAuth 2.1 Authorization Code + PKCE with Dynamic Client Registration, and a hosted MCP server at /mcp.",
  },
  {
    icon: KeyRound,
    title: "Website SDK / API",
    detail: "@hapi-id/sdk wraps /verify + /profile behind a requireGrant middleware — or call the HTTP contract directly.",
  },
  { icon: Globe2, title: "Website Security Decision", detail: "Allow, reject, or require additional human approval — always the website's call." },
];

export function DeveloperSection() {
  return (
    <section id="for-developers" className="relative mx-auto max-w-5xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Build for the Agentic Internet.
        </h2>
        <p className="mt-4 text-slate-400">
          HAPI SDK, verification API, identity verification, delegated authorisation, permission
          validation, and website integration — the real primitives, not a black box.
        </p>
      </div>

      <div className="mt-14 space-y-3">
        {LAYERS.map((layer, i) => (
          <motion.div key={layer.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}>
            <div className="glass flex items-start gap-4 rounded-2xl p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                <layer.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <p className="font-semibold text-white">{layer.title}</p>
                <p className="mt-1 text-sm text-slate-400">{layer.detail}</p>
              </div>
            </div>
            {i < LAYERS.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-slate-600" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <a
          href="https://github.com/bioku-QR/hapi-sdk"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 px-8 py-3.5 text-sm font-semibold text-navy-950 shadow-lg shadow-cyan-500/20 transition-transform hover:scale-105"
        >
          Explore Developer Integration
        </a>
      </div>
    </section>
  );
}
