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

// Exchanges the one-time code from the consent screen for a bearer token —
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

  await prisma.$transaction([
    prisma.oAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    }),
    prisma.agent.update({
      where: { id: authCode.agentId },
      data: { secretHash: hashSecret(accessToken) },
    }),
  ]);

  res.json({ access_token: accessToken, token_type: "Bearer" });
});
