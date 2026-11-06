import crypto from "crypto";
import { issueCredential } from "./credential";
import { normaliseDomain } from "./domain";
import { pairwiseAgentId, pairwiseUserId } from "./pairwise";
import { prisma } from "./prisma";

// Codes are copied by agents, never typed by people, so they're long and
// random rather than memorable: "asq_" + 52 characters from a 31-symbol
// alphabet (capitals and digits without look-alikes: no 0/O, 1/I/L), about
// 258 bits, far beyond any guessing.
const PREFIX = "asq_";
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 52;
const SIGN_IN_TTL_MS = 5 * 60 * 1000;

function randomCode(): string {
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const byte of crypto.randomBytes(CODE_LENGTH)) {
      // Rejection sampling: 248 is the largest multiple of 31 below 256, so
      // every symbol is equally likely.
      if (byte < 248 && out.length < CODE_LENGTH) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return PREFIX + out;
}

/** Only this fingerprint is stored, so a database leak exposes no live codes. */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Normalises what an agent passes in: case, spaces, dashes, a missing prefix. */
export function normaliseCode(input: string): string {
  const body = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^ASQ/, "");
  return PREFIX + body;
}

export class SiteNotVerifiedError extends Error {}

export async function startSignIn(partnerId: string) {
  // Agents are told which site a code belongs to by its verified domain,
  // so a site without one can't offer browser-agent sign-in at all.
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner?.domain || !partner.domainVerifiedAt) throw new SiteNotVerifiedError();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = randomCode();
      const created = await prisma.signInRequest.create({
        data: { codeHash: hashCode(code), partnerId, expiresAt: new Date(Date.now() + SIGN_IN_TTL_MS) },
        select: { id: true, expiresAt: true },
      });
      // The only time the plain code exists outside the agent's hands.
      return { ...created, code };
    } catch (err) {
      // Unique-code collision: try a fresh one.
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }
  throw new Error("could not allocate a sign-in code");
}

export type ApproveOutcome =
  | { ok: true; siteName: string; siteDomain: string; sharedFields: string[] }
  | { ok: false; error: "domain_mismatch"; codeDomain: string }
  | {
      ok: false;
      error:
        | "code_not_found"
        | "code_expired"
        | "code_already_used"
        | "grant_not_found"
        | "grant_revoked"
        | "grant_expired"
        | "choose_grant";
    };

/**
 * The agent approves a site's sign-in code through its own Assentry
 * connection. This is what ties the request to a person: whichever agent
 * approves it, with which of that agent's grants.
 */
export async function approveSignIn(
  agentId: string,
  rawCode: string,
  siteDomain: string,
  grantId?: string
): Promise<ApproveOutcome> {
  const request = await prisma.signInRequest.findUnique({
    where: { codeHash: hashCode(normaliseCode(rawCode)) },
    include: {
      partner: { select: { name: true, revokedAt: true, domain: true, domainVerifiedAt: true, declaredFields: true } },
    },
  });
  if (!request || request.partner.revokedAt || !request.partner.domain || !request.partner.domainVerifiedAt) {
    return { ok: false, error: "code_not_found" };
  }
  // The agent says which site it's on; the code must belong to that site's
  // verified domain. Stops a code shown on one site being approved for another.
  if (normaliseDomain(siteDomain) !== request.partner.domain) {
    return { ok: false, error: "domain_mismatch", codeDomain: request.partner.domain };
  }
  if (request.approvedAt) return { ok: false, error: "code_already_used" };
  if (request.expiresAt.getTime() < Date.now()) return { ok: false, error: "code_expired" };

  let grant;
  if (grantId) {
    grant = await prisma.grant.findFirst({ where: { id: grantId, agentId } });
    if (!grant) return { ok: false, error: "grant_not_found" };
    if (grant.revokedAt) return { ok: false, error: "grant_revoked" };
    if (grant.expiresAt.getTime() < Date.now()) return { ok: false, error: "grant_expired" };
  } else {
    const active = await prisma.grant.findMany({
      where: { agentId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (active.length === 0) return { ok: false, error: "grant_not_found" };
    if (active.length > 1) return { ok: false, error: "choose_grant" };
    grant = active[0];
  }

  // Conditional update so two agents racing for the same code can't both win.
  const claimed = await prisma.signInRequest.updateMany({
    where: { id: request.id, approvedAt: null },
    data: { approvedAt: new Date(), grantId: grant.id },
  });
  if (claimed.count === 0) return { ok: false, error: "code_already_used" };

  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      agentId,
      grantId: grant.id,
      partnerId: request.partnerId,
      action: "sign_in_approved",
      result: "allowed",
      reason: "ok",
      metadata: { signInId: request.id },
    },
  });

  // What this site can receive: only what it declared AND the person allowed.
  const sharedFields = request.partner.declaredFields.filter((f) => grant.consentedFields.includes(f));
  return { ok: true, siteName: request.partner.name, siteDomain: request.partner.domain, sharedFields };
}

export type CollectOutcome =
  | { status: "pending"; expiresAt: Date }
  | { status: "expired" | "not_found" | "already_collected" }
  | { status: "denied"; reason: "grant_revoked" | "grant_expired" | "agent_revoked" }
  | { status: "approved"; credential: string; userId: string; agentId: string; expiresAt: Date };

/** The site collects an approved request, once, with its own API key. */
export async function collectSignIn(partnerId: string, requestId: string): Promise<CollectOutcome> {
  const request = await prisma.signInRequest.findFirst({
    where: { id: requestId, partnerId },
    include: { grant: { include: { agent: true } }, partner: true },
  });
  if (!request || !request.partner.domain || !request.partner.domainVerifiedAt) return { status: "not_found" };
  if (request.collectedAt) return { status: "already_collected" };
  if (!request.approvedAt || !request.grant) {
    return request.expiresAt.getTime() < Date.now()
      ? { status: "expired" }
      : { status: "pending", expiresAt: request.expiresAt };
  }

  const grant = request.grant;
  const deny = (reason: "grant_revoked" | "grant_expired" | "agent_revoked") =>
    prisma.auditLog
      .create({
        data: {
          userId: grant.userId,
          agentId: grant.agentId,
          grantId: grant.id,
          partnerId,
          action: "sign_in_collected",
          result: "denied",
          reason,
          metadata: {},
        },
      })
      .then(() => ({ status: "denied" as const, reason }));
  if (grant.revokedAt) return deny("grant_revoked");
  if (grant.agent.revokedAt) return deny("agent_revoked");
  if (grant.expiresAt.getTime() < Date.now()) return deny("grant_expired");

  const claimed = await prisma.signInRequest.updateMany({
    where: { id: request.id, collectedAt: null },
    data: { collectedAt: new Date() },
  });
  if (claimed.count === 0) return { status: "already_collected" };

  // Bound to this site's domain, and to this sign-in so the person can end it on its own.
  const credential = await issueCredential(
    { grantId: grant.id, site: request.partner.domain, signInId: request.id },
    grant.expiresAt
  );
  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      agentId: grant.agentId,
      grantId: grant.id,
      partnerId,
      action: "sign_in_collected",
      result: "allowed",
      reason: "ok",
      metadata: {},
    },
  });

  return {
    status: "approved",
    credential,
    userId: pairwiseUserId(grant.userId, request.partner),
    agentId: pairwiseAgentId(grant.agentId, request.partner),
    expiresAt: grant.expiresAt,
  };
}
