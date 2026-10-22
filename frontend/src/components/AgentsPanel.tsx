import { useState } from "react";
import { api } from "../lib/api";
import type { Agent, Platform } from "../lib/types";
import { Badge, Button, Card, EmptyState, Input, Label, Select } from "./ui";

const PLATFORM_LABELS: Record<Platform, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  grok: "Grok",
  other: "Other",
};

export function AgentsPanel({
  agents,
  onChange,
}: {
  agents: Agent[];
  onChange: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>("claude");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setIssuedSecret(null);
    try {
      const data = await api.post<{ secret: string }>("/agents", {
        platform,
        label: label || undefined,
      });
      setLabel("");
      setIssuedSecret(data.secret);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  function copySecret() {
    if (!issuedSecret) return;
    navigator.clipboard.writeText(issuedSecret);
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
          Register the AI orchestrator you want to authorise. Connecting it grants nothing by
          itself — you still have to authorise specific actions below.
        </p>
        <form onSubmit={connect} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="sm:w-48">
            <Label>Platform</Label>
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {Object.entries(PLATFORM_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label>Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My job-search assistant"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Connect
          </Button>
        </form>

        {issuedSecret && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <p className="mb-2 text-sm font-medium text-indigo-900">
              Connector key issued — paste this into your agent's HAPI connector config
              (e.g. as <code>HAPI_AGENT_KEY</code>). It won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs text-slate-700">
                {issuedSecret}
              </code>
              <Button variant="secondary" onClick={copySecret} type="button">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
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
