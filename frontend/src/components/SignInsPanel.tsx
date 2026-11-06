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

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function SignInsPanel() {
  const [signIns, setSignIns] = useState<SignIn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ signIns: SignIn[] }>("/me/sign-ins");
      setSignIns(data.signIns);
    } catch {
      setError("Couldn't load your sign-ins.");
    }
  }, []);

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
    </div>
  );
}
