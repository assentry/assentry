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
