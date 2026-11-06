import { Router } from "express";
import { z } from "zod";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { collectSignIn, startSignIn } from "../lib/signIn";

// Partner side of browser-agent sign-in (see lib/signIn.ts). Both calls use
// the site's API key, so only the site's own server can start or collect.
export const signInRouter = Router();
signInRouter.use(requirePartner);

signInRouter.post("/", async (req: PartnerRequest, res) => {
  const request = await startSignIn(req.partner!.id);
  res.status(201).json({ requestId: request.id, code: request.code, expiresAt: request.expiresAt });
});

const collectSchema = z.object({ requestId: z.string().uuid() });

signInRouter.post("/collect", async (req: PartnerRequest, res) => {
  const parsed = collectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await collectSignIn(req.partner!.id, parsed.data.requestId));
});
