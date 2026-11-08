import { prisma } from "./prisma";

// A person allows each site once, in the Assentry app, before any of their
// agents can sign in to it or get a credential for it. Without this, a
// malicious site plus a prompt injection could get a person's details just
// by getting their agent to approve a code there.

export type SiteStatus = "allowed" | "declined" | "pending";

export async function siteStatus(userId: string, partnerId: string): Promise<SiteStatus | null> {
  const row = await prisma.siteApproval.findUnique({ where: { userId_partnerId: { userId, partnerId } } });
  if (!row) return null;
  if (row.allowedAt) return "allowed";
  return row.declinedAt ? "declined" : "pending";
}

export async function siteAllowed(userId: string, partnerId: string): Promise<boolean> {
  return (await siteStatus(userId, partnerId)) === "allowed";
}

/**
 * Asks the person to allow this site (shown in the app), unless they
 * already have. A site they declined is asked about again, since only the
 * person can say yes.
 */
export async function askPersonAboutSite(userId: string, partnerId: string, agentId: string): Promise<SiteStatus> {
  const status = await siteStatus(userId, partnerId);
  if (status === "allowed") return "allowed";
  await prisma.siteApproval.upsert({
    where: { userId_partnerId: { userId, partnerId } },
    create: { userId, partnerId, agentId },
    update: { agentId, requestedAt: new Date(), declinedAt: null },
  });
  return "pending";
}
