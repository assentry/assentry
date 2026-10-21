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

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/agents", { platform, label: label || undefined });
      setLabel("");
      onChange();
    } finally {
      setBusy(false);
    }
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
