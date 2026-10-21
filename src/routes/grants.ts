import { Router } from "express";
import { z } from "zod";
import { issueCredential } from "../lib/credential";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireUser } from "../lib/userAuth";

export const grantsRouter = Router();
grantsRouter.use(requireUser);

const createGrantSchema = z.object({
  agentId: z.string().uuid(),
  scope: z.string().min(1), // e.g. "job_application:submit"
  consentedFields: z.array(z.string()).default([]),
  expiresInMinutes: z.number().int().positive().max(60 * 24 * 30), // cap at 30 days
});

// Issuing a grant is the consent act itself — the user authorising a
// specific agent to do a specific thing, for a bounded time. The returned
// `credential` is what the agent carries; it is never re-derivable later,
// so the caller (consent UI) must hand it to the agent immediately.
grantsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createGrantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { agentId, scope, consentedFields, expiresInMinutes } = parsed.data;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId: req.userId!, revokedAt: null },
  });
  if (!agent) {
    return res.status(404).json({ error: "agent not found or revoked" });
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
  const grant = await prisma.grant.create({
    data: {
      userId: req.userId!,
      agentId,
      scope,
      consentedFields,
      expiresAt,
    },
  });

  const credential = issueCredential(
    { grantId: grant.id, userId: grant.userId, agentId: grant.agentId, scope },
    expiresAt
  );

  await prisma.auditLog.create({
    data: {
      userId: req.userId!,
      agentId,
      grantId: grant.id,
      action: "grant_created",
      result: "allowed",
      reason: "ok",
      metadata: { scope, expiresAt },
    },
  });

  res.status(201).json({ grant, credential });
});

grantsRouter.get("/", async (req: AuthedRequest, res) => {
  const grants = await prisma.grant.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json({ grants });
});

grantsRouter.post("/:id/revoke", async (req: AuthedRequest, res) => {
  const grant = await prisma.grant.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!grant) return res.status(404).json({ error: "grant not found" });

  await prisma.grant.update({
    where: { id: grant.id },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId!,
      agentId: grant.agentId,
      grantId: grant.id,
      action: "grant_revoked",
      result: "allowed",
      reason: "user_requested",
      metadata: {},
    },
  });

  res.json({ ok: true });
});
