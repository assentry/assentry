"use client";

import { motion } from "framer-motion";
import { Activity, Bot, Check, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";

type TabId = "people" | "agents" | "websites";

const TABS: { id: TabId; label: string }[] = [
  { id: "people", label: "HAPI App — for people" },
  { id: "agents", label: "HAPI — for AI agents" },
  { id: "websites", label: "HAPI — for websites" },
];

function AppMockup() {
  const rows = [
    { label: "Connected assistants", value: "Claude, ChatGPT", icon: Bot },
    { label: "Personal information permissions", value: "Name, email, resume", icon: Users },
    { label: "Authorised tasks", value: "job_application:submit", icon: ShieldCheck },
    { label: "Human approval required", value: "Legal declarations", icon: Activity },
  ];
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Your HAPI identity</p>
        <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">Active</span>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <row.icon className="h-4 w-4 text-slate-400" strokeWidth={2} />
              <span className="text-sm text-slate-300">{row.label}</span>
            </div>
            <span className="text-sm font-medium text-slate-100">{row.value}</span>
          </div>
        ))}
      </div>
      <button className="mt-4 w-full rounded-lg border border-rose-400/30 bg-rose-500/10 py-2 text-sm font-medium text-rose-300">
        Revoke all access
      </button>
    </div>
  );
}

function AgentMockup() {
  const steps = [
    { label: "Agent requests permission to act", done: true },
    { label: "Agent presents proof of identity + authority", done: true },
    { label: "HAPI confirms the grant is valid", done: true },
    { label: "Agent proceeds with the authorised task", done: false },
  ];
  return (
    <div className="glass rounded-2xl p-6">
      <p className="mb-4 text-sm font-semibold text-white">Agent connection flow</p>
      <ul className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done ? "bg-cyan-400/20 text-cyan-300" : "border border-white/20 text-slate-500"
              }`}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-sm ${step.done ? "text-slate-200" : "text-slate-500"}`}>{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WebsiteMockup() {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="mb-4 text-sm font-semibold text-white">Verification request</p>
      <div className="space-y-2 rounded-xl bg-navy-950/80 p-4 font-mono text-[11px] text-slate-400">
        <p>
          POST <span className="text-cyan-300">/verify</span>
        </p>
        <p className="truncate">{'{ "credential": "...", "action": "job_application:submit" }'}</p>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-cyan-400/10 px-3 py-2.5">
        <span className="text-sm text-cyan-200">Identity + authority confirmed</span>
        <ShieldCheck className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-medium">
        <div className="rounded-lg bg-emerald-400/10 py-2 text-emerald-300">Allow</div>
        <div className="rounded-lg bg-rose-400/10 py-2 text-rose-300">Reject</div>
        <div className="rounded-lg bg-amber-400/10 py-2 text-amber-300">Ask human</div>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const [tab, setTab] = useState<TabId>("people");

  return (
    <section id="how-it-works" className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          One Trusted Connection. Three Participants.
        </h2>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
        <motion.div key={tab} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          {tab === "people" && <AppMockup />}
          {tab === "agents" && <AgentMockup />}
          {tab === "websites" && <WebsiteMockup />}
        </motion.div>

        <div className="space-y-4">
          {tab === "people" && (
            <>
              <h3 className="text-xl font-semibold text-white">HAPI App — for people</h3>
              <p className="text-slate-400">
                Manage your HAPI digital identity, connected AI assistants, personal information
                permissions, authorised tasks, action restrictions, and which actions require your
                explicit human approval. Every action is logged, and access is revocable at any
                time.
              </p>
            </>
          )}
          {tab === "agents" && (
            <>
              <h3 className="text-xl font-semibold text-white">HAPI — for AI agents</h3>
              <p className="text-slate-400">
                An agent connects through HAPI and presents proof of identity and authority before
                it ever touches a participating website — it never requests new permissions on the
                fly, only uses what a person has already authorised.
              </p>
            </>
          )}
          {tab === "websites" && (
            <>
              <h3 className="text-xl font-semibold text-white">HAPI — for websites</h3>
              <p className="text-slate-400">
                A website integrates HAPI through the SDK or API, sends a verification request for
                an agent's credential, and decides whether to allow the action, reject it, or
                require additional human approval — the security decision always stays with the
                website.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
