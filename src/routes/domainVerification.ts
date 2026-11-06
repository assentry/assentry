import { Router } from "express";
import { prisma } from "../lib/prisma";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";

// The SDK asks for its own app's domain-verification token (with its API
// key) so it can serve it at /.well-known/assentry-domain-verification.
// Holding the key alone isn't enough: the token also has to appear on the
// claimed domain, which only the site's real owner controls.
export const domainVerificationRouter = Router();
domainVerificationRouter.use(requirePartner);

domainVerificationRouter.get("/", async (req: PartnerRequest, res) => {
  const partner = await prisma.partner.findUnique({ where: { id: req.partner!.id } });
  if (!partner?.domainVerificationToken) return res.status(404).json({ error: "this app has no domain set" });
  res.json({ domain: partner.domain, token: partner.domainVerificationToken });
});
