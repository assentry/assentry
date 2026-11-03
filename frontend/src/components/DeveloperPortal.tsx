"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { Logo } from "./Logo";
import { Button, Card, Input, Label } from "./ui";

const INSTALL_CMD = "npm install github:bioku-QR/hapi-sdk";

const CODE_EXAMPLE = `import { HAPI, requireGrant, hapiDiscovery, HAPIRequest } from "@hapi-id/sdk";
import express from "express";

const hapi = new HAPI({ apiKey: process.env.HAPI_API_KEY! });

const app = express();
app.use(express.json());

// Makes your site discoverable to an agent from any page it lands on.
app.use(hapiDiscovery({ partnerName: "Your Site" }));

app.post(
  "/apply",
  requireGrant(hapi, {
    discover: { path: "/apply", method: "POST", description: "Submit an application" },
  }),
  async (req: HAPIRequest, res) => {
    const profile = await hapi.getProfile(req.hapiCredential!, ["name", "email"]);
    if (!profile.valid) return res.status(403).json({ error: profile.reason });
    res.json({ status: "submitted", applicant: profile.profile });
  }
);`;

interface CreatedPartner {
  id: string;
  name: string;
  publicId: string;
  apiKey: string;
}

export function DeveloperPortal() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedPartner | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<CreatedPartner>("/partners", { name: name.trim() });
      setCreated(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function copyKey() {
    if (!created) return;
    navigator.clipboard.writeText(created.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <div className="grid-texture animate-drift pointer-events-none absolute -inset-20 opacity-40" />
      <div className="animate-breathe pointer-events-none absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/signup" className="text-sm font-medium text-slate-300 hover:text-white">
            For end users →
          </Link>
        </div>

        <p className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-cyan-200">
          For developers
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Build on HAPI
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-300">
          HAPI is identity and authorisation infrastructure connecting people, AI agents and your
          website — not a chatbot, not an API marketplace. Install the SDK, protect a route, and
          your site can verify who an agent represents and what it's authorised to do, without
          ever touching a user's password.
        </p>

        <Card className="mt-12">
          <h2 className="mb-1 text-sm font-semibold text-white">1. Install</h2>
          <p className="mb-3 text-sm text-slate-400">
            Not published to npm yet — install directly from the repo:
          </p>
          <code className="block overflow-x-auto rounded-lg bg-navy-900 px-4 py-3 text-sm text-cyan-200">
            {INSTALL_CMD}
          </code>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-white">2. Protect a route</h2>
          <p className="mb-3 text-sm text-slate-400">
            One function gates a route on a valid HAPI credential; one more makes your whole site
            discoverable to an agent that's only been given a generic instruction.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-navy-900 px-4 py-4 text-xs leading-relaxed text-slate-300">
            <code>{CODE_EXAMPLE}</code>
          </pre>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-white">3. Create your API key</h2>
          <p className="mb-4 text-sm text-slate-400">
            Getting a key is the whole signup step — no account, no email. Store it safely once
            it's issued; it won't be shown again.
          </p>

          <form onSubmit={createKey} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>Site or company name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Jobs"
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create API key"}
            </Button>
          </form>

          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

          {created && (
            <div className="mt-5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="mb-2 text-sm font-medium text-cyan-200">
                API key created for &ldquo;{created.name}&rdquo; — this is the only time it will
                be shown. Store it now.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-navy-950 px-2 py-1.5 text-xs text-slate-300">
                  {created.apiKey}
                </code>
                <Button variant="secondary" onClick={copyKey} type="button">
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Public ID (safe to expose, e.g. in an account-linking URL):{" "}
                <code className="text-slate-400">{created.publicId}</code>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
