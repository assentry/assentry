import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { verifyPkce } from "../lib/oauth";
import { generateSecret, hashSecret } from "../lib/secrets";
import { hashCode } from "../lib/security";

export const oauthTokenRouter = Router();

const tokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string(),
  redirect_uri: z.string().url(),
  client_id: z.string(),
  code_verifier: z.string(),
});

const refreshSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string(),
  client_id: z.string(),
});

// Access tokens last an hour; the AI client renews them with a refresh
// token, which works once and is replaced every time. A connection nobody
// uses for 90 days ends and has to be made again.
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function newTokens() {
  const accessToken = generateSecret("agent");
  const refreshToken = generateSecret("agent_refresh");
  return {
    accessToken,
    refreshToken,
    data: {
      secretHash: hashSecret(accessToken),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000),
      refreshHash: hashSecret(refreshToken),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  };
}

function tokenResponse(t: { accessToken: string; refreshToken: string }) {
  return { access_token: t.accessToken, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: t.refreshToken };
}

// Exchanges the one-time code from the consent screen for a bearer token -
// this is the only place a secret is ever generated in this flow, and it
// goes straight from server to client, never through the person's screen.
oauthTokenRouter.post("/token", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.body?.grant_type === "refresh_token") return refresh(req.body, res);
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const { code, redirect_uri, client_id, code_verifier } = parsed.data;

  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { code: hashCode(code) },
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

  const tokens = newTokens();

  // Claimed conditionally, so two exchanges of the same code can't both succeed.
  const claimed = await prisma.oAuthAuthorizationCode.updateMany({
    where: { id: authCode.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return res.status(400).json({ error: "invalid_grant" });

  await prisma.$transaction(async (tx) => {
    await tx.agent.update({
      where: { id: authCode.agentId },
      data: { ...tokens.data, oauthClientId: authCode.client.clientId },
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

  res.json(tokenResponse(tokens));
});

async function refresh(body: unknown, res: import("express").Response) {
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const oldHash = hashSecret(parsed.data.refresh_token);
  const agent = await prisma.agent.findUnique({ where: { refreshHash: oldHash } });
  if (
    !agent ||
    agent.revokedAt ||
    !agent.refreshExpiresAt ||
    agent.refreshExpiresAt.getTime() < Date.now() ||
    agent.oauthClientId !== parsed.data.client_id
  ) {
    return res.status(400).json({ error: "invalid_grant" });
  }
  const tokens = newTokens();
  // Conditional, so the same refresh token can't be used twice, even at once.
  const swapped = await prisma.agent.updateMany({
    where: { id: agent.id, refreshHash: oldHash, revokedAt: null },
    data: tokens.data,
  });
  if (swapped.count === 0) return res.status(400).json({ error: "invalid_grant" });
  res.json(tokenResponse(tokens));
}
