import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { DeveloperRequest, requireDeveloper, signDeveloperSession } from "../lib/developerAuth";
import { prisma } from "../lib/prisma";
import { newVerificationToken, normaliseDomain, verifyPartnerDomain } from "../lib/domain";
import { CUSTOM_KEY_PATTERN, FIELD_TYPES, standardField } from "../lib/fields";
import { generateSecret, hashSecret } from "../lib/secrets";
import {
  clearLoginFailures,
  clientIp,
  loginAllowed,
  passwordMatches,
  recordLoginFailure,
  signupAllowed,
  TOO_MANY_ATTEMPTS,
  TOO_MANY_SIGNUPS,
} from "../lib/security";

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
  if (!(await signupAllowed(clientIp(req)))) return res.status(429).json({ error: TOO_MANY_SIGNUPS });

  if (await prisma.developer.findUnique({ where: { email } })) {
    return res.status(409).json({ error: "email already registered" });
  }
  const developer = await prisma.developer
    .create({ data: { email, name, passwordHash: await bcrypt.hash(password, 12) } })
    .catch((err) => {
      if ((err as { code?: string }).code === "P2002") return null;
      throw err;
    });
  if (!developer) return res.status(409).json({ error: "email already registered" });
  res.status(201).json({ token: signDeveloperSession(developer.id, developer.sessionVersion), developer: publicDeveloper(developer) });
});

developerRouter.post("/auth/login", async (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const ip = clientIp(req);
  if (!(await loginAllowed(`developer:${email}`, ip))) return res.status(429).json({ error: TOO_MANY_ATTEMPTS });

  const developer = await prisma.developer.findUnique({ where: { email } });
  if (!(await passwordMatches(developer?.passwordHash, password)) || !developer) {
    await recordLoginFailure(`developer:${email}`, ip);
    return res.status(401).json({ error: "invalid email or password" });
  }
  await clearLoginFailures(`developer:${email}`);
  res.json({ token: signDeveloperSession(developer.id, developer.sessionVersion), developer: publicDeveloper(developer) });
});

// Ends every console session this developer has, on every device.
developerRouter.post("/auth/logout-everywhere", requireDeveloper, async (req: DeveloperRequest, res) => {
  await prisma.developer.update({ where: { id: req.developerId! }, data: { sessionVersion: { increment: 1 } } });
  res.json({ ok: true });
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
  domain: true,
  domainVerificationToken: true,
  domainVerifiedAt: true,
  fields: {
    select: { key: true, required: true, custom: true, label: true, type: true, options: true },
    orderBy: { createdAt: "asc" as const },
  },
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

const nameSchema = z.string().trim().min(1).max(100);
// The details a site declares: standard ones by key, or its own custom ones
// (with a label and type). Each is required or optional.
const declaredFieldSchema = z
  .object({
    key: z.string().regex(CUSTOM_KEY_PATTERN, "keys are lowercase letters, digits and _"),
    required: z.boolean().default(false),
    custom: z
      .object({
        label: z.string().trim().min(1).max(60),
        type: z.enum(FIELD_TYPES),
        options: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
      })
      .optional(),
  })
  .superRefine((f, ctx) => {
    if (!f.custom && !standardField(f.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${f.key} isn't a standard detail; describe it as a custom one` });
    if (f.custom && standardField(f.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${f.key} is a standard detail; pick another key for a custom one` });
    if (f.custom?.type === "choice" && !f.custom.options?.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `list the options for ${f.key}` });
  });
const declaredFieldsSchema = z
  .array(declaredFieldSchema)
  .max(60)
  .refine((fs) => new Set(fs.map((f) => f.key)).size === fs.length, "each key can only be declared once");

function fieldRows(partnerId: string, fields: z.infer<typeof declaredFieldsSchema>) {
  return fields.map((f) => ({
    partnerId,
    key: f.key,
    required: f.required,
    custom: Boolean(f.custom),
    label: f.custom?.label ?? null,
    type: f.custom?.type ?? null,
    options: f.custom?.type === "choice" ? f.custom.options ?? [] : [],
  }));
}
const domainSchema = z.string().transform((value, ctx) => {
  const domain = normaliseDomain(value);
  if (!domain) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "enter the site's domain, e.g. shop.example.com" });
    return z.NEVER;
  }
  return domain;
});

apps.post("/", async (req: DeveloperRequest, res) => {
  const parsed = z
    .object({ name: nameSchema, domain: domainSchema, fields: declaredFieldsSchema.optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  const { apiKey, apiKeyHash, apiKeyPreview } = issueKey();
  const app = await prisma.partner.create({
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain,
      domainVerificationToken: newVerificationToken(),
      developerId: req.developerId!,
      apiKeyHash,
      apiKeyPreview,
    },
    select: { id: true },
  });
  if (parsed.data.fields?.length) {
    await prisma.partnerField.createMany({ data: fieldRows(app.id, parsed.data.fields) });
  }
  res.status(201).json({ app: await prisma.partner.findUnique({ where: { id: app.id }, select: appSelect }), apiKey });
});

// Replaces the key outright, the old one stops working on the next request.
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

// Account-linking redirect URIs (see /link/authorize), validated against
// exactly this list, so they have to be registered before linking works.
// Name, domain and account-linking redirect URIs (see /link/authorize).
// Changing the domain drops its verification, since it's a different site.
apps.patch("/:id", async (req: DeveloperRequest, res) => {
  const parsed = z
    .object({
      name: nameSchema.optional(),
      domain: domainSchema.optional(),
      linkRedirectUris: z.array(z.string().url().refine((u) => /^https?:\/\//.test(u))).max(10).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  const existing = await findOwnApp(req.developerId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "app not found" });

  const { name, domain, linkRedirectUris } = parsed.data;
  const domainChanged = domain !== undefined && domain !== existing.domain;
  const app = await prisma.partner.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(linkRedirectUris !== undefined ? { linkRedirectUris } : {}),
      ...(domainChanged ? { domain, domainVerificationToken: newVerificationToken(), domainVerifiedAt: null } : {}),
    },
    select: appSelect,
  });
  res.json({ app });
});

// Replaces the app's declared details in one go.
apps.put("/:id/fields", async (req: DeveloperRequest, res) => {
  const parsed = z.object({ fields: declaredFieldsSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const existing = await findOwnApp(req.developerId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "app not found" });

  await prisma.$transaction([
    prisma.partnerField.deleteMany({ where: { partnerId: existing.id } }),
    prisma.partnerField.createMany({ data: fieldRows(existing.id, parsed.data.fields) }),
  ]);
  res.json({ app: await prisma.partner.findUnique({ where: { id: existing.id }, select: appSelect }) });
});

apps.post("/:id/verify-domain", async (req: DeveloperRequest, res) => {
  const existing = await findOwnApp(req.developerId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "app not found" });
  if (existing.revokedAt) return res.status(409).json({ error: "app is revoked" });

  const outcome = await verifyPartnerDomain(existing.id);
  if (!outcome.ok) {
    const messages = {
      no_domain: "Set the app's domain first.",
      taken: "That domain is already verified by another account.",
      unreachable:
        outcome.detail === "the site answered 401"
          ? `${existing.domain} couldn't get its verification token: Assentry refused the site's API key. Make sure the site is running with this app's current key (and has finished redeploying), then try again.`
          : `Couldn't fetch the verification file from ${existing.domain}${outcome.detail ? ` (${outcome.detail})` : ""}. Is the site deployed with @assentry/sdk 0.8 or later and assentryDiscovery({ partnerName, assentry })?`,
      token_mismatch: `${existing.domain} is serving a different verification token. Check the site uses this app's API key.`,
    };
    return res.status(422).json({ error: messages[outcome.error] });
  }
  const app = await prisma.partner.findUnique({ where: { id: existing.id }, select: appSelect });
  res.json({ app });
});

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "invalid input";
}
