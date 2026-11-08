import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sessionKeys } from "./keys";
import { prisma } from "./prisma";

// Developer sessions carry an explicit kind so they can never be used as an
// end-user session (requireUser rejects any token with a kind) and an
// end-user session can never be used here (no kind → rejected).
interface DeveloperSession {
  sub: string; // developerId
  kind: "developer";
  v?: number; // see lib/userAuth.ts
}

export function signDeveloperSession(developerId: string, sessionVersion: number): string {
  return jwt.sign({ sub: developerId, kind: "developer", v: sessionVersion } satisfies DeveloperSession, sessionKeys.developer, {
    expiresIn: "7d",
  });
}

export interface DeveloperRequest extends Request {
  developerId?: string;
}

export async function requireDeveloper(req: DeveloperRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  let payload: Partial<DeveloperSession>;
  try {
    payload = jwt.verify(header.slice("Bearer ".length), sessionKeys.developer, { algorithms: ["HS256"] }) as Partial<DeveloperSession>;
  } catch {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  if (payload.kind !== "developer" || typeof payload.sub !== "string") {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  const developer = await prisma.developer.findUnique({ where: { id: payload.sub }, select: { sessionVersion: true } });
  if (!developer || developer.sessionVersion !== (payload.v ?? 0)) {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  req.developerId = payload.sub;
  next();
}
