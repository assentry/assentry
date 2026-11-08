import crypto from "crypto";
import express, { Response, Router } from "express";
import { MAX_FILE_BYTES, STANDARD_FIELDS, TYPE_FORMATS } from "../lib/fields";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { prisma } from "../lib/prisma";
import { storage, verifyLocalUpload } from "../lib/storage";

export const filesRouter = Router();

/** Always a download, never rendered: an uploaded file can't run in anyone's browser. */
export function sendFile(res: Response, file: { filename: string; contentType: string; sha256: string | null }, bytes: Buffer) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename.replace(/[^\x20-\x7e]|"/g, "_")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cache-Control", "no-store");
  if (file.sha256) res.setHeader("Digest", `sha-256=${Buffer.from(file.sha256, "hex").toString("base64")}`);
  res.send(bytes);
}

// Stand-in for a presigned storage URL when files are kept locally or in the database.
filesRouter.put(
  "/local-upload/:token",
  express.raw({ type: () => true, limit: MAX_FILE_BYTES + 1024 }),
  async (req, res) => {
    if (!storage.write) return res.status(404).end();
    const target = verifyLocalUpload(req.params.token);
    if (!target) return res.status(403).json({ error: "upload link expired or invalid" });
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length !== target.size || req.headers["content-type"] !== target.contentType) {
      return res.status(400).json({ error: "upload doesn't match what was declared" });
    }
    // One upload per file, before it's checked: a finished file can't be
    // swapped for different bytes through the same link.
    const file = await prisma.storedFile.findUnique({ where: { storageKey: target.key }, select: { completedAt: true } });
    if (!file || file.completedAt) return res.status(409).json({ error: "this upload is already finished" });
    await storage.write(target.key, body);
    res.status(200).end();
  }
);

// A site downloading a file it's been given (from /profile). The link works
// once, for 5 minutes, and only with that site's own API key, so a leaked
// link is useless to anyone else.
filesRouter.get("/download/:token", requirePartner, async (req: PartnerRequest, res) => {
  const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const token = await prisma.fileDownloadToken.findUnique({ where: { tokenHash }, include: { file: true } });
  if (!token || token.partnerId !== req.partner!.id || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    return res.status(404).json({ error: "download link expired, already used, or not yours" });
  }
  const claimed = await prisma.fileDownloadToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return res.status(404).json({ error: "download link already used" });

  const bytes = await storage.read(token.file.storageKey);
  if (!bytes) return res.status(404).json({ error: "file no longer exists" });
  await prisma.auditLog.create({
    data: {
      userId: token.file.userId,
      partnerId: token.partnerId,
      action: "file_download",
      result: "allowed",
      reason: "ok",
      metadata: { detail: token.file.fieldKey, filename: token.file.filename, size: token.file.size },
    },
  });
  sendFile(res, token.file, bytes);
});

// The catalogue of standard details and their types, for the apps and docs.
export const fieldsCatalogueRouter = Router();
fieldsCatalogueRouter.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    fields: STANDARD_FIELDS.map((f) => ({ ...f, format: TYPE_FORMATS[f.type] })),
    types: Object.entries(TYPE_FORMATS).map(([type, format]) => ({ type, format })),
  });
});
