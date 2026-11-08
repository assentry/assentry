import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sessionKeys } from "./keys";
import { prisma } from "./prisma";

export interface UserSession {
  sub: string; // userId
  // The person's session version when this token was issued. Tokens from
  // before versions existed have none and count as version 0.
  v?: number;
  // Absent on end-user sessions (including every token issued before
  // developer accounts existed). Developer sessions set this to
  // "developer" and are rejected here. See lib/developerAuth.ts.
  kind?: string;
}

export function signUserSession(userId: string, sessionVersion: number): string {
  return jwt.sign({ sub: userId, v: sessionVersion } satisfies UserSession, sessionKeys.user, {
    expiresIn: "7d",
  });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

// Session auth for the personal app (consent UI). Deliberately separate
// from the partner/credential verification path below, these are two
// different trust boundaries and must not share a code path.
export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  let payload: UserSession;
  try {
    payload = jwt.verify(header.slice("Bearer ".length), sessionKeys.user, { algorithms: ["HS256"] }) as UserSession;
  } catch {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  if (typeof payload.sub !== "string" || payload.kind !== undefined) {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  // Checked on every request, so "log out everywhere" takes effect at once.
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { sessionVersion: true } });
  if (!user || user.sessionVersion !== (payload.v ?? 0)) {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  req.userId = payload.sub;
  next();
}
