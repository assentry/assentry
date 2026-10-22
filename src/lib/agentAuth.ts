import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";
import { hashSecret } from "./secrets";

export interface AgentApiRequest extends Request {
  agent?: { id: string; userId: string };
}

function extractAgentKey(req: Request): string | null {
  const bearer = req.headers.authorization;
  if (bearer?.startsWith("Bearer ")) return bearer.slice("Bearer ".length);

  // The local stdio connector (connector/) predates OAuth support and still
  // uses this custom header; kept for backward compatibility.
  const legacy = req.headers["x-hapi-agent-key"];
  if (typeof legacy === "string") return legacy;

  return null;
}

// Authenticates the connector running inside a user's AI — distinct from
// requireUser (the human's session) and requirePartner (a business's API
// key). This is the identity Claude/GPT/Grok itself presents, whether that
// key was copied in manually (legacy header) or issued via OAuth (bearer).
export async function requireAgentKey(
  req: AgentApiRequest,
  res: Response,
  next: NextFunction
) {
  const key = extractAgentKey(req);
  if (!key) {
    return res.status(401).json({ error: "missing agent credentials" });
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
