"use client";

import { AlertTriangle, BadgeCheck, BookOpen, KeyRound, LogOut, Plus, RotateCw, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { clearDevToken, devApi, getDevToken, type DeclaredField, type Developer, type DeveloperApp } from "../../lib/devApi";
import { FIELD_TYPES, TYPE_LABELS, useStandardFields, type FieldType } from "../../lib/profileFields";
import { Badge, Button, Card, EmptyState, Input, Label, Select } from "../ui";
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
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Developer console</p>
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
    <div className="mt-6 rounded-2xl border border-white/30 bg-white/5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
        <KeyRound className="h-4 w-4" />
        {revealed.rotated ? `New API key for “${revealed.appName}”` : `API key for “${revealed.appName}”`}
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-neutral-200">
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
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !domain.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await devApi.post<{ app: DeveloperApp; apiKey: string }>("/developer/apps", {
        name: name.trim(),
        domain: domain.trim(),
      });
      setName("");
      setDomain("");
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
        One app per website or service that accepts Assentry agents. Each app gets its own API key. Agents are shown the
        site&apos;s domain, once you&apos;ve verified it, so they can check it against the page they&apos;re on.
      </p>
      <form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="new-app-name">App name</Label>
          <Input id="new-app-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" required />
        </div>
        <div className="flex-1">
          <Label htmlFor="new-app-domain">Site domain</Label>
          <Input
            id="new-app-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="shop.example.com"
            required
          />
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
  const [name, setName] = useState(app.name);
  const [domain, setDomain] = useState(app.domain ?? "");
  const [detailsNote, setDetailsNote] = useState<string | null>(null);

  const [verifyNote, setVerifyNote] = useState<string | null>(null);
  const detailsChanged = name.trim() !== app.name || domain.trim() !== (app.domain ?? "");

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDetailsNote(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() !== app.name) body.name = name.trim();
      if (domain.trim() !== (app.domain ?? "")) body.domain = domain.trim();
      const data = await devApi.patch<{ app: DeveloperApp }>(`/developer/apps/${app.id}`, body);
      setName(data.app.name);
      setDomain(data.app.domain ?? "");
      setDetailsNote("Saved");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain() {
    setBusy(true);
    setError(null);
    setVerifyNote(null);
    try {
      await devApi.post(`/developer/apps/${app.id}/verify-domain`);
      setVerifyNote("Domain verified.");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

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
            <dt className="text-slate-500">Domain</dt>
            <dd className="flex items-center gap-1.5 text-slate-300">
              {app.domain ? (
                <>
                  <span className="font-mono">{app.domain}</span>
                  {app.domainVerifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-neutral-200">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-amber-300">Not verified</span>
                  )}
                </>
              ) : (
                <span className="text-amber-300">Not set</span>
              )}
            </dd>
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

      {!revoked && app.domain && !app.domainVerifiedAt && (
        <div className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-slate-300">
          <p className="font-medium text-white">Verify {app.domain}</p>
          <p className="mt-1">
            Agents can&apos;t sign in to this site until its domain is verified. Deploy the site with{" "}
            <code className="text-slate-200">@assentry/sdk</code> 0.8 or later and{" "}
            <code className="text-slate-200">
              assentryDiscovery({"{"} partnerName, assentry {"}"})
            </code>{" "}
            using this app&apos;s API key, then click Verify. The SDK serves the proof at{" "}
            <code className="break-all text-slate-200">
              https://{app.domain}/.well-known/assentry-domain-verification
            </code>
            .
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={verifyDomain} disabled={busy}>
              <BadgeCheck className="h-4 w-4" /> {busy ? "Checking…" : "Verify domain"}
            </Button>
            {verifyNote && <span className="text-xs text-neutral-300">{verifyNote}</span>}
          </div>
        </div>
      )}

      {!revoked && (
        <form onSubmit={saveDetails} className="mt-5 border-t border-white/5 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`name-${app.id}`}>App name</Label>
              <Input
                id={`name-${app.id}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDetailsNote(null);
                }}
                required
              />
            </div>
            <div>
              <Label htmlFor={`domain-${app.id}`}>Site domain</Label>
              <Input
                id={`domain-${app.id}`}
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setDetailsNote(null);
                }}
                placeholder="shop.example.com"
                required
              />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button type="submit" variant="secondary" disabled={busy || !detailsChanged}>
              Save name & domain
            </Button>
            {detailsNote && <span className="text-xs text-neutral-300">{detailsNote}</span>}
            {domain.trim() !== (app.domain ?? "") && app.domainVerifiedAt && (
              <span className="text-xs text-amber-300">Changing the domain means verifying it again.</span>
            )}
          </div>
        </form>
      )}

      {!revoked && <DeclaredFieldsEditor app={app} onSaved={onChanged} />}

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
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
          <div className="mt-2 flex items-center gap-3">
            <Button type="submit" variant="secondary" disabled={busy}>
              Save redirect URIs
            </Button>
            {savedNote && <span className="text-xs text-neutral-300">{savedNote}</span>}
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

// ---- Details the site needs ----

interface CustomDraft {
  key: string;
  label: string;
  type: FieldType;
  options: string;
  required: boolean;
}

function DeclaredFieldsEditor({ app, onSaved }: { app: DeveloperApp; onSaved: () => Promise<void> }) {
  const standard = useStandardFields();
  const initialStandard = () =>
    Object.fromEntries(app.fields.filter((f) => !f.custom).map((f) => [f.key, f.required])) as Record<string, boolean>;
  const initialCustom = (): CustomDraft[] =>
    app.fields
      .filter((f) => f.custom)
      .map((f) => ({ key: f.key, label: f.label ?? f.key, type: (f.type ?? "text") as FieldType, options: f.options.join(", "), required: f.required }));

  // key -> required, for ticked standard details
  const [picked, setPicked] = useState<Record<string, boolean>>(initialStandard);
  const [custom, setCustom] = useState<CustomDraft[]>(initialCustom);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const payload = (): DeclaredField[] => [
    ...Object.entries(picked).map(([key, required]) => ({ key, required, custom: false, label: null, type: null, options: [] })),
    ...custom.map((c) => ({
      key: c.key.trim(),
      required: c.required,
      custom: true,
      label: c.label.trim(),
      type: c.type,
      options: c.type === "choice" ? c.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
    })),
  ];
  const canon = (fs: DeclaredField[]) =>
    JSON.stringify(
      [...fs]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((f) => [f.key, f.required, f.custom, f.label ?? null, f.type ?? null, f.options ?? []])
    );
  const changed = canon(payload()) !== canon(app.fields);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await devApi.put(`/developer/apps/${app.id}/fields`, {
        fields: payload().map((f) => ({
          key: f.key,
          required: f.required,
          ...(f.custom ? { custom: { label: f.label, type: f.type, options: f.options } } : {}),
        })),
      });
      setNote({ ok: true, text: "Saved" });
      await onSaved();
    } catch (err) {
      setNote({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-white/5 pt-4">
      <Label>Details this site needs</Label>
      <p className="mb-3 text-xs text-slate-400">
        Your site only ever receives details listed here, and only if the person allows them. Each arrives in the format
        shown. Ask for as little as you need. When a person&apos;s agent signs in without a detail you need, Assentry asks
        the person for it.
      </p>

      {!standard ? (
        <div className="h-24 animate-pulse rounded-lg bg-white/5" />
      ) : (
        <div className="divide-y divide-white/5 rounded-lg border border-white/10">
          {standard.map((f) => {
            const on = f.key in picked;
            return (
              <div key={f.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-white"
                    checked={on}
                    onChange={() =>
                      setPicked((p) => {
                        const next = { ...p };
                        if (on) delete next[f.key];
                        else next[f.key] = false;
                        return next;
                      })
                    }
                  />
                  {f.label}
                  <code className="text-xs text-slate-500">{f.key}</code>
                </label>
                <span className="flex-1 text-xs text-slate-500">{f.format}</span>
                <span className="w-[9.5rem] text-right">
                  {on && <RequiredToggle value={picked[f.key]} onChange={(v) => setPicked((p) => ({ ...p, [f.key]: v }))} />}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mb-2 mt-4 text-xs font-medium text-slate-400">Your own details</p>
      {custom.length === 0 && <p className="mb-2 text-xs text-slate-500">None. Add one for anything not in the list above.</p>}
      <div className="space-y-2">
        {custom.map((c, i) => {
          const set = (patch: Partial<CustomDraft>) => setCustom((cs) => cs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-white/10 p-2 sm:grid-cols-[1fr_1fr_10rem_auto_auto]">
              <Input placeholder="Label, e.g. Membership number" value={c.label} onChange={(e) => set({ label: e.target.value })} />
              <Input placeholder="key, e.g. membership_number" value={c.key} onChange={(e) => set({ key: e.target.value })} />
              <Select value={c.type} onChange={(e) => set({ type: e.target.value as FieldType })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
              <RequiredToggle value={c.required} onChange={(v) => set({ required: v })} />
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-rose-300"
                onClick={() => setCustom((cs) => cs.filter((_, j) => j !== i))}
              >
                Remove
              </button>
              {c.type === "choice" && (
                <Input
                  className="sm:col-span-5"
                  placeholder="Options, comma-separated"
                  value={c.options}
                  onChange={(e) => set({ options: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white"
        onClick={() => setCustom((cs) => [...cs, { key: "", label: "", type: "text", options: "", required: false }])}
      >
        <Plus className="h-4 w-4" /> Add your own detail
      </button>

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={save} disabled={busy || !changed}>
          Save details
        </Button>
        {note && <span className={`text-xs ${note.ok ? "text-neutral-300" : "text-rose-400"}`}>{note.text}</span>}
        {Object.keys(picked).length + custom.length === 0 && (
          <span className="text-xs text-amber-300">Nothing listed: your site gets no details.</span>
        )}
      </div>
    </div>
  );
}

function RequiredToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-white/15 text-xs">
      {[false, true].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2 py-1 ${value === v ? "bg-white text-black" : "text-slate-400 hover:text-white"}`}
        >
          {v ? "Required" : "Optional"}
        </button>
      ))}
    </span>
  );
}
