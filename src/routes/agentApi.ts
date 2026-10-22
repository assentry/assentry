import { Router } from "express";
import { AgentApiRequest, requireAgentKey } from "../lib/agentAuth";
import { issueCredential } from "../lib/credential";
import { prisma } from "../lib/prisma";

// Endpoints the connector (running inside the user's own AI) calls on its
// own behalf, authenticated by its agent key — not the user's login session,
// and not a partner's API key. This is Option A from the design discussion:
// the connector can only use permissions the user already granted through
// the personal app; it cannot create new ones.
export const agentApiRouter = Router();
agentApiRouter.use(requireAgentKey);

// What am I currently allowed to do for this person?
agentApiRouter.get("/grants", async (req: AgentApiRequest, res) => {
  const grants = await prisma.grant.findMany({
    where: {
      agentId: req.agent!.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      scope: true,
      consentedFields: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ grants });
});

// Give me today's proof for this specific permission, right now. Re-issued
// fresh each time rather than cached — if the grant was revoked since the
// last call, this simply fails instead of handing out a stale credential.
agentApiRouter.post("/grants/:id/credential", async (req: AgentApiRequest, res) => {
  const grant = await prisma.grant.findFirst({
    where: { id: req.params.id, agentId: req.agent!.id },
  });
  if (!grant) return res.status(404).json({ error: "grant not found" });
  if (grant.revokedAt) return res.status(403).json({ error: "grant revoked" });
  if (grant.expiresAt.getTime() < Date.now()) {
    return res.status(403).json({ error: "grant expired" });
  }

  const credential = issueCredential(
    { grantId: grant.id, userId: grant.userId, agentId: grant.agentId, scope: grant.scope },
    grant.expiresAt
  );

  await prisma.auditLog.create({
    data: {
      userId: grant.userId,
      agentId: grant.agentId,
      grantId: grant.id,
      action: "credential_issued",
      result: "allowed",
      reason: "ok",
      metadata: {},
    },
  });

  res.json({ credential, scope: grant.scope, expiresAt: grant.expiresAt });
});
