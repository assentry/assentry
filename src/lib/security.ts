import crypto from "crypto";
import type { CookieOptions, Request, Response } from "express";
import { prisma } from "./prisma";

/**
 * The caller's IP address. Behind Vercel, x-vercel-forwarded-for and
 * x-real-ip are set by the platform and can't be supplied by the client,
 * unlike the left end of X-Forwarded-For.
 */
export function clientIp(req: Request): string {
  const header = req.headers["x-vercel-forwarded-for"] ?? req.headers["x-real-ip"];
  const value = Array.isArray(header) ? header[0] : header;
  return (value?.split(",")[0].trim() || req.socket.remoteAddress || "unknown").slice(0, 64);
}

// ---- Login throttling ----

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 10;
const MAX_FAILURES_PER_IP = 50;

function loginKeys(email: string, ip: string) {
  return { emailKey: `email:${email.trim().toLowerCase()}`, ipKey: `ip:${ip}` };
}

/** False once an email or an IP has had too many failed logins in the last 15 minutes. */
export async function loginAllowed(email: string, ip: string): Promise<boolean> {
  const { emailKey, ipKey } = loginKeys(email, ip);
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: emailKey, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { key: ipKey, createdAt: { gt: since } } }),
  ]);
  return byEmail < MAX_FAILURES_PER_EMAIL && byIp < MAX_FAILURES_PER_IP;
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  const { emailKey, ipKey } = loginKeys(email, ip);
  await prisma.loginAttempt.createMany({ data: [{ key: emailKey }, { key: ipKey }] });
  // Keep the table small: drop anything outside the window now and then.
  if (Math.random() < 0.05) {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS) } } });
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: loginKeys(email, "").emailKey } });
}

export const TOO_MANY_ATTEMPTS = "too many failed attempts; wait 15 minutes and try again";

// ---- Cookies and forms on Assentry's own server-rendered pages ----

export function cookieOptions(req: Request, maxAgeMs: number): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/", maxAge: maxAgeMs };
}

const CSRF_COOKIE = "assentry_csrf";

/**
 * Double-submit token for the login and consent forms: the page puts the
 * same random value in a cookie and a hidden field. Another site can make a
 * browser submit the form, but can't read the cookie to fill in the field.
 */
export function csrfField(req: Request, res: Response): string {
  let token = req.cookies?.[CSRF_COOKIE];
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    token = crypto.randomBytes(32).toString("base64url");
    res.cookie(CSRF_COOKIE, token, cookieOptions(req, 60 * 60 * 1000));
  }
  return `<input type="hidden" name="csrf" value="${token}">`;
}

export function csrfValid(req: Request): boolean {
  const cookie = req.cookies?.[CSRF_COOKIE];
  const field = req.body?.csrf;
  if (typeof cookie !== "string" || typeof field !== "string" || cookie.length !== field.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(field));
}

/** SHA-256 fingerprint for one-time codes, so the database never holds live ones. */
export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
