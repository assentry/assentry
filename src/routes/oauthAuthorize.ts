import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { escapeHtml, page } from "../lib/htmlPage";
import {
  generateAuthorizationCode,
  getBrowserSessionUserId,
  OAUTH_SESSION_COOKIE,
  signOAuthSession,
} from "../lib/oauth";
import { prisma } from "../lib/prisma";

export const oauthAuthorizeRouter = Router();

const PLATFORM_LABELS: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  grok: "Grok",
  other: "Other",
};

const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional().default(""),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
});

async function resolveClient(clientId: string, redirectUri: string) {
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) return null;
  return client;
}

function hiddenOAuthFields(params: {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}): string {
  return `
    <input type="hidden" name="response_type" value="${escapeHtml(params.response_type)}">
    <input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}">
    <input type="hidden" name="state" value="${escapeHtml(params.state)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge)}">
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method)}">
  `;
}

// Entry point an MCP client sends a person's browser to. Validates the
// request, then shows a login form (no session cookie yet) or the consent
// screen (session cookie present) — this *is* the "Connect" experience: no
// key ever appears on screen for the end user to copy.
oauthAuthorizeRouter.get("/authorize", async (req, res) => {
  const parsed = authorizeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>This connection request is missing required parameters.</p>"));
  }
  const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method } = parsed.data;

  const client = await resolveClient(client_id, redirect_uri);
  if (!client) {
    return res.status(400).send(page("Unknown app", "<p>This app isn't registered with Assentry, or its redirect address doesn't match.</p>"));
  }

  const hidden = hiddenOAuthFields({
    response_type,
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
  });

  const sessionUserId = await getBrowserSessionUserId(req);
  if (!sessionUserId) {
    return res.send(
      page(
        "Log in to Assentry",
        `<p class="hint">${escapeHtml(client.clientName ?? "An AI assistant")} wants to connect to your Assentry account.</p>
        <form method="post" action="/oauth/login">
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
      "Connect an agent",
      `<p class="hint"><strong>${escapeHtml(client.clientName ?? "An AI assistant")}</strong> wants to connect to your Assentry account. It won't be able to do anything until you separately authorise it for specific actions in the personal app.</p>
      <form method="post" action="/oauth/authorize">
        ${hidden}
        <label>Which AI is this?</label>
        <select name="platform">
          ${Object.entries(PLATFORM_LABELS)
            .map(([value, label]) => `<option value="${value}">${label}</option>`)
            .join("")}
        </select>
        <label>Label (optional)</label>
        <input name="label" placeholder="e.g. My job-search assistant">
        <button class="approve" type="submit" name="decision" value="approve">Connect</button>
        <button class="deny" type="submit" name="decision" value="deny">Cancel</button>
      </form>`
    )
  );
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional().default(""),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
});

oauthAuthorizeRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>Something was missing from that submission.</p>"));
  }
  const { email, password, ...oauthParams } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res
      .status(401)
      .send(
        page(
          "Log in to Assentry",
          `<p class="error">Incorrect email or password.</p>
          <form method="post" action="/oauth/login">
            ${hiddenOAuthFields(oauthParams)}
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

  const qs = new URLSearchParams(oauthParams).toString();
  res.redirect(`/oauth/authorize?${qs}`);
});

const consentBodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional().default(""),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
  platform: z.enum(["claude", "chatgpt", "grok", "other"]).default("claude"),
  label: z.string().optional(),
});

// The actual consent decision. Re-validates client_id/redirect_uri against
// the database rather than trusting the hidden form fields alone — a
// tampered form can't redirect anywhere other than an address this specific
// client actually registered.
oauthAuthorizeRouter.post("/authorize", async (req, res) => {
  const parsed = consentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(page("Invalid request", "<p>Something was missing from that submission.</p>"));
  }
  const { decision, client_id, redirect_uri, state, code_challenge, code_challenge_method, platform, label } =
    parsed.data;

  const client = await resolveClient(client_id, redirect_uri);
  if (!client) {
    return res.status(400).send(page("Unknown app", "<p>This app isn't registered with Assentry, or its redirect address doesn't match.</p>"));
  }

  if (decision === "deny") {
    const qs = new URLSearchParams({ error: "access_denied", state }).toString();
    return res.redirect(`${redirect_uri}?${qs}`);
  }

  const userId = await getBrowserSessionUserId(req);
  if (!userId) {
    return res.status(401).send(page("Session expired", "<p>Your session expired — go back and log in again.</p>"));
  }

  const agent = await prisma.agent.create({
    data: { userId, platform, label: label || undefined },
  });

  const code = generateAuthorizationCode();
  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: client.id,
      userId,
      agentId: agent.id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  const qs = new URLSearchParams({ code, state }).toString();
  res.redirect(`${redirect_uri}?${qs}`);
});
