import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { verifyPkce } from "../lib/oauth";
import { generateSecret, hashSecret } from "../lib/secrets";

export const oauthTokenRouter = Router();

const tokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string(),
  redirect_uri: z.string().url(),
  client_id: z.string(),
  code_verifier: z.string(),
});

// Exchanges the one-time code from the consent screen for a bearer token -
// this is the only place a secret is ever generated in this flow, and it
// goes straight from server to client, never through the person's screen.
oauthTokenRouter.post("/token", async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const { code, redirect_uri, client_id, code_verifier } = parsed.data;

  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { code },
    include: { client: true },
  });

  if (
    !authCode ||
    authCode.usedAt ||
    authCode.expiresAt.getTime() < Date.now() ||
    authCode.client.clientId !== client_id ||
    authCode.redirectUri !== redirect_uri
  ) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  if (!verifyPkce(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
  }

  const accessToken = generateSecret("agent");

  await prisma.$transaction(async (tx) => {
    await tx.oAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });
    await tx.agent.update({
      where: { id: authCode.agentId },
      data: { secretHash: hashSecret(accessToken) },
    });

    // The person chose to replace an earlier connection: done only now that
    // the new one is definitely working, so a failed connect never leaves
    // them with nothing. Its live permissions move over (sites it's signed
    // in to keep working), then the old connection is disconnected.
    if (authCode.replacesAgentId) {
      const old = await tx.agent.findFirst({
        where: { id: authCode.replacesAgentId, userId: authCode.userId, revokedAt: null },
      });
      if (old) {
        const moved = await tx.grant.updateMany({
          where: { agentId: old.id, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { agentId: authCode.agentId },
        });
        await tx.agent.update({ where: { id: old.id }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({
          data: {
            userId: authCode.userId,
            agentId: authCode.agentId,
            action: "agent_replaced",
            result: "allowed",
            reason: "user_requested",
            metadata: { replacedAgentId: old.id, movedGrants: moved.count },
          },
        });
      }
    }
  });

  res.json({ access_token: accessToken, token_type: "Bearer" });
});
