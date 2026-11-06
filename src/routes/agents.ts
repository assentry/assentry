import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireUser } from "../lib/userAuth";

export const agentsRouter = Router();
agentsRouter.use(requireUser);

const agentListFields = {
  id: true,
  userId: true,
  platform: true,
  label: true,
  createdAt: true,
  revokedAt: true,
} as const;

// Agents are created exclusively through the OAuth consent flow
// (routes/oauthAuthorize.ts), that approval *is* "connecting an agent".
// This router only lists and revokes what already exists; there is no
// manual "create an agent" path, so no secret is ever generated or shown
// here for a human to copy.
agentsRouter.get("/", async (req: AuthedRequest, res) => {
  const agents = await prisma.agent.findMany({
    where: { userId: req.userId! },
    select: agentListFields,
    orderBy: { createdAt: "desc" },
  });
  res.json({ agents });
});

agentsRouter.post("/:id/revoke", async (req: AuthedRequest, res) => {
  const agent = await prisma.agent.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!agent) return res.status(404).json({ error: "agent not found" });

  await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: { revokedAt: new Date() },
    }),
    // Revoking the agent connection must also kill every grant it holds -
    // otherwise a disconnected agent could still present a live credential.
    prisma.grant.updateMany({
      where: { agentId: agent.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
});
