import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { FIELD_TYPES, GENERIC_FILE_RULES, personKey, STANDARD_FIELDS, TYPE_FORMATS, type FieldDef, type FileValue } from "../lib/fields";
import { prisma } from "../lib/prisma";
import { deleteFile, fieldDefFor, keyKind, publicBaseUrl, removeValue, resolveRequests, setValue } from "../lib/profile";
import { contentMatchesType, storage } from "../lib/storage";
import { sendFile } from "./files";
import { AuthedRequest, requireUser } from "../lib/userAuth";

// The signed-in person's own profile: details they declare about themselves.
// Assentry checks the format, not the truth. Websites only ever see what
// lib/profile.ts releaseFor allows, through /profile.
export const meRouter = Router();
meRouter.use(requireUser);

// ---- Profile ----

function describe(def: FieldDef) {
  return {
    key: def.key,
    label: def.label,
    type: def.type,
    group: def.group,
    options: def.options?.length ? def.options : undefined,
    format: TYPE_FORMATS[def.type],
    file: def.type === "file" ? def.file : undefined,
  };
}

meRouter.get("/profile", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const [user, values, custom, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { agentAutoFill: true } }),
    prisma.profileValue.findMany({ where: { userId } }),
    prisma.userField.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.fieldRequest.findMany({
      where: { userId },
      include: { partner: { select: { id: true, name: true, domain: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!user) return res.status(401).json({ error: "user not found" });

  // Site details: the site's own custom details the person has been asked for
  // (or has filled in), so they stay editable after the request is resolved.
  const siteDetails = [];
  for (const r of requests.filter((r) => keyKind(r.key) === "site")) {
    const def = await fieldDefFor(userId, r.key);
    if (def) siteDetails.push({ ...describe(def), site: r.partner, required: r.required });
  }

  res.json({
    standard: STANDARD_FIELDS.map(describe),
    custom: custom.map((f) => describe({ key: f.key, label: f.label, type: f.type as FieldDef["type"], options: f.options, file: GENERIC_FILE_RULES })),
    siteDetails,
    requests: await openRequests(userId),
    values: Object.fromEntries(
      values.map((v) => [v.key, { value: v.value, source: v.source, status: v.status, updatedAt: v.updatedAt }])
    ),
    settings: { agentAutoFill: user.agentAutoFill },
  });
});

/** Open site requests, for the notice list and badge. */
async function openRequests(userId: string) {
  const rows = await prisma.fieldRequest.findMany({
    where: { userId, resolvedAt: null },
    include: { partner: { select: { id: true, name: true, domain: true } } },
    orderBy: { createdAt: "desc" },
  });
  const out = [];
  for (const r of rows) {
    const def = await fieldDefFor(userId, r.key);
    if (!def) continue;
    const value = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key: r.key } } });
    out.push({
      id: r.id,
      key: r.key,
      label: def.label,
      type: def.type,
      required: r.required,
      site: r.partner,
      // "fill": nothing entered yet; "share": filled in, just needs the OK to share with this site.
      action: value?.status === "confirmed" ? "share" : "fill",
      createdAt: r.createdAt,
    });
  }
  return out;
}

meRouter.get("/notices", async (req: AuthedRequest, res) => {
  const [requests, suggestions] = await Promise.all([
    openRequests(req.userId!),
    prisma.profileValue.count({ where: { userId: req.userId!, status: "suggested" } }),
  ]);
  res.json({ requests, suggestions, count: requests.length + suggestions });
});

meRouter.put("/profile/values/:key", async (req: AuthedRequest, res) => {
  const result = await setValue(req.userId!, req.params.key, req.body?.value, { source: "person" });
  if (!result.ok) return res.status(result.status ?? 400).json({ error: result.error });
  const value = await prisma.profileValue.findUnique({ where: { userId_key: { userId: req.userId!, key: req.params.key } } });
  res.json({ value: value?.value });
});

meRouter.delete("/profile/values/:key", async (req: AuthedRequest, res) => {
  await removeValue(req.userId!, req.params.key);
  res.json({ ok: true });
});

/** Accept a value an agent suggested (it becomes the person's own, confirmed). */
meRouter.post("/profile/values/:key/confirm", async (req: AuthedRequest, res) => {
  const updated = await prisma.profileValue.updateMany({
    where: { userId: req.userId!, key: req.params.key, status: "suggested" },
    data: { status: "confirmed" },
  });
  if (updated.count === 0) return res.status(404).json({ error: "no suggestion to confirm" });
  await resolveRequests(req.userId!, req.params.key);
  res.json({ ok: true });
});

/** "Share" on a request for a detail already filled in: consent for that one site. */
meRouter.post("/requests/:id/share", async (req: AuthedRequest, res) => {
  const r = await prisma.fieldRequest.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!r) return res.status(404).json({ error: "request not found" });
  const value = await prisma.profileValue.findUnique({ where: { userId_key: { userId: req.userId!, key: r.key } } });
  if (value?.status !== "confirmed") return res.status(409).json({ error: "fill it in first" });
  await prisma.fieldRequest.update({ where: { id: r.id }, data: { resolvedAt: new Date() } });
  res.json({ ok: true });
});

meRouter.post("/requests/:id/dismiss", async (req: AuthedRequest, res) => {
  await prisma.fieldRequest.deleteMany({ where: { id: req.params.id, userId: req.userId! } });
  res.json({ ok: true });
});

// The person's own details (label + type). Private to them.
const customFieldSchema = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
});

meRouter.post("/fields", async (req: AuthedRequest, res) => {
  const parsed = customFieldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "give the detail a name and a type" });
  const { label, type, options } = parsed.data;
  if (type === "choice" && !options?.length) return res.status(400).json({ error: "list the options to choose from" });

  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "detail";
  let key = personKey(/^[a-z]/.test(base) ? base : `d_${base}`);
  for (let i = 2; await prisma.userField.findUnique({ where: { userId_key: { userId: req.userId!, key } } }); i++) {
    key = personKey(`${base}_${i}`);
  }
  const field = await prisma.userField.create({
    data: { userId: req.userId!, key, label, type, options: type === "choice" ? options ?? [] : [] },
  });
  res.status(201).json({ field });
});

meRouter.delete("/fields/:key", async (req: AuthedRequest, res) => {
  if (keyKind(req.params.key) !== "person") return res.status(400).json({ error: "only your own details can be removed" });
  await removeValue(req.userId!, req.params.key);
  await prisma.userField.deleteMany({ where: { userId: req.userId!, key: req.params.key } });
  res.json({ ok: true });
});

meRouter.put("/settings", async (req: AuthedRequest, res) => {
  const parsed = z.object({ agentAutoFill: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid settings" });
  await prisma.user.update({ where: { id: req.userId! }, data: parsed.data });
  res.json({ settings: parsed.data });
});

// ---- Files ----
// 1. POST /me/files with the detail and file facts: Assentry checks the kind
//    and size and returns a one-time upload URL.
// 2. The browser uploads straight to storage.
// 3. POST /me/files/:id/complete: Assentry checks the bytes really are that
//    kind, fingerprints them, and makes the file the detail's value.

const startUploadSchema = z.object({
  fieldKey: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive(),
});

meRouter.post("/files", async (req: AuthedRequest, res) => {
  const parsed = startUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid upload" });
  const { fieldKey, filename, contentType, size } = parsed.data;
  const def = await fieldDefFor(req.userId!, fieldKey);
  if (!def || def.type !== "file") return res.status(400).json({ error: "this detail doesn't take a file" });
  const rules = def.file ?? GENERIC_FILE_RULES;
  if (!rules.contentTypes.includes(contentType)) return res.status(400).json({ error: "that kind of file isn't accepted here" });
  if (size > rules.maxBytes) return res.status(400).json({ error: `files must be ${rules.maxBytes / 1024 / 1024} MB or smaller` });

  const storageKey = `${req.userId}/${crypto.randomUUID()}`;
  const file = await prisma.storedFile.create({
    data: { userId: req.userId!, fieldKey, filename: filename.replace(/[\r\n"]/g, ""), contentType, size, storageKey },
  });
  const upload = await storage.presignUpload(storageKey, contentType, size, publicBaseUrl(req));
  res.status(201).json({ fileId: file.id, upload });
});

meRouter.post("/files/:id/complete", async (req: AuthedRequest, res) => {
  const file = await prisma.storedFile.findFirst({ where: { id: req.params.id, userId: req.userId!, completedAt: null } });
  if (!file) return res.status(404).json({ error: "upload not found" });
  const bytes = await storage.read(file.storageKey);
  if (!bytes || bytes.length !== file.size || !contentMatchesType(bytes, file.contentType)) {
    await deleteFile(file.id);
    return res.status(422).json({ error: "the file didn't arrive intact, or isn't the kind of file it claims to be" });
  }
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  await prisma.storedFile.update({ where: { id: file.id }, data: { sha256, completedAt: new Date() } });

  // Replace whatever file this detail had before.
  await removeValue(req.userId!, file.fieldKey);
  const value: FileValue = { fileId: file.id, filename: file.filename, contentType: file.contentType, size: file.size, sha256 };
  await prisma.profileValue.create({ data: { userId: req.userId!, key: file.fieldKey, value: value as object } });
  await resolveRequests(req.userId!, file.fieldKey);
  res.json({ value });
});

/** The person downloading their own file (e.g. to check it). */
meRouter.get("/files/:id", async (req: AuthedRequest, res) => {
  const file = await prisma.storedFile.findFirst({ where: { id: req.params.id, userId: req.userId!, completedAt: { not: null } } });
  if (!file) return res.status(404).json({ error: "file not found" });
  const bytes = await storage.read(file.storageKey);
  if (!bytes) return res.status(404).json({ error: "file not found" });
  sendFile(res, file, bytes);
});

// The person's browser-agent sign-ins: which agent signed in to which site,
// when, and whether it's still active. Ending one stops the credential
// issued for it (it carries the sign-in's id) without touching the grant.
meRouter.get("/sign-ins", async (req: AuthedRequest, res) => {
  const rows = await prisma.signInRequest.findMany({
    where: { grant: { userId: req.userId! }, collectedAt: { not: null } },
    include: {
      partner: { select: { name: true, domain: true } },
      grant: { select: { id: true, revokedAt: true, expiresAt: true, agent: { select: { id: true, label: true, platform: true, revokedAt: true } } } },
    },
    orderBy: { collectedAt: "desc" },
    take: 100,
  });
  const now = Date.now();
  res.json({
    signIns: rows.map((r) => ({
      id: r.id,
      site: { name: r.partner.name, domain: r.partner.domain },
      agent: { id: r.grant!.agent.id, label: r.grant!.agent.label, platform: r.grant!.agent.platform },
      signedInAt: r.collectedAt,
      endedAt: r.endedAt,
      active:
        !r.endedAt &&
        !r.grant!.revokedAt &&
        !r.grant!.agent.revokedAt &&
        r.grant!.expiresAt.getTime() > now,
    })),
  });
});

meRouter.post("/sign-ins/:id/end", async (req: AuthedRequest, res) => {
  const signIn = await prisma.signInRequest.findFirst({
    where: { id: req.params.id, grant: { userId: req.userId! } },
    include: { grant: true },
  });
  if (!signIn || !signIn.grant) return res.status(404).json({ error: "sign-in not found" });
  if (!signIn.endedAt) {
    await prisma.signInRequest.update({ where: { id: signIn.id }, data: { endedAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        userId: req.userId!,
        agentId: signIn.grant.agentId,
        grantId: signIn.grant.id,
        partnerId: signIn.partnerId,
        action: "sign_in_ended",
        result: "allowed",
        reason: "user_requested",
        metadata: { signInId: signIn.id },
      },
    });
  }
  res.json({ ok: true });
});
