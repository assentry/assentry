import { Router } from "express";
import { z } from "zod";
import { pairwiseAgentId, pairwiseUserId } from "../lib/pairwise";
import { prisma } from "../lib/prisma";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { resolveGrant } from "../lib/resolveGrant";

export const verifyRouter = Router();
verifyRouter.use(requirePartner);

const verifySchema = z.object({
  credential: z.string().min(1),
});

// The handshake between the partner's SDK and Assentry: is this credential
// good for *this* site, right now? Returns IDs specific to this site's
// developer (see lib/pairwise.ts), never Assentry's internal ones.
verifyRouter.post("/", async (req: PartnerRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const partner = req.partner!;

  const resolution = await resolveGrant(parsed.data.credential, partner);

  await prisma.auditLog.create({
    data: {
      userId: resolution.user?.id ?? null,
      agentId: resolution.agent?.id ?? null,
      grantId: resolution.grant?.id ?? null,
      partnerId: partner.id,
      action: "verify",
      result: resolution.valid ? "allowed" : "denied",
      reason: resolution.valid ? "ok" : resolution.reason,
      metadata: {},
    },
  });

  if (!resolution.valid) return res.json({ valid: false, reason: resolution.reason });

  res.json({
    valid: true,
    userId: pairwiseUserId(resolution.user.id, partner),
    agentId: pairwiseAgentId(resolution.agent.id, partner),
    expiresAt: resolution.grant.expiresAt,
  });
});
