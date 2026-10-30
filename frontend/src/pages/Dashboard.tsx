import { useEffect, useState } from "react";
import { AgentsPanel } from "../components/AgentsPanel";
import { AuditPanel } from "../components/AuditPanel";
import { GrantsPanel } from "../components/GrantsPanel";
import { OverviewPanel } from "../components/OverviewPanel";
import { Sidebar, type Tab } from "../components/Sidebar";
import { api, clearToken } from "../lib/api";
import type { Agent, AuditLog, Grant, User } from "../lib/types";

export function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
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

  const TITLES: Record<Tab, string> = {
    overview: "Overview",
    agents: "Agents",
    grants: "Authorisations",
    audit: "Activity",
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar tab={tab} onTabChange={setTab} email={user.email} onSignOut={signOut} />

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/80 px-8 py-4 backdrop-blur">
          <h2 className="text-sm font-medium text-slate-500">{TITLES[tab]}</h2>
        </header>

        <main className="mx-auto max-w-4xl px-8 py-8">
          {tab === "overview" && <OverviewPanel user={user} agents={agents} grants={grants} logs={logs} />}
          {tab === "agents" && <AgentsPanel agents={agents} onChange={refreshAll} />}
          {tab === "grants" && <GrantsPanel agents={agents} grants={grants} onChange={refreshAll} />}
          {tab === "audit" && <AuditPanel logs={logs} />}
        </main>
      </div>
    </div>
  );
}
