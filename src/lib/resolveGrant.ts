import { Agent, Grant, Partner, User } from "@prisma/client";
import { decodeCredential } from "./credential";
import { prisma } from "./prisma";
import { siteAllowed } from "./siteApproval";

export type GrantDenialReason =
  | "invalid_credential"
  | "wrong_site"
  | "grant_not_found"
  | "revoked"
  | "agent_revoked"
  | "sign_in_ended"
  | "site_not_allowed"
  | "expired";

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
// good *for the site asking*. Re-checks the database every time rather than
// trusting the signed token alone: the token proves the grant was issued
// for this site; the database is the only source of truth on whether it
// still holds.
export async function resolveGrant(
  credential: string,
  partner: Pick<Partner, "id" | "domain" | "domainVerifiedAt">
): Promise<GrantResolution> {
  const payload = await decodeCredential(credential);
  if (!payload) return { valid: false, reason: "invalid_credential" };

  const grant = await prisma.grant.findUnique({
    where: { id: payload.grantId },
    include: { agent: true, user: true },
  });
  if (!grant) return { valid: false, reason: "grant_not_found" };
  const { agent, user } = grant;

  // Credentials are issued for one site's verified domain; any other site
  // presenting it (e.g. replaying one it collected) is refused.
  if (!partner.domainVerifiedAt || payload.site !== partner.domain) {
    return { valid: false, reason: "wrong_site", grant, agent, user };
  }
  if (grant.revokedAt) return { valid: false, reason: "revoked", grant, agent, user };
  if (agent.revokedAt) return { valid: false, reason: "agent_revoked", grant, agent, user };
  if (grant.expiresAt.getTime() < Date.now()) return { valid: false, reason: "expired", grant, agent, user };

  // The person can remove a site at any time; it loses access at once.
  if (!(await siteAllowed(user.id, partner.id))) {
    return { valid: false, reason: "site_not_allowed", grant, agent, user };
  }

  if (payload.signInId) {
    const signIn = await prisma.signInRequest.findUnique({ where: { id: payload.signInId } });
    if (!signIn || signIn.grantId !== grant.id || signIn.endedAt) {
      return { valid: false, reason: "sign_in_ended", grant, agent, user };
    }
  }

  return { valid: true, grant, agent, user };
}
