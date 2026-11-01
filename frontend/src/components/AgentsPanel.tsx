import { Bot } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import type { Agent, Platform } from "../lib/types";
import { Badge, Button, Card, EmptyState } from "./ui";

const PLATFORM_LABELS: Record<Platform, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  grok: "Grok",
  other: "Other",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  claude: "bg-orange-50 text-orange-600",
  chatgpt: "bg-emerald-50 text-emerald-600",
  grok: "bg-slate-100 text-slate-600",
  other: "bg-indigo-50 text-indigo-600",
};

// The address a person pastes into their AI's own connector settings — not
// a secret. In production this app is served by the backend itself, so its
// own origin *is* the backend's address — correct automatically on any
// domain, with no per-deployment config. Only the Vite dev server (a
// different origin, :5173) needs an explicit override.
const MCP_URL = `${import.meta.env.DEV ? (import.meta.env.VITE_BACKEND_ORIGIN ?? "http://localhost:4000") : window.location.origin}/mcp`;

export function AgentsPanel({
  agents,
  onChange,
}: {
  agents: Agent[];
  onChange: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function revoke(id: string) {
    await api.post(`/agents/${id}/revoke`);
    onChange();
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Connect an agent</h2>
        <p className="mb-4 text-sm text-slate-500">
          Open your AI's own settings (e.g. Claude's Connectors) and add this address. It'll send
          you back here to log in and approve — you won't need to copy or type anything else.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
            {MCP_URL}
          </code>
          <Button variant="secondary" onClick={copyUrl} type="button">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Connected agents</h2>
        {agents.length === 0 ? (
          <EmptyState>No agents connected yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {agents.map((agent) => (
              <li key={agent.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${PLATFORM_COLORS[agent.platform]}`}
                  >
                    <Bot className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {agent.label || PLATFORM_LABELS[agent.platform]}
                    </p>
                    <p className="text-xs text-slate-500">{PLATFORM_LABELS[agent.platform]}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={agent.revokedAt ? "neutral" : "success"}>
                    {agent.revokedAt ? "Revoked" : "Active"}
                  </Badge>
                  {!agent.revokedAt && (
                    <Button variant="danger" onClick={() => revoke(agent.id)}>
                      Revoke
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
