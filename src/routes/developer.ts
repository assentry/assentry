import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { DeveloperRequest, requireDeveloper, signDeveloperSession } from "../lib/developerAuth";
import { prisma } from "../lib/prisma";
import { generateSecret, hashSecret } from "../lib/secrets";

// The developer console's API: developer accounts (separate from end-user
// accounts) and the partner apps + API keys they own.
export const developerRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

function publicDeveloper(d: { id: string; email: string; name: string | null }) {
  return { id: d.id, email: d.email, name: d.name };
}

developerRouter.post("/auth/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name } = parsed.data;

  if (await prisma.developer.findUnique({ where: { email } })) {
    return res.status(409).json({ error: "email already registered" });
  }
  const developer = await prisma.developer.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
  });
  res.status(201).json({ token: signDeveloperSession(developer.id), developer: publicDeveloper(developer) });
});

developerRouter.post("/auth/login", async (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const developer = await prisma.developer.findUnique({ where: { email } });
  if (!developer || !(await bcrypt.compare(password, developer.passwordHash))) {
    return res.status(401).json({ error: "invalid email or password" });
  }
  res.json({ token: signDeveloperSession(developer.id), developer: publicDeveloper(developer) });
});

developerRouter.get("/auth/me", requireDeveloper, async (req: DeveloperRequest, res) => {
  const developer = await prisma.developer.findUnique({ where: { id: req.developerId! } });
  if (!developer) return res.status(401).json({ error: "developer not found" });
  res.json({ developer: publicDeveloper(developer) });
});

// Everything below manages apps, always scoped to the logged-in developer.
const apps = Router();
apps.use(requireDeveloper);
developerRouter.use("/apps", apps);

const appSelect = {
  id: true,
  name: true,
  publicId: true,
  apiKeyPreview: true,
  linkRedirectUris: true,
  createdAt: true,
  revokedAt: true,
} as const;

// A new key, plus the non-secret preview stored alongside its hash. The
// full key exists only in the response that issues it.
function issueKey() {
  const apiKey = generateSecret("assentry");
  return { apiKey, apiKeyHash: hashSecret(apiKey), apiKeyPreview: `${apiKey.slice(0, 12)}…` };
}

async function findOwnApp(developerId: string, id: string) {
  return prisma.partner.findFirst({ where: { id, developerId } });
}

apps.get("/", async (req: DeveloperRequest, res) => {
  const list = await prisma.partner.findMany({
    where: { developerId: req.developerId! },
    select: appSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json({ apps: list });
});

apps.post("/", async (req: DeveloperRequest, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { apiKey, apiKeyHash, apiKeyPreview } = issueKey();
  const app = await prisma.partner.create({
    data: { name: parsed.data.name, developerId: req.developerId!, apiKeyHash, apiKeyPreview },
    select: appSelect,
  });
  res.status(201).json({ app, apiKey });
});

// Replaces the key outright — the old one stops working on the next request.
apps.post("/:id/rotate", async (req: DeveloperRequest, res) => {
  const existing = await findOwnApp(req.developerId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "app not found" });
  if (existing.revokedAt) return res.status(409).json({ error: "app is revoked" });

  const { apiKey, apiKeyHash, apiKeyPreview } = issueKey();
  const app = await prisma.partner.update({
    where: { id: existing.id },
    data: { apiKeyHash, apiKeyPreview },
    select: appSelect,
  });
  res.json({ app, apiKey });
});

apps.post("/:id/revoke", async (req: DeveloperRequest, res) => {
  const existing = await findOwnApp(req.developerId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "app not found" });

  const app = await prisma.partner.update({
    where: { id: existing.id },
    data: { revokedAt: existing.revokedAt ?? new Date() },
    select: appSelect,
  });
  res.json({ app });
});

// Account-linking redirect URIs (see /link/authorize) — validated against
// exactly this list, so they have to be registered before linking works.
apps.patch("/:id", async (req: DeveloperRequest, res) => {
  const parsed = z
    .object({ linkRedirectUris: z.array(z.string().url().refine((u) => /^https?:\/\//.test(u))).max(10) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await findOwnApp(req.developerId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "app not found" });

  const app = await prisma.partner.update({
    where: { id: existing.id },
    data: { linkRedirectUris: parsed.data.linkRedirectUris },
    select: appSelect,
  });
  res.json({ app });
});
