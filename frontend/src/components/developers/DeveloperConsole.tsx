"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Globe,
  KeyRound,
  LayoutGrid,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  RotateCw,
  Settings,
  ShieldOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../../lib/api";
import { clearDevToken, devApi, getDevToken, type DeclaredField, type Developer, type DeveloperApp } from "../../lib/devApi";
import { FIELD_TYPES, TYPE_LABELS, useStandardFields, type FieldType } from "../../lib/profileFields";
import { Logo } from "../Logo";
import { Badge, Button, Card, EmptyState, Input, Label, Select } from "../ui";

interface RevealedKey {
  appName: string;
  apiKey: string;
  publicId: string;
  rotated: boolean;
}

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

// ---- Navigation ----
// The console's place is kept in the URL (?view=new, ?app=<id>&section=domain)
// so every page can be linked to and the back button works.

const APP_SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "domain", label: "Domain", icon: Globe },
  { id: "details", label: "Required data", icon: ListChecks },
  { id: "linking", label: "Account linking", icon: Link2 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type AppSection = (typeof APP_SECTIONS)[number]["id"];

type View = { kind: "apps" } | { kind: "new" } | { kind: "app"; id: string; section: AppSection };

function useConsoleView(): [View, (v: View) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const appId = params.get("app");
  const section = (APP_SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "overview") as AppSection;
  const view: View = appId ? { kind: "app", id: appId, section } : params.get("view") === "new" ? { kind: "new" } : { kind: "apps" };
  const go = useCallback(
    (v: View) => {
      const q = v.kind === "app" ? `?app=${v.id}${v.section !== "overview" ? `&section=${v.section}` : ""}` : v.kind === "new" ? "?view=new" : "";
      router.push(`${pathname}${q}`);
    },
    [router, pathname]
  );
  return [view, go];
}

export function DeveloperConsole() {
  const router = useRouter();
  const [view, go] = useConsoleView();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => setMobileOpen(false), [view.kind, view.kind === "app" ? view.id + view.section : ""]);

  function logOut() {
    clearDevToken();
    router.push("/developers/login");
  }

  if (loading || !developer) {
    return <div className="min-h-screen bg-navy-950 px-6 py-16 text-sm text-slate-400">{error ?? "Loading your console…"}</div>;
  }

  const app = view.kind === "app" ? apps.find((a) => a.id === view.id) : undefined;
  const title =
    view.kind === "new" ? "Create an app" : view.kind === "app" ? (app ? `${app.name} · ${APP_SECTIONS.find((s) => s.id === view.section)!.label}` : "App not found") : "Apps";

  const sidebar = (
    <ConsoleSidebar
      apps={apps}
      view={view}
      go={go}
      email={developer.email}
      onLogOut={logOut}
      onClose={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-navy-950 lg:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 py-3 lg:hidden">
        <ConsoleBrand />
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy-900 px-4 py-6 shadow-xl">{sidebar}</aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/10 bg-navy-900 px-4 py-6 lg:flex">
        {sidebar}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 hidden border-b border-white/10 bg-navy-950/80 px-8 py-4 backdrop-blur lg:block">
          <h2 className="text-sm font-medium text-slate-400">{title}</h2>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
          {revealed && <RevealedKeyNotice revealed={revealed} onDismiss={() => setRevealed(null)} />}

          {view.kind === "apps" && <AppsOverview apps={apps} go={go} />}
          {view.kind === "new" && (
            <CreateAppPage
              onCreated={async (created, apiKey) => {
                setRevealed({ appName: created.name, apiKey, publicId: created.publicId, rotated: false });
                await loadApps();
                go({ kind: "app", id: created.id, section: "overview" });
              }}
            />
          )}
          {view.kind === "app" &&
            (app ? (
              <AppPage
                key={app.id + view.section}
                app={app}
                section={view.section}
                go={go}
                onChanged={loadApps}
                onRotated={async (apiKey) => {
                  setRevealed({ appName: app.name, apiKey, publicId: app.publicId, rotated: true });
                  await loadApps();
                }}
              />
            ) : (
              <Card>
                <EmptyState>That app doesn&apos;t exist, or isn&apos;t yours.</EmptyState>
              </Card>
            ))}
        </main>
      </div>
    </div>
  );
}

function ConsoleBrand() {
  return (
    <div className="flex items-center gap-2">
      <Logo />
      <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-200">
        Developers
      </span>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, children, indent = false }: { active: boolean; onClick: () => void; icon?: typeof LayoutGrid; children: ReactNode; indent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${indent ? "pl-9" : ""} ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function ConsoleSidebar({
  apps,
  view,
  go,
  email,
  onLogOut,
  onClose,
}: {
  apps: DeveloperApp[];
  view: View;
  go: (v: View) => void;
  email: string;
  onLogOut: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between px-2">
        <ConsoleBrand />
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        <NavButton active={view.kind === "apps"} onClick={() => go({ kind: "apps" })} icon={LayoutGrid}>
          Apps
        </NavButton>
        <NavButton active={view.kind === "new"} onClick={() => go({ kind: "new" })} icon={Plus}>
          Create an app
        </NavButton>

        {apps.length > 0 && <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your apps</p>}
        {apps.map((a) => {
          const open = view.kind === "app" && view.id === a.id;
          return (
            <div key={a.id}>
              <button
                onClick={() => go({ kind: "app", id: a.id, section: "overview" })}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  open ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <AppStatusDot app={a} />
              </button>
              {open && (
                <div className="mb-1 space-y-0.5">
                  {APP_SECTIONS.map((s) => (
                    <NavButton
                      key={s.id}
                      indent
                      active={view.section === s.id}
                      onClick={() => go({ kind: "app", id: a.id, section: s.id })}
                      icon={s.icon}
                    >
                      {s.label}
                    </NavButton>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
        <Link href="/developers/docs" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200">
          <BookOpen className="h-4 w-4" /> Docs
        </Link>
        <p className="truncate px-3 pt-2 text-xs text-slate-500">{email}</p>
        <button onClick={onLogOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200">
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );
}

/** Green: ready for agents. Amber: domain not verified yet. Grey: revoked. */
function AppStatusDot({ app }: { app: DeveloperApp }) {
  const tone = app.revokedAt ? "bg-slate-600" : app.domainVerifiedAt ? "bg-emerald-400" : "bg-amber-300";
  const label = app.revokedAt ? "Revoked" : app.domainVerifiedAt ? "Ready" : "Domain not verified";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
}

// ---- Pages ----

function PageHeading({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {children && <p className="mt-1 text-sm text-slate-400">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

function AppsOverview({ apps, go }: { apps: DeveloperApp[]; go: (v: View) => void }) {
  return (
    <div>
      <PageHeading
        title="Your apps"
        actions={
          <Button onClick={() => go({ kind: "new" })}>
            <Plus className="h-4 w-4" /> Create an app
          </Button>
        }
      >
        One app per website that accepts Assentry agents. Each has its own API key, domain and the details it needs.
      </PageHeading>
      {apps.length === 0 ? (
        <Card>
          <EmptyState>No apps yet. Create one to get your first API key.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {apps.map((a) => (
            <button
              key={a.id}
              onClick={() => go({ kind: "app", id: a.id, section: "overview" })}
              className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.06] ${a.revokedAt ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-white">{a.name}</span>
                <AppStatusBadge app={a} />
              </div>
              <p className="mt-1 truncate font-mono text-xs text-slate-400">{a.domain ?? "No domain set"}</p>
              <p className="mt-3 text-xs text-slate-500">
                {a.fields.length} detail{a.fields.length === 1 ? "" : "s"} declared · created {new Date(a.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppStatusBadge({ app }: { app: DeveloperApp }) {
  if (app.revokedAt) return <Badge tone="danger">Revoked</Badge>;
  if (!app.domainVerifiedAt) return <Badge tone="warning">Verify domain</Badge>;
  return <Badge tone="success">Ready</Badge>;
}

function RevealedKeyNotice({ revealed, onDismiss }: { revealed: RevealedKey; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(revealed.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/30 bg-white/5 p-5">
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
        <code className="flex-1 overflow-x-auto rounded-lg bg-navy-950 px-3 py-2 text-xs text-slate-200">{revealed.apiKey}</code>
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

function CreateAppPage({ onCreated }: { onCreated: (app: DeveloperApp, apiKey: string) => Promise<void> }) {
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
      await onCreated(data.app, data.apiKey);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading title="Create an app">
        One app per website or service that accepts Assentry agents. Agents are shown the site&apos;s domain, once
        you&apos;ve verified it, so they can check it against the page they&apos;re on.
      </PageHeading>
      <Card>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-app-name">App name</Label>
              <Input id="new-app-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" required />
            </div>
            <div>
              <Label htmlFor="new-app-domain">Site domain</Label>
              <Input id="new-app-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="shop.example.com" required />
            </div>
          </div>
          <Button type="submit" disabled={busy}>
            <Plus className="h-4 w-4" /> {busy ? "Creating…" : "Create app"}
          </Button>
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </form>
      </Card>
      <p className="mt-4 text-sm text-slate-500">
        Next you&apos;ll get the API key, then verify the domain and choose the details your site needs.
      </p>
    </div>
  );
}

// ---- One app ----

function useAppAction() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      if (done) setNote({ ok: true, text: done });
    } catch (err) {
      setNote({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }, []);
  const noteEl = note && <p className={`text-sm ${note.ok ? "text-neutral-300" : "text-rose-400"}`}>{note.text}</p>;
  return { busy, run, noteEl, setNote };
}

function AppPage({
  app,
  section,
  go,
  onChanged,
  onRotated,
}: {
  app: DeveloperApp;
  section: AppSection;
  go: (v: View) => void;
  onChanged: () => Promise<void>;
  onRotated: (apiKey: string) => Promise<void>;
}) {
  const revoked = Boolean(app.revokedAt);
  const heading = APP_SECTIONS.find((s) => s.id === section)!.label;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => go({ kind: "apps" })} className="hover:text-white">
          Apps
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-300">{app.name}</span>
      </div>
      <PageHeading title={heading} actions={<AppStatusBadge app={app} />} />
      {revoked && section !== "overview" ? (
        <Card>
          <EmptyState>This app is revoked. Its key no longer works and it can&apos;t be changed.</EmptyState>
        </Card>
      ) : (
        <>
          {section === "overview" && <OverviewSection app={app} go={go} onRotated={onRotated} />}
          {section === "domain" && <DomainSection app={app} onChanged={onChanged} />}
          {section === "details" && (
            <Card>
              <DeclaredFieldsEditor app={app} onSaved={onChanged} />
            </Card>
          )}
          {section === "linking" && <LinkingSection app={app} onChanged={onChanged} />}
          {section === "settings" && <SettingsSection app={app} onChanged={onChanged} go={go} />}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-300">{children}</dd>
    </>
  );
}

function OverviewSection({ app, go, onRotated }: { app: DeveloperApp; go: (v: View) => void; onRotated: (apiKey: string) => Promise<void> }) {
  const { busy, run, noteEl } = useAppAction();
  const revoked = Boolean(app.revokedAt);
  const steps = [
    { done: true, label: "Create the app and store its API key on your server", section: "overview" as AppSection },
    { done: Boolean(app.domainVerifiedAt), label: "Verify your domain, so agents can sign in", section: "domain" as AppSection },
    { done: app.fields.length > 0, label: "Choose the data your site requires", section: "details" as AppSection },
  ];

  async function rotate() {
    if (!window.confirm(`Rotate the key for “${app.name}”? The current key will stop working immediately.`)) return;
    await run(async () => {
      const data = await devApi.post<{ apiKey: string }>(`/developer/apps/${app.id}/rotate`);
      await onRotated(data.apiKey);
    });
  }

  return (
    <div className="space-y-6">
      {!revoked && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-white">Setup</h3>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => go({ kind: "app", id: app.id, section: s.section })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      s.done ? "bg-white text-black" : "border border-white/25 text-slate-400"
                    }`}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className={s.done ? "text-slate-400" : "text-white"}>{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-white">Keys</h3>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
          <Field label="API key">
            <span className="font-mono">{app.apiKeyPreview ?? "—"}</span>
            <span className="block text-xs text-slate-500">Secret. Only shown in full when created or rotated.</span>
          </Field>
          <Field label="Public ID">
            <span className="break-all font-mono">{app.publicId}</span>
            <span className="block text-xs text-slate-500">Safe to expose. Used for account linking.</span>
          </Field>
          <Field label="Domain">
            <span className="font-mono">{app.domain ?? "Not set"}</span>
            {app.domainVerifiedAt ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-200">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </span>
            ) : (
              <span className="ml-2 text-xs text-amber-300">Not verified</span>
            )}
          </Field>
          <Field label="Created">{new Date(app.createdAt).toLocaleString()}</Field>
          {revoked && <Field label="Revoked">{new Date(app.revokedAt!).toLocaleString()}</Field>}
        </dl>
        {!revoked && (
          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={rotate} disabled={busy}>
              <RotateCw className="h-4 w-4" /> Rotate key
            </Button>
            {noteEl}
          </div>
        )}
      </Card>
    </div>
  );
}

function DomainSection({ app, onChanged }: { app: DeveloperApp; onChanged: () => Promise<void> }) {
  const { busy, run, noteEl } = useAppAction();
  const [domain, setDomain] = useState(app.domain ?? "");
  const changed = domain.trim() !== (app.domain ?? "");

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-base text-white">{app.domain ?? "No domain set"}</span>
          {app.domainVerifiedAt ? (
            <Badge tone="success">Verified {new Date(app.domainVerifiedAt).toLocaleDateString()}</Badge>
          ) : (
            <Badge tone="warning">Not verified</Badge>
          )}
        </div>
        {!app.domainVerifiedAt && app.domain && (
          <div className="mt-4 text-sm text-slate-300">
            <p>
              Agents can&apos;t sign in to this site until its domain is verified. Deploy the site with{" "}
              <code className="text-slate-200">@assentry/sdk</code> 0.8 or later and{" "}
              <code className="text-slate-200">assentryDiscovery({"{"} partnerName, assentry {"}"})</code> using this app&apos;s API
              key, then click Verify. The SDK serves the proof at{" "}
              <code className="break-all text-slate-200">https://{app.domain}/.well-known/assentry-domain-verification</code>.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => run(async () => { await devApi.post(`/developer/apps/${app.id}/verify-domain`); await onChanged(); }, "Domain verified.")} disabled={busy}>
                <BadgeCheck className="h-4 w-4" /> {busy ? "Checking…" : "Verify domain"}
              </Button>
              {noteEl}
            </div>
          </div>
        )}
        {app.domainVerifiedAt && (
          <p className="mt-3 text-sm text-slate-400">
            Agents are shown this domain when they sign in, and credentials issued for your site only work here.
          </p>
        )}
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Change domain</h3>
        <p className="mb-3 text-sm text-slate-400">Use the exact host your site runs on, e.g. shop.example.com. A new domain has to be verified again.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await devApi.patch(`/developer/apps/${app.id}`, { domain: domain.trim() });
              await onChanged();
            }, "Saved.");
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="shop.example.com" required />
          <Button type="submit" variant="secondary" disabled={busy || !changed}>
            Save domain
          </Button>
        </form>
      </Card>
    </div>
  );
}

function LinkingSection({ app, onChanged }: { app: DeveloperApp; onChanged: () => Promise<void> }) {
  const { busy, run, noteEl, setNote } = useAppAction();
  const [uris, setUris] = useState(app.linkRedirectUris.join("\n"));

  return (
    <Card>
      <p className="mb-4 text-sm text-slate-400">
        Optional. Lets people who already have an account on your site confirm it&apos;s theirs, once, so their agent is
        recognised as that account.{" "}
        <Link href="/developers/docs#account-linking" className="text-slate-300 underline hover:text-white">
          How it works
        </Link>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const list = uris.split("\n").map((u) => u.trim()).filter(Boolean);
          run(async () => {
            try {
              await devApi.patch(`/developer/apps/${app.id}`, { linkRedirectUris: list });
            } catch (err) {
              if (err instanceof ApiError && err.status === 400) throw new ApiError("Each redirect URI must be a full http(s) URL.", 400);
              throw err;
            }
            await onChanged();
          }, "Saved.");
        }}
      >
        <Label htmlFor="link-uris">Redirect URIs (one per line)</Label>
        <textarea
          id="link-uris"
          value={uris}
          onChange={(e) => {
            setUris(e.target.value);
            setNote(null);
          }}
          rows={3}
          placeholder="https://yoursite.com/link/callback"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={busy}>
            Save redirect URIs
          </Button>
          {noteEl}
        </div>
      </form>
    </Card>
  );
}

function SettingsSection({ app, onChanged, go }: { app: DeveloperApp; onChanged: () => Promise<void>; go: (v: View) => void }) {
  const rename = useAppAction();
  const danger = useAppAction();
  const [name, setName] = useState(app.name);

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-white">App name</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rename.run(async () => {
              await devApi.patch(`/developer/apps/${app.id}`, { name: name.trim() });
              await onChanged();
            }, "Saved.");
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit" variant="secondary" disabled={rename.busy || name.trim() === app.name}>
            Save name
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Shown to agents with your verified domain when they sign in.</p>
        <div className="mt-2">{rename.noteEl}</div>
      </Card>

      <Card className="border-rose-400/30">
        <h3 className="mb-1 text-sm font-semibold text-rose-300">Revoke this app</h3>
        <p className="mb-4 text-sm text-slate-400">
          Its API key stops working immediately and agents can no longer sign in to your site. This can&apos;t be undone.
        </p>
        <Button
          variant="danger"
          disabled={danger.busy}
          onClick={() => {
            if (!window.confirm(`Revoke “${app.name}”? Its key stops working immediately and this can't be undone.`)) return;
            danger.run(async () => {
              await devApi.post(`/developer/apps/${app.id}/revoke`);
              await onChanged();
              go({ kind: "app", id: app.id, section: "overview" });
            });
          }}
        >
          <ShieldOff className="h-4 w-4" /> Revoke app
        </Button>
        <div className="mt-2">{danger.noteEl}</div>
      </Card>
    </div>
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
    <div>
      <p className="mb-4 text-sm text-slate-400">
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
