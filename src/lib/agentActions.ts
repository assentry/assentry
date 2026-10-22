import { issueCredential } from "./credential";
import { prisma } from "./prisma";

export interface AgentGrantSummary {
  id: string;
  scope: string;
  consentedFields: string[];
  expiresAt: Date;
  createdAt: Date;
}

// Shared by the REST /agent/* routes (used by the local connector) and the
// hosted MCP server's tool handlers (used by the real OAuth-connected
// client) — both are the same capability, just reached over a different
// transport, so the business logic lives in exactly one place.
export async function listGrantsForAgent(agentId: string): Promise<AgentGrantSummary[]> {
  return prisma.grant.findMany({
    where: { agentId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, scope: true, consentedFields: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export type CredentialOutcome =
  | { ok: true; credential: string; scope: string; expiresAt: Date }
  | { ok: false; error: "grant_not_found" | "grant_revoked" | "grant_expired" };

export async function issueCredentialForAgentGrant(
  agentId: string,
  grantId: string
): Promise<CredentialOutcome> {
  const grant = await prisma.grant.findFirst({ where: { id: grantId, agentId } });
  if (!grant) return { ok: false, error: "grant_not_found" };
  if (grant.revokedAt) return { ok: false, error: "grant_revoked" };
  if (grant.expiresAt.getTime() < Date.now()) return { ok: false, error: "grant_expired" };

  const credential = issueCredential(
    { grantId: grant.id, userId: grant.userId, agentId: grant.agentId, scope: grant.scope },
    grant.expiresAt
  );

  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      agentId: grant.agentId,
      grantId: grant.id,
      action: "credential_issued",
      result: "allowed",
      reason: "ok",
      metadata: {},
    },
  });

  return { ok: true, credential, scope: grant.scope, expiresAt: grant.expiresAt };
}
