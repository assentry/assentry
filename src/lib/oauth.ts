import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
export const OAUTH_SESSION_COOKIE = "assentry_oauth_session";

// A short-lived browser session for the /oauth/authorize login+consent
// pages specifically. Deliberately separate from the SPA's bearer-token
// session (lib/userAuth.ts) — this one lives in a cookie because it has to
// survive a plain HTML form POST and a redirect, not a fetch() call.
export function signOAuthSession(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "15m" });
}

export function verifyOAuthSession(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string; kind?: string };
    // Developer sessions (kind: "developer") are never end-user sessions.
    if (typeof payload.sub !== "string" || payload.kind !== undefined) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Shared by the OAuth consent pages and the account-linking pages — both
// are plain server-rendered flows gated on the same browser session cookie.
export function getBrowserSessionUserId(req: { cookies?: Record<string, string> }): string | null {
  const cookie = req.cookies?.[OAUTH_SESSION_COOKIE];
  if (!cookie) return null;
  return verifyOAuthSession(cookie);
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

// RFC 7636 PKCE verification — the public client (Claude, etc.) proves it's
// the same party that started the flow, without ever holding a client secret.
export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method !== "S256") return false;
  const computed = Buffer.from(base64url(crypto.createHash("sha256").update(codeVerifier).digest()));
  const expected = Buffer.from(codeChallenge);
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}
