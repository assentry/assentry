import { NextFunction, Request, Response } from "express";
import { hashSecret } from "./secrets";
import { prisma } from "./prisma";

export interface PartnerRequest extends Request {
  partner?: { id: string };
}

export const hashApiKey = hashSecret;

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
  req.partner = { id: partner.id };
  next();
}
