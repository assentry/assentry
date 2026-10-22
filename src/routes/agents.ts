import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateSecret, hashSecret } from "../lib/secrets";
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

const connectSchema = z.object({
  platform: z.enum(["claude", "chatgpt", "grok", "other"]),
  label: z.string().optional(),
});

// "Connecting an agent" = registering the connector the user installed
// (e.g. the HAPI MCP server added to Claude) against their account. It does
// not grant the agent anything by itself — grants are separate, per §9 of
// STRATEGY.md's agent integration model.
//
// The returned `secret` is what the user pastes into their connector's
// config (e.g. as HAPI_AGENT_KEY) — it's how the connector proves which
// agent connection it is when it later talks to HAPI on its own. Shown once,
// same as a grant credential.
agentsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const secret = generateSecret("agent");
  const agent = await prisma.agent.create({
    data: { userId: req.userId!, ...parsed.data, secretHash: hashSecret(secret) },
    select: agentListFields,
  });
  res.status(201).json({ agent, secret });
});

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
    // Revoking the agent connection must also kill every grant it holds —
    // otherwise a disconnected agent could still present a live credential.
    prisma.grant.updateMany({
      where: { agentId: agent.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
});
