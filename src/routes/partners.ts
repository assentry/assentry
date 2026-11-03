import { Router } from "express";
import { z } from "zod";
import { generateSecret, hashSecret } from "../lib/secrets";
import { prisma } from "../lib/prisma";

export const partnersRouter = Router();

const createPartnerSchema = z.object({
  name: z.string().min(1),
});

// Self-service signup for a developer integrating HAPI into their own site.
// Deliberately minimal, same philosophy as the rest of this prototype's
// auth surface: no partner login/account system, no email — the API key
// itself is the credential, the same way a grant's credential is
// self-contained. Requires no authentication to call; getting a key *is*
// the signup step.
partnersRouter.post("/", async (req, res) => {
  const parsed = createPartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name } = parsed.data;

  const apiKey = generateSecret("hapi");
  const partner = await prisma.partner.create({
    data: {
      name,
      apiKeyHash: hashSecret(apiKey),
    },
  });

  // apiKey is never stored in plaintext anywhere — only its hash. This
  // response is the only place it will ever appear.
  res.status(201).json({
    id: partner.id,
    name: partner.name,
    publicId: partner.publicId,
    apiKey,
  });
});
