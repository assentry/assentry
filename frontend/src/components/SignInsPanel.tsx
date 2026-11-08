"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "./ui";

interface SignIn {
  id: string;
  site: { name: string; domain: string | null };
  agent: { id: string; label: string | null; platform: string };
  signedInAt: string;
  endedAt: string | null;
  active: boolean;
}

interface SiteRow {
  id: string;
  site: { name: string; domain: string | null };
  agent: { id: string; label: string | null; platform: string } | null;
  asksFor: { label: string; required: boolean }[];
  requestedAt: string;
  allowedAt: string | null;
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function SignInsPanel({ onSitesChanged }: { onSitesChanged?: () => void }) {
  const [signIns, setSignIns] = useState<SignIn[] | null>(null);
  const [sites, setSites] = useState<{ pending: SiteRow[]; allowed: SiteRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [busySite, setBusySite] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, siteData] = await Promise.all([
        api.get<{ signIns: SignIn[] }>("/me/sign-ins"),
        api.get<{ pending: SiteRow[]; allowed: SiteRow[] }>("/me/sites"),
      ]);
      setSignIns(data.signIns);
      setSites(siteData);
    } catch {
      setError("Couldn't load your sign-ins.");
    }
  }, []);

  // A site waiting on the person should show up without a reload.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function decide(id: string, action: "allow" | "decline" | "remove") {
    setBusySite(id);
    try {
      await api.post(`/me/sites/${id}/${action}`);
      await load();
      onSitesChanged?.();
    } finally {
      setBusySite(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function end(id: string) {
    setEnding(id);
    try {
      await api.post(`/me/sign-ins/${id}/end`);
      await load();
    } finally {
      setEnding(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Sign-ins</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every time one of your agents signed in to a website for you. If you don&apos;t recognise one, end it: the
          site signs the agent out on its next page.
        </p>
      </div>
      {sites && sites.pending.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-white">Waiting for you</h2>
          <p className="mt-1 text-sm text-slate-400">
            The first time your agent signs in to a site, you decide whether that site is allowed. Only allow sites you
            meant your agent to use.
          </p>
          <ul className="mt-3 divide-y divide-white/10">
            {sites.pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {p.agent ? p.agent.label || p.agent.platform : "Your agent"} wants to sign in to {p.site.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.site.domain} · {ago(p.requestedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {p.asksFor.length
                      ? `It asks for: ${p.asksFor.map((f) => f.label + (f.required ? " (required)" : "")).join(", ")}. It only gets what you allow.`
                      : "It doesn't ask for any of your details."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => decide(p.id, "decline")} disabled={busySite === p.id}>
                    Decline
                  </Button>
                  <Button variant="success" onClick={() => decide(p.id, "allow")} disabled={busySite === p.id}>
                    Allow
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : signIns === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        ) : signIns.length === 0 ? (
          <EmptyState>No sign-ins yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/10">
            {signIns.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {s.agent.label || s.agent.platform} signed in to {s.site.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.site.domain} · {ago(s.signedInAt)}
                    {s.endedAt && ` · ended ${ago(s.endedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Ended"}</Badge>
                  {s.active && (
                    <Button variant="danger" onClick={() => end(s.id)} disabled={ending === s.id}>
                      {ending === s.id ? "Ending…" : "End"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {sites && sites.allowed.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-white">Sites you&apos;ve allowed</h2>
          <p className="mt-1 text-sm text-slate-400">
            Removing a site signs your agents out of it and stops it getting your details. You&apos;re asked again if
            an agent goes back.
          </p>
          <ul className="mt-3 divide-y divide-white/10">
            {sites.allowed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{a.site.name}</p>
                  <p className="text-xs text-slate-400">
                    {a.site.domain}
                    {a.allowedAt && ` · allowed ${ago(a.allowedAt)}`}
                  </p>
                </div>
                <Button variant="danger" onClick={() => decide(a.id, "remove")} disabled={busySite === a.id}>
                  {busySite === a.id ? "Removing…" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}