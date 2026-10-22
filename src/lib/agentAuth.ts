import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";
import { hashSecret } from "./secrets";

export interface AgentApiRequest extends Request {
  agent?: { id: string; userId: string };
}

// Authenticates the connector running inside a user's AI — distinct from
// requireUser (the human's session) and requirePartner (a business's API
// key). The bearer token here is always OAuth-issued (see routes/oauthToken.ts);
// nothing in this system ever shows this value to a human to type or paste.
export async function requireAgentKey(
  req: AgentApiRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  const key = header.slice("Bearer ".length);

  const agent = await prisma.agent.findUnique({
    where: { secretHash: hashSecret(key) },
  });
  if (!agent || agent.revokedAt) {
    return res.status(401).json({ error: "invalid or revoked agent key" });
  }
  req.agent = { id: agent.id, userId: agent.userId };
  next();
}
