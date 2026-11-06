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
// data are two different questions. A site only ever gets fields that are
// all three of: asked for in this call, declared by the site in the
// developer console, and allowed by the person for this grant. Whatever the
// grant allows, a site that declared only name and email can't get more.
profileRouter.post("/", async (req: PartnerRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { credential, fields } = parsed.data;
  const partner = req.partner!;

  const resolution = await resolveGrant(credential, partner);

  if (!resolution.valid) {
    await prisma.auditLog.create({
      data: {
        userId: resolution.user?.id ?? null,
        agentId: resolution.agent?.id ?? null,
        grantId: resolution.grant?.id ?? null,
        partnerId: partner.id,
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
  const allowedFields = fields.filter(
    (f) => partner.declaredFields.includes(f) && grant.consentedFields.includes(f)
  );
  for (const field of allowedFields) {
    if (field in profile) disclosed[field] = profile[field];
  }
  const undeclared = fields.filter((f) => !partner.declaredFields.includes(f));

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      agentId: grant.agentId,
      grantId: grant.id,
      partnerId: partner.id,
      action: "profile_access",
      result: "allowed",
      reason: "ok",
      metadata: { requestedFields: fields, disclosedFields: Object.keys(disclosed), undeclaredFields: undeclared },
    },
  });

  res.json({ valid: true, profile: disclosed, ...(undeclared.length ? { undeclaredFields: undeclared } : {}) });
});
