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
  const [loading, setLoading] = useState(true);

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
    refreshAll().finally(() => setLoading(false));
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
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar tab={tab} onTabChange={setTab} email={user.email} onSignOut={signOut} />

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 hidden border-b border-slate-200 bg-slate-50/80 px-8 py-4 backdrop-blur lg:block">
          <h2 className="text-sm font-medium text-slate-500">{TITLES[tab]}</h2>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <div key={tab} className="animate-fade-in">
              {tab === "overview" && <OverviewPanel user={user} agents={agents} grants={grants} logs={logs} />}
              {tab === "agents" && <AgentsPanel agents={agents} onChange={refreshAll} />}
              {tab === "grants" && <GrantsPanel agents={agents} grants={grants} onChange={refreshAll} />}
              {tab === "audit" && <AuditPanel logs={logs} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
      </div>
      <div className="h-40 rounded-2xl bg-slate-200/70" />
    </div>
  );
}
