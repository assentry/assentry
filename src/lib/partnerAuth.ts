import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";

export interface PartnerRequest extends Request {
  partner?: { id: string; allowedScopes: string[] };
}

export function hashApiKey(apiKey: string): string {
  // API keys are high-entropy, server-generated tokens (not user-chosen
  // passwords), so a fast deterministic hash is appropriate here and lets
  // us look the partner up directly instead of scanning with bcrypt.compare.
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export async function requirePartner(
  req: PartnerRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-hapi-api-key"];
  if (typeof apiKey !== "string") {
    return res.status(401).json({ error: "missing x-hapi-api-key header" });
  }
  const partner = await prisma.partner.findUnique({
    where: { apiKeyHash: hashApiKey(apiKey) },
  });
  if (!partner) {
    return res.status(401).json({ error: "invalid api key" });
  }
  req.partner = { id: partner.id, allowedScopes: partner.allowedScopes };
  next();
}
