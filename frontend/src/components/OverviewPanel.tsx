import { Activity as ActivityIcon, Bot, ShieldCheck } from "lucide-react";
import type { Agent, AuditLog, Grant } from "../lib/types";
import { Badge, Card, EmptyState, StatCard } from "./ui";

function isActiveGrant(grant: Grant): boolean {
  return !grant.revokedAt && new Date(grant.expiresAt) > new Date();
}

export function OverviewPanel({
  user,
  agents,
  grants,
  logs,
}: {
  user: { name?: string | null; email: string };
  agents: Agent[];
  grants: Grant[];
  logs: AuditLog[];
}) {
  const activeAgents = agents.filter((a) => !a.revokedAt);
  const activeGrants = grants.filter(isActiveGrant);
  const recentLogs = logs.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Welcome back{user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Here's what your connected agents are currently authorised to do.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Connected agents"
          value={activeAgents.length}
          hint={`${agents.length} total`}
          icon={<Bot className="h-5 w-5" strokeWidth={2} />}
          tone="cyan"
        />
        <StatCard
          label="Active authorisations"
          value={activeGrants.length}
          hint={`${grants.length} issued all-time`}
          icon={<ShieldCheck className="h-5 w-5" strokeWidth={2} />}
          tone="violet"
        />
        <StatCard
          label="Actions logged"
          value={logs.length}
          hint="verify, disclose, revoke…"
          icon={<ActivityIcon className="h-5 w-5" strokeWidth={2} />}
          tone="slate"
        />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-white">Recent activity</h2>
        {recentLogs.length === 0 ? (
          <EmptyState>Nothing's happened yet — connect and authorise an agent to get started.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/10">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-100">{log.action}</p>
                  <p className="truncate text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                    {log.partner?.name ? ` · ${log.partner.name}` : ""}
                  </p>
                </div>
                <Badge tone={log.result === "allowed" ? "success" : "danger"}>{log.result}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
