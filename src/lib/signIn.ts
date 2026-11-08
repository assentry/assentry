import crypto from "crypto";
import { issueCredential } from "./credential";
import { normaliseDomain } from "./domain";
import { pairwiseAgentId, pairwiseUserId } from "./pairwise";
import { requestMissingDetails, type MissingDetail } from "./profile";
import { prisma } from "./prisma";
import { askPersonAboutSite, siteStatus } from "./siteApproval";

// Codes are copied by agents, never typed by people, so they're long and
// random rather than memorable: "asq_" + 52 characters from a 31-symbol
// alphabet (capitals and digits without look-alikes: no 0/O, 1/I/L), about
// 258 bits, far beyond any guessing.
const PREFIX = "asq_";
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 52;
const SIGN_IN_TTL_MS = 5 * 60 * 1000;
// When the person first has to allow the site in the app, the code waits longer.
const AWAITING_PERSON_TTL_MS = 10 * 60 * 1000;
// A request approved just before it expired can still be collected briefly.
const COLLECT_GRACE_MS = 60 * 1000;

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
  | { ok: true; siteName: string; siteDomain: string; sharedFields: string[]; missing: MissingDetail[]; awaitingPerson?: false }
  | { ok: true; siteName: string; siteDomain: string; awaitingPerson: true }
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
    include: { partner: true },
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

  // The first time any of this person's agents signs in to this site, the
  // person allows it in the app; until then the site can't collect.
  const awaitingPerson = (await askPersonAboutSite(grant.userId, request.partnerId, agentId)) !== "allowed";
  if (awaitingPerson) {
    await prisma.signInRequest.update({
      where: { id: request.id },
      data: { expiresAt: new Date(Math.max(request.expiresAt.getTime(), Date.now() + AWAITING_PERSON_TTL_MS)) },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      agentId,
      grantId: grant.id,
      partnerId: request.partnerId,
      action: "sign_in_approved",
      result: "allowed",
      reason: awaitingPerson ? "awaiting_person" : "ok",
      metadata: { signInId: request.id },
    },
  });
  if (awaitingPerson) {
    return { ok: true, awaitingPerson: true, siteName: request.partner.name, siteDomain: request.partner.domain };
  }

  // Tell the agent what the site will get and what's missing; anything
  // missing becomes an in-app request to the person.
  const missing = await requestMissingDetails(request.partner, grant);
  const declared = await prisma.partnerField.findMany({ where: { partnerId: request.partnerId }, select: { key: true } });
  const sharedFields = declared.map((f) => f.key).filter((k) => !missing.some((m) => m.key === k));
  return { ok: true, siteName: request.partner.name, siteDomain: request.partner.domain, sharedFields, missing };
}

export type CollectOutcome =
  | { status: "pending"; expiresAt: Date; waitingFor?: "person" }
  | { status: "expired" | "not_found" | "already_collected" }
  | { status: "denied"; reason: "grant_revoked" | "grant_expired" | "agent_revoked" | "person_declined" }
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
  const deny = (reason: "grant_revoked" | "grant_expired" | "agent_revoked" | "person_declined") =>
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

  const site = await siteStatus(grant.userId, partnerId);
  if (site === "declined") return deny("person_declined");
  if (request.expiresAt.getTime() + COLLECT_GRACE_MS < Date.now()) return { status: "expired" };
  if (site !== "allowed") return { status: "pending", expiresAt: request.expiresAt, waitingFor: "person" };

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
