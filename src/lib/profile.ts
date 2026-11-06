import type { Grant, Partner, PartnerField } from "@prisma/client";
import crypto from "crypto";
import {
  CUSTOM_KEY_PATTERN,
  GENERIC_FILE_RULES,
  normaliseValue,
  siteKey,
  standardField,
  type AddressValue,
  type FieldDef,
  type FileValue,
} from "./fields";
import { prisma } from "./prisma";
import { storage } from "./storage";

// Profile keys come in three kinds:
//   "email"                     a standard detail, shared across sites
//   "my:<slug>"                 a detail the person added for themselves (never shared)
//   "site:<partnerId>:<key>"    a site's own custom detail, only ever shared with that site

export type KeyKind = "standard" | "person" | "site";

export function keyKind(key: string): KeyKind {
  if (key.startsWith("my:")) return "person";
  if (key.startsWith("site:")) return "site";
  return "standard";
}

function parseSiteKey(key: string): { partnerId: string; key: string } | null {
  const m = /^site:([0-9a-f-]{36}):([a-z][a-z0-9_]{0,39})$/.exec(key);
  return m ? { partnerId: m[1], key: m[2] } : null;
}

/** The definition (label, type, options) of any profile key, for this person. */
export async function fieldDefFor(userId: string, key: string): Promise<FieldDef | null> {
  const kind = keyKind(key);
  if (kind === "standard") return standardField(key) ?? null;
  if (kind === "person") {
    const f = await prisma.userField.findUnique({ where: { userId_key: { userId, key } } });
    return f ? { key, label: f.label, type: f.type as FieldDef["type"], options: f.options, file: GENERIC_FILE_RULES } : null;
  }
  const parsed = parseSiteKey(key);
  if (!parsed) return null;
  const f = await prisma.partnerField.findUnique({ where: { partnerId_key: { partnerId: parsed.partnerId, key: parsed.key } } });
  return f?.custom ? partnerFieldDef(f) : null;
}

export function partnerFieldDef(f: PartnerField): FieldDef {
  if (!f.custom) return standardField(f.key)!;
  return {
    key: siteKey(f.partnerId, f.key),
    label: f.label ?? f.key,
    type: f.type as FieldDef["type"],
    options: f.options,
    file: GENERIC_FILE_RULES,
  };
}

/** The profile key a site's declared detail is stored under. */
export function profileKeyFor(f: Pick<PartnerField, "partnerId" | "key" | "custom">): string {
  return f.custom ? siteKey(f.partnerId, f.key) : f.key;
}

export type SetValueResult = { ok: true } | { ok: false; error: string; status?: number };

/**
 * Saves a value for one of the person's details, normalised to its type.
 * Values from the person are confirmed straight away; agent suggestions wait
 * for the person unless they turned on "let my agent fill in missing details".
 * Confirming a value a site asked for also resolves that request, which is
 * the person's consent to share it with that site.
 */
export async function setValue(
  userId: string,
  key: string,
  raw: unknown,
  opts: { source: "person" | "agent"; agentId?: string } = { source: "person" }
): Promise<SetValueResult> {
  const def = await fieldDefFor(userId, key);
  if (!def) return { ok: false, error: "unknown detail", status: 404 };
  if (def.type === "file") return { ok: false, error: "upload a file for this detail" };

  const address = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key: "address" } } });
  const country = (address?.value as AddressValue | null)?.country;
  const normalised = normaliseValue(def, raw, { country });
  if (!normalised.ok) return { ok: false, error: normalised.error };

  let status = "confirmed";
  if (opts.source === "agent") {
    const existing = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key } } });
    if (existing?.status === "confirmed") {
      return { ok: false, error: "the person has already filled this in", status: 409 };
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { agentAutoFill: true } });
    status = user?.agentAutoFill ? "confirmed" : "suggested";
  }

  await prisma.profileValue.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value: normalised.value as object, source: opts.source, status, agentId: opts.agentId },
    update: { value: normalised.value as object, source: opts.source, status, agentId: opts.agentId ?? null },
  });
  if (status === "confirmed") await resolveRequests(userId, key);
  return { ok: true };
}

export async function resolveRequests(userId: string, key: string): Promise<void> {
  await prisma.fieldRequest.updateMany({
    where: { userId, key, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}

export async function removeValue(userId: string, key: string): Promise<void> {
  const existing = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key } } });
  if (!existing) return;
  await prisma.profileValue.delete({ where: { id: existing.id } });
  const file = existing.value as Partial<FileValue> | null;
  if (file && typeof file === "object" && typeof file.fileId === "string") await deleteFile(file.fileId);
}

export async function deleteFile(fileId: string): Promise<void> {
  const f = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!f) return;
  await storage.remove(f.storageKey).catch(() => {});
  await prisma.storedFile.delete({ where: { id: f.id } });
}

// ---- What a site receives ----

const DOWNLOAD_TTL_MS = 5 * 60 * 1000;

export interface ReleasedFile {
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  url: string;
  expiresAt: string;
}

export interface Release {
  profile: Record<string, unknown>;
  meta: Record<string, { source: string; updatedAt: string }>;
  /** Required details the site declared that it isn't getting (missing, or not allowed). */
  missing: string[];
  undeclaredFields: string[];
}

/**
 * Decides exactly what one site gets. A detail is released only if:
 * - the site declared it, and
 * - for a standard detail: the person's grant allows it, or the person
 *   filled it in when this site asked for it; for a site's own custom
 *   detail: the person filled it in (which was asking to share it), and
 * - the person has a confirmed value (agent suggestions they haven't
 *   confirmed are never shared).
 */
export async function releaseFor(
  partner: Partner,
  grant: Grant,
  requested: string[],
  baseUrl: string
): Promise<Release> {
  const declared = await prisma.partnerField.findMany({ where: { partnerId: partner.id } });
  const byKey = new Map(declared.map((f) => [f.key, f]));
  const consentedForSite = new Set(
    (
      await prisma.fieldRequest.findMany({
        where: { userId: grant.userId, partnerId: partner.id, resolvedAt: { not: null } },
        select: { key: true },
      })
    ).map((r) => r.key)
  );

  const out: Release = { profile: {}, meta: {}, missing: [], undeclaredFields: [] };
  const wanted = Array.from(new Set(requested));
  for (const key of wanted) {
    const decl = byKey.get(key);
    if (!decl) {
      out.undeclaredFields.push(key);
      continue;
    }
    const pKey = profileKeyFor(decl);
    const allowed = decl.custom || grant.consentedFields.includes(key) || consentedForSite.has(pKey);
    const value = allowed
      ? await prisma.profileValue.findUnique({ where: { userId_key: { userId: grant.userId, key: pKey } } })
      : null;
    if (!value || value.status !== "confirmed") {
      if (decl.required) out.missing.push(key);
      continue;
    }
    const def = partnerFieldDef(decl);
    out.profile[key] =
      def.type === "file" ? await fileForSite(value.value as unknown as FileValue, partner.id, baseUrl) : value.value;
    out.meta[key] = { source: value.source, updatedAt: value.updatedAt.toISOString() };
  }
  return out;
}

async function fileForSite(file: FileValue, partnerId: string, baseUrl: string): Promise<ReleasedFile> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
  await prisma.fileDownloadToken.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      fileId: file.fileId,
      partnerId,
      expiresAt,
    },
  });
  return {
    filename: file.filename,
    contentType: file.contentType,
    size: file.size,
    sha256: file.sha256,
    url: `${baseUrl}/files/download/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}

// ---- Asking the person for what's missing ----

export interface MissingDetail {
  key: string; // as the site knows it
  label: string;
  type: string;
  required: boolean;
  /** "missing": the person hasn't filled it in. "not_allowed": they have, but their permission doesn't include it. */
  reason: "missing" | "not_allowed";
}

/**
 * When an agent signs in to a site, compares what the site declared with
 * what the person can share. Anything not filled in becomes an in-app
 * request to the person; the agent is told what's missing.
 */
export async function requestMissingDetails(partner: Partner, grant: Grant): Promise<MissingDetail[]> {
  const declared = await prisma.partnerField.findMany({ where: { partnerId: partner.id } });
  const out: MissingDetail[] = [];
  for (const decl of declared) {
    const pKey = profileKeyFor(decl);
    const value = await prisma.profileValue.findUnique({ where: { userId_key: { userId: grant.userId, key: pKey } } });
    const def = partnerFieldDef(decl);
    if (!value || value.status !== "confirmed") {
      out.push({ key: decl.key, label: def.label, type: def.type, required: decl.required, reason: "missing" });
      await prisma.fieldRequest.upsert({
        where: { userId_partnerId_key: { userId: grant.userId, partnerId: partner.id, key: pKey } },
        create: { userId: grant.userId, partnerId: partner.id, key: pKey, required: decl.required },
        update: { required: decl.required, resolvedAt: null },
      });
      continue;
    }
    if (!decl.custom && !grant.consentedFields.includes(decl.key)) {
      const consented = await prisma.fieldRequest.findFirst({
        where: { userId: grant.userId, partnerId: partner.id, key: pKey, resolvedAt: { not: null } },
      });
      if (!consented) {
        out.push({ key: decl.key, label: def.label, type: def.type, required: decl.required, reason: "not_allowed" });
        // Ask the person whether to share it with this site (one tap in the app).
        await prisma.fieldRequest.upsert({
          where: { userId_partnerId_key: { userId: grant.userId, partnerId: partner.id, key: pKey } },
          create: { userId: grant.userId, partnerId: partner.id, key: pKey, required: decl.required },
          update: { required: decl.required },
        });
      }
    }
  }
  return out;
}

export { CUSTOM_KEY_PATTERN };

/** Assentry's own public origin, for links it hands out (file downloads, local uploads). */
export function publicBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  const configured = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}
