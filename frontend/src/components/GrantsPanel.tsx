"use client";

import { useState } from "react";
import { api } from "../lib/api";
import type { Agent, Grant, Platform } from "../lib/types";
import { useStandardFields } from "../lib/profileFields";
import { Badge, Button, Card, EmptyState, Input, Label, MultiSelect, Select } from "./ui";

const PLATFORM_LABELS: Record<Platform, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  grok: "Grok",
  other: "Other",
};


function grantStatus(grant: Grant): { label: string; tone: "success" | "danger" | "warning" } {
  if (grant.revokedAt) return { label: "Revoked", tone: "danger" };
  if (new Date(grant.expiresAt) < new Date()) return { label: "Expired", tone: "warning" };
  return { label: "Active", tone: "success" };
}

export function GrantsPanel({
  agents,
  grants,
  onChange,
}: {
  agents: Agent[];
  grants: Grant[];
  onChange: () => void;
}) {
  const activeAgents = agents.filter((a) => !a.revokedAt);
  const standardFields = useStandardFields();
  const fieldOptions = (standardFields ?? []).map((f) => ({ value: f.key, label: f.label }));
  const [agentId, setAgentId] = useState(activeAgents[0]?.id ?? "");
  const [fields, setFields] = useState<string[]>(["name", "email"]);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [authorised, setAuthorised] = useState(false);

  async function authorise(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) return;
    setBusy(true);
    setAuthorised(false);
    try {
      await api.post("/grants", {
        agentId,
        consentedFields: fields,
        expiresInMinutes: Number(minutes),
      });
      setAuthorised(true);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await api.post(`/grants/${id}/revoke`);
    onChange();
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-white">Authorise an agent</h2>
        <p className="mb-4 text-sm text-slate-400">
          Authorise an agent to act on your behalf, with only the details you choose, for a bounded time. This is
          the permission participating sites check with Assentry. It isn&apos;t a password, and there&apos;s nothing to copy.
        </p>

        {activeAgents.length === 0 ? (
          <EmptyState>Connect an agent above before authorising it.</EmptyState>
        ) : (
          <form onSubmit={authorise} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Agent</Label>
                <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label || agent.platform}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Details it may share</Label>
                <MultiSelect options={fieldOptions} selected={fields} onChange={setFields} />
              </div>
              <div>
                <Label>Expires in (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              Authorise
            </Button>
          </form>
        )}

        {authorised && (
          <p className="mt-4 rounded-lg border border-white/20 bg-white/5 p-4 text-sm text-neutral-200">
            Authorised. Your agent can now sign in to participating sites for you. Each site only gets the details it
            asks for and you allowed here, and you can see and end every sign-in under Sign-ins.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-white">Authorisations</h2>
        {grants.length === 0 ? (
          <EmptyState>No authorisations issued yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/10">
            {grants.map((grant) => {
              const status = grantStatus(grant);
              const agent = agents.find((a) => a.id === grant.agentId);
              const agentName = agent?.label || PLATFORM_LABELS[agent?.platform ?? "other"];
              return (
                <li key={grant.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{agentName}</p>
                    <p className="text-xs text-slate-500">
                      Expires {new Date(grant.expiresAt).toLocaleString()} ·{" "}
                      {grant.consentedFields.join(", ") || "no data fields"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {status.label === "Active" && (
                      <Button variant="danger" onClick={() => revoke(grant.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
