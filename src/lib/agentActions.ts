import { issueCredential } from "./credential";
import { normaliseDomain } from "./domain";
import { prisma } from "./prisma";
import { askPersonAboutSite } from "./siteApproval";

export interface AgentGrantSummary {
  id: string;
  consentedFields: string[];
  expiresAt: Date;
  createdAt: Date;
}

// Shared by the REST /agent/* routes (used by the local connector) and the
// hosted MCP server's tool handlers (used by the real OAuth-connected
// client), both are the same capability, just reached over a different
// transport, so the business logic lives in exactly one place.
export async function listGrantsForAgent(agentId: string): Promise<AgentGrantSummary[]> {
  return prisma.grant.findMany({
    where: { agentId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, consentedFields: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

// A credential fetched over the connector is carried by the agent itself, so
// it is kept short: if one is intercepted it can only be replayed at that one
// site for minutes, not for the life of the permission. Agents fetch a fresh
// one right before acting. (Browser sign-ins are different: there the
// credential goes straight to the site's own cookie and never reaches the
// agent, so it keeps the permission's lifetime.)
export const DIRECT_CREDENTIAL_TTL_MS = 15 * 60 * 1000;

export type CredentialOutcome =
  | { ok: true; credential: string; expiresAt: Date; siteName: string; site: string }
  | { ok: false; error: "grant_not_found" | "grant_revoked" | "grant_expired" | "unknown_site" }
  | { ok: false; error: "awaiting_person"; siteName: string; site: string };

/**
 * A credential for presenting in an Authorization header, issued for one
 * participating site (by its verified domain): it's refused anywhere else.
 */
export async function issueCredentialForAgentGrant(
  agentId: string,
  grantId: string,
  siteDomain: string
): Promise<CredentialOutcome> {
  const grant = await prisma.grant.findFirst({ where: { id: grantId, agentId } });
  if (!grant) return { ok: false, error: "grant_not_found" };
  if (grant.revokedAt) return { ok: false, error: "grant_revoked" };
  if (grant.expiresAt.getTime() < Date.now()) return { ok: false, error: "grant_expired" };

  const domain = normaliseDomain(siteDomain);
  const site = domain
    ? await prisma.partner.findFirst({ where: { domain, domainVerifiedAt: { not: null }, revokedAt: null } })
    : null;
  if (!site || !site.domain) return { ok: false, error: "unknown_site" };

  // First time for this site: the person allows it in the app first.
  if ((await askPersonAboutSite(grant.userId, site.id, agentId)) !== "allowed") {
    return { ok: false, error: "awaiting_person", siteName: site.name, site: site.domain };
  }

  const expiresAt = new Date(Math.min(grant.expiresAt.getTime(), Date.now() + DIRECT_CREDENTIAL_TTL_MS));
  const credential = await issueCredential({ grantId: grant.id, site: site.domain }, expiresAt);

  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      agentId: grant.agentId,
      grantId: grant.id,
      partnerId: site.id,
      action: "credential_issued",
      result: "allowed",
      reason: "ok",
      metadata: { site: site.domain },
    },
  });

  return { ok: true, credential, expiresAt, siteName: site.name, site: site.domain };
}
