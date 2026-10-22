import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

// Dynamic Client Registration (RFC 7591, minimal subset): lets an MCP client
// like Claude register itself with HAPI the first time a person adds this
// connector, instead of a developer having to hand-create a client_id in
// advance. Public clients only — no secret, PKCE is mandatory at /oauth/authorize.
export const oauthClientsRouter = Router();

const registerSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1),
  client_name: z.string().optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
});

oauthClientsRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_client_metadata", details: parsed.error.flatten() });
  }

  const clientId = crypto.randomUUID();
  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientName: parsed.data.client_name,
      redirectUris: parsed.data.redirect_uris,
    },
  });

  res.status(201).json({
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none",
  });
});
