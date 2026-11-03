import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { resolveGrant } from "../lib/resolveGrant";

export const profileRouter = Router();
profileRouter.use(requirePartner);

const profileSchema = z.object({
  credential: z.string().min(1),
  fields: z.array(z.string()).min(1),
});

// Separate from /verify on purpose: authorisation to act and disclosure of
// data are two different questions. A partner must hold a valid credential
// to reach this endpoint at all, and even then only gets the intersection
// of what it asked for and what the user actually consented to disclose
// for this specific grant — never the full profile.
profileRouter.post("/", async (req: PartnerRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { credential, fields } = parsed.data;
  const partnerId = req.partner!.id;

  const resolution = await resolveGrant(credential);

  if (!resolution.valid) {
    await prisma.auditLog.create({
      data: {
        userId: resolution.user?.id ?? null,
        agentId: resolution.agent?.id ?? null,
        grantId: resolution.grant?.id ?? null,
        partnerId,
        action: "profile_access",
        result: "denied",
        reason: resolution.reason,
        metadata: { requestedFields: fields },
      },
    });
    return res.json({ valid: false, reason: resolution.reason });
  }

  const { grant, user } = resolution;
  const profile = (user.profile as Record<string, unknown>) ?? {};
  const disclosed: Record<string, unknown> = {};
  const allowedFields = fields.filter((f) => grant.consentedFields.includes(f));
  for (const field of allowedFields) {
    if (field in profile) disclosed[field] = profile[field];
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      agentId: grant.agentId,
      grantId: grant.id,
      partnerId,
      action: "profile_access",
      result: "allowed",
      reason: "ok",
      metadata: { requestedFields: fields, disclosedFields: Object.keys(disclosed) },
    },
  });

  res.json({ valid: true, profile: disclosed });
});
