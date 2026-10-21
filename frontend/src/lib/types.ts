export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export type Platform = "claude" | "chatgpt" | "grok" | "other";

export interface Agent {
  id: string;
  platform: Platform;
  label?: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface Grant {
  id: string;
  agentId: string;
  scope: string;
  consentedFields: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  result: "allowed" | "denied";
  reason: string | null;
  createdAt: string;
  agent: Agent | null;
  grant: Grant | null;
  partner: { id: string; name: string } | null;
}
