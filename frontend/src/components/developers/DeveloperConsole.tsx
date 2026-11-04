"use client";

import { AlertTriangle, BookOpen, KeyRound, LogOut, Plus, RotateCw, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { clearDevToken, devApi, getDevToken, type Developer, type DeveloperApp } from "../../lib/devApi";
import { Badge, Button, Card, EmptyState, Input, Label } from "../ui";
import { DevHeader } from "./DevHeader";

interface RevealedKey {
  appName: string;
  apiKey: string;
  publicId: string;
  rotated: boolean;
}

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

export function DeveloperConsole() {
  const router = useRouter();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);

  const loadApps = useCallback(async () => {
    const data = await devApi.get<{ apps: DeveloperApp[] }>("/developer/apps");
    setApps(data.apps);
  }, []);

  useEffect(() => {
    if (!getDevToken()) {
      router.replace("/developers/login");
      return;
    }
    (async () => {
      try {
        const me = await devApi.get<{ developer: Developer }>("/developer/auth/me");
        setDeveloper(me.developer);
        await loadApps();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearDevToken();
          router.replace("/developers/login");
          return;
        }
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadApps]);

  function logOut() {
    clearDevToken();
    router.push("/developers/login");
  }

  if (loading || !developer) {
    return (
      <div className="min-h-screen bg-navy-950">
        <DevHeader />
        <div className="mx-auto max-w-4xl px-6 py-16 text-sm text-slate-400">{error ?? "Loading your console…"}</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-navy-950">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-30" />
      <DevHeader />

      <main className="relative mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Developer console</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Your apps & API keys</h1>
            <p className="mt-1 text-sm text-slate-400">Signed in as {developer.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/developers/docs#quickstart"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              <BookOpen className="h-4 w-4" /> Quickstart
            </Link>
            <Button variant="ghost" onClick={logOut}>
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        </div>

        {revealed && <RevealedKeyNotice revealed={revealed} onDismiss={() => setRevealed(null)} />}

        <CreateAppCard
          onCreated={async (app, apiKey) => {
            setRevealed({ appName: app.name, apiKey, publicId: app.publicId, rotated: false });
            await loadApps();
          }}
        />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Apps</h2>
          {apps.length === 0 ? (
            <Card>
              <EmptyState>No apps yet. Create one above to get your first API key.</EmptyState>
            </Card>
          ) : (
            <div className="space-y-4">
              {apps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onRotated={async (apiKey) => {
                    setRevealed({ appName: app.name, apiKey, publicId: app.publicId, rotated: true });
                    await loadApps();
                  }}
                  onChanged={loadApps}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RevealedKeyNotice({ revealed, onDismiss }: { revealed: RevealedKey; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(revealed.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
        <KeyRound className="h-4 w-4" />
        {revealed.rotated ? `New API key for “${revealed.appName}”` : `API key for “${revealed.appName}”`}
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        This is the only time this key will be shown. Store it somewhere safe (e.g. your server&apos;s
        ASSENTRY_API_KEY environment variable) before closing this.
        {revealed.rotated && " The previous key has already stopped working."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-navy-950 px-3 py-2 text-xs text-slate-200">
          {revealed.apiKey}
        </code>
        <Button variant="secondary" onClick={copy} type="button">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Public ID (safe to expose, used for account linking): <code className="text-slate-400">{revealed.publicId}</code>
      </p>
      <div className="mt-4">
        <Button variant="ghost" onClick={onDismiss} type="button">
          I&apos;ve stored it — dismiss
        </Button>
      </div>
    </div>
  );
}

function CreateAppCard({ onCreated }: { onCreated: (app: DeveloperApp, apiKey: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await devApi.post<{ app: DeveloperApp; apiKey: string }>("/developer/apps", { name: name.trim() });
      setName("");
      await onCreated(data.app, data.apiKey);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="text-sm font-semibold text-white">Create an app</h2>
      <p className="mt-1 text-sm text-slate-400">
        One app per website or service that accepts Assentry agents. Each app gets its own API key.
      </p>
      <form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>App name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme (production)" required />
        </div>
        <Button type="submit" disabled={busy}>
          <Plus className="h-4 w-4" /> {busy ? "Creating…" : "Create app"}
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </Card>
  );
}

function AppCard({
  app,
  onRotated,
  onChanged,
}: {
  app: DeveloperApp;
  onRotated: (apiKey: string) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const revoked = Boolean(app.revokedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uris, setUris] = useState(app.linkRedirectUris.join("\n"));
  const [savedNote, setSavedNote] = useState<string | null>(null);

  async function rotate() {
    if (!window.confirm(`Rotate the key for “${app.name}”? The current key will stop working immediately.`)) return;
    setBusy(true);
    setError(null);
    try {
      const data = await devApi.post<{ apiKey: string }>(`/developer/apps/${app.id}/rotate`);
      await onRotated(data.apiKey);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm(`Revoke “${app.name}”? Its key stops working immediately and this can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await devApi.post(`/developer/apps/${app.id}/revoke`);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveUris(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedNote(null);
    try {
      const list = uris
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      await devApi.patch(`/developer/apps/${app.id}`, { linkRedirectUris: list });
      setSavedNote("Saved");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? "Each redirect URI must be a full http(s) URL." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={revoked ? "opacity-70" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">{app.name}</h3>
            <Badge tone={revoked ? "danger" : "success"}>{revoked ? "Revoked" : "Active"}</Badge>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
            <dt className="text-slate-500">API key</dt>
            <dd className="font-mono text-slate-300">{app.apiKeyPreview ?? "—"}</dd>
            <dt className="text-slate-500">Public ID</dt>
            <dd className="break-all font-mono text-slate-300">{app.publicId}</dd>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-300">{new Date(app.createdAt).toLocaleString()}</dd>
            {revoked && (
              <>
                <dt className="text-slate-500">Revoked</dt>
                <dd className="text-slate-300">{new Date(app.revokedAt!).toLocaleString()}</dd>
              </>
            )}
          </dl>
        </div>
        {!revoked && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={rotate} disabled={busy}>
              <RotateCw className="h-4 w-4" /> Rotate key
            </Button>
            <Button variant="danger" onClick={revoke} disabled={busy}>
              <ShieldOff className="h-4 w-4" /> Revoke
            </Button>
          </div>
        )}
      </div>

      {!revoked && (
        <form onSubmit={saveUris} className="mt-5 border-t border-white/5 pt-4">
          <Label>Account-linking redirect URIs (one per line, optional)</Label>
          <textarea
            value={uris}
            onChange={(e) => {
              setUris(e.target.value);
              setSavedNote(null);
            }}
            rows={2}
            placeholder="https://yoursite.com/link/callback"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <div className="mt-2 flex items-center gap-3">
            <Button type="submit" variant="secondary" disabled={busy}>
              Save redirect URIs
            </Button>
            {savedNote && <span className="text-xs text-cyan-300">{savedNote}</span>}
            <Link href="/developers/docs#account-linking" className="text-xs text-slate-400 hover:text-white">
              What&apos;s this?
            </Link>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </Card>
  );
}
