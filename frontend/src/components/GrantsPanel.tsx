import { useState } from "react";
import { api } from "../lib/api";
import type { Agent, Grant } from "../lib/types";
import { Badge, Button, Card, EmptyState, Input, Label, MultiSelect, Select } from "./ui";

const FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "resume", label: "Resume" },
  { value: "phone", label: "Phone number" },
  { value: "address", label: "Address" },
];

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
  const [agentId, setAgentId] = useState(activeAgents[0]?.id ?? "");
  const [scope, setScope] = useState("job_application:submit");
  const [fields, setFields] = useState<string[]>(["name", "email", "resume"]);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [issuedCredential, setIssuedCredential] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function authorise(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) return;
    setBusy(true);
    setIssuedCredential(null);
    try {
      const data = await api.post<{ credential: string }>("/grants", {
        agentId,
        scope,
        consentedFields: fields,
        expiresInMinutes: Number(minutes),
      });
      setIssuedCredential(data.credential);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await api.post(`/grants/${id}/revoke`);
    onChange();
  }

  function copyCredential() {
    if (!issuedCredential) return;
    navigator.clipboard.writeText(issuedCredential);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Authorise an agent</h2>
        <p className="mb-4 text-sm text-slate-500">
          Grant one agent permission to do one specific thing, for a bounded time. This is the
          consent record a participating site verifies — not a password.
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
                <Label>Scope</Label>
                <Input value={scope} onChange={(e) => setScope(e.target.value)} />
              </div>
              <div>
                <Label>Consented fields</Label>
                <MultiSelect options={FIELD_OPTIONS} selected={fields} onChange={setFields} />
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

        {issuedCredential && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <p className="mb-2 text-sm font-medium text-indigo-900">
              Credential issued — this is what the agent carries and presents. It won't be shown
              again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs text-slate-700">
                {issuedCredential}
              </code>
              <Button variant="secondary" onClick={copyCredential} type="button">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Authorisations</h2>
        {grants.length === 0 ? (
          <EmptyState>No authorisations issued yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {grants.map((grant) => {
              const status = grantStatus(grant);
              return (
                <li key={grant.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{grant.scope}</p>
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
