import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireUser } from "../lib/userAuth";

export const agentsRouter = Router();
agentsRouter.use(requireUser);

const connectSchema = z.object({
  platform: z.enum(["claude", "chatgpt", "grok", "other"]),
  label: z.string().optional(),
});

// "Connecting an agent" = registering the connector the user installed
// (e.g. the HAPI MCP server added to Claude) against their account. It does
// not grant the agent anything by itself — grants are separate, per §9 of
// STRATEGY.md's agent integration model.
agentsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const agent = await prisma.agent.create({
    data: { userId: req.userId!, ...parsed.data },
  });
  res.status(201).json({ agent });
});

agentsRouter.get("/", async (req: AuthedRequest, res) => {
  const agents = await prisma.agent.findMany({
    where: { userId: req.userId! },
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
    // Revoking the agent connection must also kill every grant it holds —
    // otherwise a disconnected agent could still present a live credential.
    prisma.grant.updateMany({
      where: { agentId: agent.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
});
