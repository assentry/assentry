import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireUser } from "../lib/userAuth";

// The signed-in person's own profile: details they declare about themselves.
// Assentry stores what they enter and does not vouch for it. Websites only
// ever see the parts a grant allows, through /profile.
export const meRouter = Router();
meRouter.use(requireUser);

const profileSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "field names are lowercase letters, digits and _"),
  z.string().max(5000)
);

meRouter.get("/profile", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { profile: true } });
  if (!user) return res.status(401).json({ error: "user not found" });
  res.json({ profile: user.profile ?? {} });
});

meRouter.put("/profile", async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body?.profile);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Blank values are treated as "not set", so clearing a box removes it.
  const profile: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    const trimmed = value.trim();
    if (trimmed) profile[key] = trimmed;
  }

  await prisma.user.update({ where: { id: req.userId! }, data: { profile } });
  res.json({ profile });
});

// The person's browser-agent sign-ins: which agent signed in to which site,
// when, and whether it's still active. Ending one stops the credential
// issued for it (it carries the sign-in's id) without touching the grant.
meRouter.get("/sign-ins", async (req: AuthedRequest, res) => {
  const rows = await prisma.signInRequest.findMany({
    where: { grant: { userId: req.userId! }, collectedAt: { not: null } },
    include: {
      partner: { select: { name: true, domain: true } },
      grant: { select: { id: true, revokedAt: true, expiresAt: true, agent: { select: { id: true, label: true, platform: true, revokedAt: true } } } },
    },
    orderBy: { collectedAt: "desc" },
    take: 100,
  });
  const now = Date.now();
  res.json({
    signIns: rows.map((r) => ({
      id: r.id,
      site: { name: r.partner.name, domain: r.partner.domain },
      agent: { id: r.grant!.agent.id, label: r.grant!.agent.label, platform: r.grant!.agent.platform },
      signedInAt: r.collectedAt,
      endedAt: r.endedAt,
      active:
        !r.endedAt &&
        !r.grant!.revokedAt &&
        !r.grant!.agent.revokedAt &&
        r.grant!.expiresAt.getTime() > now,
    })),
  });
});

meRouter.post("/sign-ins/:id/end", async (req: AuthedRequest, res) => {
  const signIn = await prisma.signInRequest.findFirst({
    where: { id: req.params.id, grant: { userId: req.userId! } },
    include: { grant: true },
  });
  if (!signIn || !signIn.grant) return res.status(404).json({ error: "sign-in not found" });
  if (!signIn.endedAt) {
    await prisma.signInRequest.update({ where: { id: signIn.id }, data: { endedAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        userId: req.userId!,
        agentId: signIn.grant.agentId,
        grantId: signIn.grant.id,
        partnerId: signIn.partnerId,
        action: "sign_in_ended",
        result: "allowed",
        reason: "user_requested",
        metadata: { signInId: signIn.id },
      },
    });
  }
  res.json({ ok: true });
});
