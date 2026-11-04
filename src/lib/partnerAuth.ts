import { NextFunction, Request, Response } from "express";
import { hashSecret } from "./secrets";
import { prisma } from "./prisma";

export interface PartnerRequest extends Request {
  partner?: { id: string };
}

export const hashPartnerKey = hashSecret;

export async function requirePartner(
  req: PartnerRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-assentry-api-key"];
  if (typeof apiKey !== "string") {
    return res.status(401).json({ error: "missing x-assentry-api-key header" });
  }
  const partner = await prisma.partner.findUnique({
    where: { apiKeyHash: hashPartnerKey(apiKey) },
  });
  // A revoked key gets exactly the same response as an unknown one.
  if (!partner || partner.revokedAt) {
    return res.status(401).json({ error: "invalid api key" });
  }
  req.partner = { id: partner.id };
  next();
}
