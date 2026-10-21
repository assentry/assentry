import { useEffect, useState } from "react";
import { AgentsPanel } from "../components/AgentsPanel";
import { AuditPanel } from "../components/AuditPanel";
import { GrantsPanel } from "../components/GrantsPanel";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui";
import { api, clearToken } from "../lib/api";
import type { Agent, AuditLog, Grant, User } from "../lib/types";

type Tab = "agents" | "grants" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "grants", label: "Authorisations" },
  { id: "audit", label: "Activity" },
];

export function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("agents");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  async function refreshAgents() {
    const data = await api.get<{ agents: Agent[] }>("/agents");
    setAgents(data.agents);
  }
  async function refreshGrants() {
    const data = await api.get<{ grants: Grant[] }>("/grants");
    setGrants(data.grants);
  }
  async function refreshAudit() {
    const data = await api.get<{ logs: AuditLog[] }>("/audit");
    setLogs(data.logs);
  }
  async function refreshAll() {
    await Promise.all([refreshAgents(), refreshGrants(), refreshAudit()]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  function signOut() {
    clearToken();
    onSignOut();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Logo />
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{user.email}</span>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-4xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {tab === "agents" && <AgentsPanel agents={agents} onChange={refreshAll} />}
        {tab === "grants" && (
          <GrantsPanel agents={agents} grants={grants} onChange={refreshAll} />
        )}
        {tab === "audit" && <AuditPanel logs={logs} />}
      </main>
    </div>
  );
}
