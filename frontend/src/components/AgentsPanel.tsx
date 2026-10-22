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

// The address a person pastes into their AI's own connector settings — not
// a secret. Set VITE_BACKEND_ORIGIN for anything beyond local dev.
const MCP_URL = `${import.meta.env.VITE_BACKEND_ORIGIN ?? "http://localhost:4000"}/mcp`;

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
              <li key={agent.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {agent.label || PLATFORM_LABELS[agent.platform]}
                  </p>
                  <p className="text-xs text-slate-500">{PLATFORM_LABELS[agent.platform]}</p>
                </div>
                <div className="flex items-center gap-3">
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
