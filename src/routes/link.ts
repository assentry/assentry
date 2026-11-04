import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { escapeHtml, page } from "../lib/htmlPage";
import { generateAuthorizationCode, getBrowserSessionUserId, OAUTH_SESSION_COOKIE, signOAuthSession } from "../lib/oauth";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { prisma } from "../lib/prisma";

// Case 2 from STRATEGY.md's "what 'the agent logs in' actually means": a
// one-time, human-driven confirmation that an Assentry user is the same person
// as an existing account on a participating site. Unlike the agent
// connector's public-client PKCE flow, the partner is a confidential
// client — it already holds an API key for server-to-server use, so the
// code exchange is authenticated with that instead of PKCE.
export const linkRouter = Router();

async function resolvePartnerForLink(publicId: string, redirectUri: string) {
  const partner = await prisma.partner.findUnique({ where: { publicId } });
  if (!partner || partner.revokedAt || !partner.linkRedirectUris.includes(redirectUri)) return null;
  return partner;
}

function hiddenLinkFields(params: { partner_id: string; redirect_uri: string; state: string }): string {
  return `
    <input type="hidden" name="partner_id" value="${escapeHtml(params.partner_id)}">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}">
    <input type="hidden" name="state" value="${escapeHtml(params.state)}">
  `;
}

const authorizeQuerySchema = z.object({
  partner_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional().default(""),
});

// Entry point a participating site sends an *already-logged-in* human to,
// to confirm their Assentry identity matches their existing account there.
linkRouter.get("/authorize", async (req, res) => {
  const parsed = authorizeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>This link request is missing required parameters.</p>"));
  }
  const { partner_id, redirect_uri, state } = parsed.data;

  const partner = await resolvePartnerForLink(partner_id, redirect_uri);
  if (!partner) {
    return res.status(400).send(page("Unknown app", "<p>This app isn't registered with Assentry, or its redirect address doesn't match.</p>"));
  }

  const hidden = hiddenLinkFields({ partner_id, redirect_uri, state });

  const sessionUserId = getBrowserSessionUserId(req);
  if (!sessionUserId) {
    return res.send(
      page(
        "Log in to Assentry",
        `<p class="hint">${escapeHtml(partner.name)} wants to confirm this is you.</p>
        <form method="post" action="/link/login">
          ${hidden}
          <label>Email</label><input name="email" type="email" required>
          <label>Password</label><input name="password" type="password" required>
          <button class="approve" type="submit">Log in</button>
        </form>`
      )
    );
  }

  res.send(
    page(
      "Confirm your identity",
      `<p class="hint"><strong>${escapeHtml(partner.name)}</strong> wants to confirm that your account there belongs to you. This doesn't grant any new permission — it just links your existing account to your Assentry identity.</p>
      <form method="post" action="/link/authorize">
        ${hidden}
        <button class="approve" type="submit" name="decision" value="approve">Confirm</button>
        <button class="deny" type="submit" name="decision" value="deny">Cancel</button>
      </form>`
    )
  );
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  partner_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional().default(""),
});

linkRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>Something was missing from that submission.</p>"));
  }
  const { email, password, ...linkParams } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res
      .status(401)
      .send(
        page(
          "Log in to Assentry",
          `<p class="error">Incorrect email or password.</p>
          <form method="post" action="/link/login">
            ${hiddenLinkFields(linkParams)}
            <label>Email</label><input name="email" type="email" required>
            <label>Password</label><input name="password" type="password" required>
            <button class="approve" type="submit">Log in</button>
          </form>`
        )
      );
  }

  res.cookie(OAUTH_SESSION_COOKIE, signOAuthSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
  });

  const qs = new URLSearchParams(linkParams).toString();
  res.redirect(`/link/authorize?${qs}`);
});

const confirmBodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
  partner_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional().default(""),
});

linkRouter.post("/authorize", async (req, res) => {
  const parsed = confirmBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>Something was missing from that submission.</p>"));
  }
  const { decision, partner_id, redirect_uri, state } = parsed.data;

  const partner = await resolvePartnerForLink(partner_id, redirect_uri);
  if (!partner) {
    return res.status(400).send(page("Unknown app", "<p>This app isn't registered with Assentry, or its redirect address doesn't match.</p>"));
  }

  if (decision === "deny") {
    const qs = new URLSearchParams({ error: "access_denied", state }).toString();
    return res.redirect(`${redirect_uri}?${qs}`);
  }

  const userId = getBrowserSessionUserId(req);
  if (!userId) {
    return res.status(401).send(page("Session expired", "<p>Your session expired — go back and log in again.</p>"));
  }

  const code = generateAuthorizationCode();
  await prisma.accountLinkCode.create({
    data: {
      code,
      partnerId: partner.id,
      userId,
      redirectUri: redirect_uri,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  const qs = new URLSearchParams({ code, state }).toString();
  res.redirect(`${redirect_uri}?${qs}`);
});

const tokenSchema = z.object({ code: z.string() });

// The partner's backend calls this directly (server-to-server, with its own
// API key) to resolve the code into the Assentry userId it should store against
// its own account record.
linkRouter.post("/token", requirePartner, async (req: PartnerRequest, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }

  const link = await prisma.accountLinkCode.findUnique({ where: { code: parsed.data.code } });
  if (
    !link ||
    link.usedAt ||
    link.expiresAt.getTime() < Date.now() ||
    link.partnerId !== req.partner!.id
  ) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  await prisma.accountLinkCode.update({ where: { id: link.id }, data: { usedAt: new Date() } });

  res.json({ userId: link.userId });
});
