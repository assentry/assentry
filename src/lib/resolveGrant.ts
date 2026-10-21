import { Agent, Grant, User } from "@prisma/client";
import { decodeCredential } from "./credential";
import { prisma } from "./prisma";

export type GrantDenialReason =
  | "invalid_credential"
  | "grant_not_found"
  | "revoked"
  | "agent_revoked"
  | "expired"
  | "scope_not_permitted";

export type GrantResolution =
  | { valid: true; grant: Grant; agent: Agent; user: User }
  | {
      valid: false;
      reason: GrantDenialReason;
      // Populated whenever we managed to resolve a grant row before the
      // denial, so the audit log can still attribute the attempt.
      grant?: Grant;
      agent?: Agent;
      user?: User;
    };

// The one place that decides whether a presented credential is currently
// good. Deliberately re-checks the database every time rather than trusting
// the signed token alone — the token proves the grant *was* issued, the
// database row is the only source of truth on whether it still holds.
// This is what makes verification independent of whatever the agent claims.
export async function resolveGrant(
  credential: string,
  partnerAllowedScopes: string[]
): Promise<GrantResolution> {
  const payload = decodeCredential(credential);
  if (!payload) return { valid: false, reason: "invalid_credential" };

  const grant = await prisma.grant.findUnique({
    where: { id: payload.grantId },
    include: { agent: true, user: true },
  });
  if (!grant) return { valid: false, reason: "grant_not_found" };

  const { agent, user } = grant;

  if (grant.revokedAt) return { valid: false, reason: "revoked", grant, agent, user };
  if (agent.revokedAt) {
    return { valid: false, reason: "agent_revoked", grant, agent, user };
  }
  if (grant.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired", grant, agent, user };
  }
  if (
    partnerAllowedScopes.length > 0 &&
    !partnerAllowedScopes.includes(grant.scope)
  ) {
    return { valid: false, reason: "scope_not_permitted", grant, agent, user };
  }

  return { valid: true, grant, agent, user };
}
