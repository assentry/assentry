import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { publicBaseUrl, releaseFor } from "../lib/profile";
import { resolveGrant } from "../lib/resolveGrant";

export const profileRouter = Router();
profileRouter.use(requirePartner);

const profileSchema = z.object({
  credential: z.string().min(1),
  fields: z.array(z.string()).min(1).max(100),
});

// Separate from /verify on purpose: authorisation to act and disclosure of
// data are two different questions. See releaseFor for exactly what a site
// can get. Values arrive normalised to their published type; files arrive as
// single-use download links.
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
  const release = await releaseFor(partner, grant, fields, publicBaseUrl(req));

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      agentId: grant.agentId,
      grantId: grant.id,
      partnerId: partner.id,
      action: "profile_access",
      result: "allowed",
      reason: "ok",
      metadata: {
        requestedFields: fields,
        disclosedFields: Object.keys(release.profile),
        missing: release.missing,
        undeclaredFields: release.undeclaredFields,
      },
    },
  });

  res.json({
    valid: true,
    profile: release.profile,
    meta: release.meta,
    ...(release.missing.length ? { missing: release.missing } : {}),
    ...(release.undeclaredFields.length ? { undeclaredFields: release.undeclaredFields } : {}),
  });
});
