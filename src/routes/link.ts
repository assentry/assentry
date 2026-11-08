import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { escapeHtml, page } from "../lib/htmlPage";
import { generateAuthorizationCode, getBrowserSessionUserId, OAUTH_SESSION_COOKIE, signOAuthSession } from "../lib/oauth";
import { pairwiseUserId } from "../lib/pairwise";
import { PartnerRequest, requirePartner } from "../lib/partnerAuth";
import { prisma } from "../lib/prisma";
import { clearLoginFailures, clientIp, cookieOptions, csrfField, csrfValid, hashCode, loginAllowed, recordLoginFailure } from "../lib/security";

// Case 2 from STRATEGY.md's "what 'the agent logs in' actually means": a
// one-time, human-driven confirmation that an Assentry user is the same person
// as an existing account on a participating site. Unlike the agent
// connector's public-client PKCE flow, the partner is a confidential
// client, it already holds an API key for server-to-server use, so the
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
          ${csrfField(req, res)}
          <label>Email</label><input name="email" type="email" required>
          <label>Password</label><input name="password" type="password" required>
          <button class="approve" type="submit">Log in</button>
        </form>`
      )
    );
  }

  const sessionUser = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { email: true } });
  res.send(
    page(
      "Confirm your identity",
      `<p class="hint"><strong>${escapeHtml(partner.name)}</strong> wants to confirm that your account there belongs to you. This doesn't grant any new permission. It just links your existing account to your Assentry identity.</p>
      <p class="hint">Signed in to Assentry as <strong>${escapeHtml(sessionUser?.email ?? "")}</strong>. Only confirm if that's you.</p>
      <form method="post" action="/link/authorize">
        ${hidden}
        ${csrfField(req, res)}
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
  csrf: z.string().optional(),
});

linkRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>Something was missing from that submission.</p>"));
  }
  const { email, password, csrf: _csrf, ...linkParams } = parsed.data;
  if (!csrfValid(req)) {
    return res.status(403).send(page("Expired form", "<p>This form expired. Go back to the site and start again.</p>"));
  }
  const ip = clientIp(req);
  const allowed = await loginAllowed(email, ip);

  const user = allowed ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    if (allowed) await recordLoginFailure(email, ip);
    return res
      .status(allowed ? 401 : 429)
      .send(
        page(
          "Log in to Assentry",
          `<p class="error">${allowed ? "Incorrect email or password." : "Too many failed attempts. Wait 15 minutes and try again."}</p>
          <form method="post" action="/link/login">
            ${hiddenLinkFields(linkParams)}
            ${csrfField(req, res)}
            <label>Email</label><input name="email" type="email" required>
            <label>Password</label><input name="password" type="password" required>
            <button class="approve" type="submit">Log in</button>
          </form>`
        )
      );
  }

  await clearLoginFailures(email);
  res.cookie(OAUTH_SESSION_COOKIE, signOAuthSession(user.id), cookieOptions(req, 15 * 60 * 1000));

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

  if (!csrfValid(req)) {
    return res.status(403).send(page("Expired form", "<p>This form expired. Go back to the site and start again.</p>"));
  }

  if (decision === "deny") {
    const qs = new URLSearchParams({ error: "access_denied", state }).toString();
    return res.redirect(`${redirect_uri}?${qs}`);
  }

  const userId = getBrowserSessionUserId(req);
  if (!userId) {
    return res.status(401).send(page("Session expired", "<p>Your session expired. Go back and log in again.</p>"));
  }

  const code = generateAuthorizationCode();
  await prisma.accountLinkCode.create({
    data: {
      code: hashCode(code),
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
// API key) to resolve the code into the per-site Assentry userId it should store against
// its own account record.
linkRouter.post("/token", requirePartner, async (req: PartnerRequest, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }

  const link = await prisma.accountLinkCode.findUnique({ where: { code: hashCode(parsed.data.code) } });
  if (
    !link ||
    link.usedAt ||
    link.expiresAt.getTime() < Date.now() ||
    link.partnerId !== req.partner!.id
  ) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  const claimed = await prisma.accountLinkCode.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) return res.status(400).json({ error: "invalid_grant" });

  // The same per-site ID /verify returns for this person, so the site can
  // match later agent visits to the account it links here.
  res.json({ userId: pairwiseUserId(link.userId, req.partner!) });
});
