"use client";

import Link from "next/link";
import { useState } from "react";

type Audience = "users" | "developers";

const USER_STEPS = [
  { title: "Create your free account", body: "Sign up with your email. This is your personal Assentry identity." },
  {
    title: "Connect your AI assistant",
    body: "Pick Claude, ChatGPT or Grok from the list and click Connect. No codes to copy.",
  },
  {
    title: "Decide what it can share",
    body: "Choose which details (like your name or email) your assistant may share, and for how long.",
  },
  {
    title: "Let it get things done",
    body: "Ask your assistant to do something on a participating website. It gets in with your permission. No passwords handed over.",
  },
  {
    title: "Stay in control",
    body: "See everything your assistant did, and switch its access off at any time.",
  },
];

const DEV_POINTS = [
  {
    title: "What it is",
    body: "An authorisation layer for AI agents. A person grants their agent time-limited access to chosen profile fields. The agent connects over OAuth 2.1 and a hosted MCP server, and presents a short-lived signed credential to your site.",
  },
  {
    title: "What you install",
    body: "@assentry/sdk. It advertises your protected routes to agents, verifies each credential against Assentry, and pulls only the fields the person consented to.",
  },
  {
    title: "What it doesn't do",
    body: "Assentry never reads your site's content and never runs the agent's task. Your existing login keeps working alongside it.",
  },
];

export function HowItWorks() {
  const [audience, setAudience] = useState<Audience | null>(null);

  return (
    <section className="mx-auto max-w-3xl px-6 pb-24 pt-14 sm:pt-20">
      <h1 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">How it works</h1>

      <div className="mt-8 space-y-4 text-center text-lg leading-relaxed text-slate-300">
        <p>
          Assentry lets your AI assistant do things for you on websites, <span className="text-white">safely</span>.
        </p>
        <p>
          You decide which assistant can act for you, what personal details it may share, and for how long. When your
          assistant visits a website that works with Assentry, the website checks with us that you really gave
          permission before letting it in.
        </p>
        <p>You can see everything it did, and take the permission back whenever you like.</p>
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        {(
          [
            ["users", "For users"],
            ["developers", "For developers"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setAudience(audience === key ? null : key)}
            aria-pressed={audience === key}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
              audience === key
                ? "bg-white text-black"
                : "border border-white/20 text-slate-200 hover:border-white/40 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {audience === "users" && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white">What to do</h2>
          <ol className="mt-6 space-y-5">
            {USER_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-white">{step.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Create your account
          </Link>
        </div>
      )}

      {audience === "developers" && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white">In short</h2>
          <dl className="mt-6 space-y-5">
            {DEV_POINTS.map((point) => (
              <div key={point.title}>
                <dt className="font-medium text-white">{point.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{point.body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/developers/signup"
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Get an API key
            </Link>
            <Link
              href="/developers/docs"
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/40 hover:text-white"
            >
              Read the docs
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
