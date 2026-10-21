import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { resolveGrant } from "../lib/resolveGrant";

export const verifyRouter = Router();
verifyRouter.use(requirePartner);

const verifySchema = z.object({
  credential: z.string().min(1),
  action: z.string().min(1), // the scope the partner expects, e.g. "job_application:submit"
});

// This is the handshake described to design partners: a direct exchange
// between the partner's SDK and HAPI's authorisation service. The agent
// never injects credentials into a form — it only carries this token here.
verifyRouter.post("/", async (req: PartnerRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { credential, action } = parsed.data;
  const partnerId = req.partner!.id;

  const resolution = await resolveGrant(credential, req.partner!.allowedScopes);

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
        metadata: { requestedAction: action },
      },
    });
    return res.json({ valid: false, reason: resolution.reason });
  }

  const scopeMatches = resolution.grant.scope === action;

  await prisma.auditLog.create({
    data: {
      userId: resolution.user.id,
      agentId: resolution.agent.id,
      grantId: resolution.grant.id,
      partnerId,
      action: "verify",
      result: scopeMatches ? "allowed" : "denied",
      reason: scopeMatches ? "ok" : "scope_mismatch",
      metadata: { requestedAction: action },
    },
  });

  if (!scopeMatches) {
    return res.json({ valid: false, reason: "scope_mismatch" });
  }

  res.json({
    valid: true,
    userId: resolution.user.id,
    agentId: resolution.agent.id,
    scope: resolution.grant.scope,
    expiresAt: resolution.grant.expiresAt,
  });
});
