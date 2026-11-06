import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sessionKeys } from "./keys";


export interface UserSession {
  sub: string; // userId
  // Absent on end-user sessions (including every token issued before
  // developer accounts existed). Developer sessions set this to
  // "developer" and are rejected here — see lib/developerAuth.ts.
  kind?: string;
}

export function signUserSession(userId: string): string {
  return jwt.sign({ sub: userId } satisfies UserSession, sessionKeys.user, {
    expiresIn: "7d",
  });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

// Session auth for the personal app (consent UI). Deliberately separate
// from the partner/credential verification path below — these are two
// different trust boundaries and must not share a code path.
export function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  try {
    const payload = jwt.verify(
      header.slice("Bearer ".length),
      sessionKeys.user,
      { algorithms: ["HS256"] }
    ) as UserSession;
    if (typeof payload.sub !== "string" || payload.kind !== undefined) {
      return res.status(401).json({ error: "invalid or expired session" });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired session" });
  }
}
