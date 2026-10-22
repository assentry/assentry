import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";
import { hashSecret } from "./secrets";

export interface AgentApiRequest extends Request {
  agent?: { id: string; userId: string };
}

// Authenticates the connector running inside a user's AI — distinct from
// requireUser (the human's session) and requirePartner (a business's API
// key). This is the identity Claude/GPT/Grok itself presents.
export async function requireAgentKey(
  req: AgentApiRequest,
  res: Response,
  next: NextFunction
) {
  const key = req.headers["x-hapi-agent-key"];
  if (typeof key !== "string") {
    return res.status(401).json({ error: "missing x-hapi-agent-key header" });
  }
  const agent = await prisma.agent.findUnique({
    where: { secretHash: hashSecret(key) },
  });
  if (!agent || agent.revokedAt) {
    return res.status(401).json({ error: "invalid or revoked agent key" });
  }
  req.agent = { id: agent.id, userId: agent.userId };
  next();
}
