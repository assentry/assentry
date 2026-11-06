import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sessionKeys } from "./keys";


// Developer sessions carry an explicit kind so they can never be used as an
// end-user session (requireUser rejects any token with a kind) and an
// end-user session can never be used here (no kind → rejected).
interface DeveloperSession {
  sub: string; // developerId
  kind: "developer";
}

export function signDeveloperSession(developerId: string): string {
  return jwt.sign({ sub: developerId, kind: "developer" } satisfies DeveloperSession, sessionKeys.developer, {
    expiresIn: "7d",
  });
}

export interface DeveloperRequest extends Request {
  developerId?: string;
}

export function requireDeveloper(req: DeveloperRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  try {
    const payload = jwt.verify(header.slice("Bearer ".length), sessionKeys.developer, { algorithms: ["HS256"] }) as Partial<DeveloperSession>;
    if (payload.kind !== "developer" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "invalid or expired session" });
    }
    req.developerId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired session" });
  }
}
