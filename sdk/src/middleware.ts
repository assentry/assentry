import type { NextFunction, Request, Response } from "express";
import type { HAPI } from "./client";

export interface HAPIGrant {
  userId: string;
  agentId: string;
  scope: string;
  expiresAt: string;
}

export interface HAPIRequest extends Request {
  hapiGrant?: HAPIGrant;
  /** The raw credential the agent presented — reuse it for a /profile pull. */
  hapiCredential?: string;
}

export interface RequireGrantOptions {
  /** Header the agent's credential arrives in. Defaults to "x-hapi-grant". */
  credentialHeader?: string;
}

/**
 * Express middleware gating a route on a valid HAPI grant for `action`.
 * On success, attaches `req.hapiGrant` and calls next(); on failure, the
 * agent is treated exactly like any other unauthenticated request — your
 * normal fallback flow (login, CAPTCHA, manual signup) still applies.
 */
export function requireGrant(hapi: HAPI, action: string, options: RequireGrantOptions = {}) {
  const header = (options.credentialHeader ?? "x-hapi-grant").toLowerCase();

  return async (req: HAPIRequest, res: Response, next: NextFunction) => {
    const credential = req.headers[header];
    if (typeof credential !== "string") {
      return res.status(401).json({ error: "missing HAPI credential" });
    }

    const result = await hapi.verify(credential, action);
    if (!result.valid) {
      return res.status(403).json({ error: "not authorised", reason: result.reason });
    }

    req.hapiGrant = {
      userId: result.userId,
      agentId: result.agentId,
      scope: result.scope,
      expiresAt: result.expiresAt,
    };
    req.hapiCredential = credential;
    next();
  };
}
