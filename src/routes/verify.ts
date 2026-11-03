import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { resolveGrant } from "../lib/resolveGrant";

export const verifyRouter = Router();
verifyRouter.use(requirePartner);

const verifySchema = z.object({
  credential: z.string().min(1),
});

// This is the handshake described to design partners: a direct exchange
// between the partner's SDK and HAPI's authorisation service. The agent
// never injects credentials into a form — it only carries this token here.
verifyRouter.post("/", async (req: PartnerRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { credential } = parsed.data;
  const partnerId = req.partner!.id;

  const resolution = await resolveGrant(credential);

  if (!resolution.valid) {
    await prisma.auditLog.create({
      data: {
        userId: resolution.user?.id ?? null,
        agentId: resolution.agent?.id ?? null,
        grantId: resolution.grant?.id ?? null,
        partnerId,
        action: "verify",
        result: "denied",
        reason: resolution.reason,
        metadata: {},
      },
    });
    return res.json({ valid: false, reason: resolution.reason });
  }

  await prisma.auditLog.create({
    data: {
      userId: resolution.user.id,
      agentId: resolution.agent.id,
      grantId: resolution.grant.id,
      partnerId,
      action: "verify",
      result: "allowed",
      reason: "ok",
      metadata: {},
    },
  });

  res.json({
    valid: true,
    userId: resolution.user.id,
    agentId: resolution.agent.id,
    expiresAt: resolution.grant.expiresAt,
  });
});
