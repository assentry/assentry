import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { agentsRouter } from "./routes/agents";
import { auditRouter } from "./routes/audit";
import { authRouter } from "./routes/auth";
import { developerRouter } from "./routes/developer";
import { grantsRouter } from "./routes/grants";
import { linkRouter } from "./routes/link";
import { mcpHttpRouter } from "./routes/mcpHttp";
import { oauthAuthorizeRouter } from "./routes/oauthAuthorize";
import { oauthClientsRouter } from "./routes/oauthClients";
import { oauthMetaRouter } from "./routes/oauthMeta";
import { oauthTokenRouter } from "./routes/oauthToken";
import { profileRouter } from "./routes/profile";
import { signInRouter } from "./routes/signIn";
import { domainVerificationRouter } from "./routes/domainVerification";
import { getJwks } from "./lib/keys";
import { fieldsCatalogueRouter, filesRouter } from "./routes/files";
import { meRouter } from "./routes/me";
import { verifyRouter } from "./routes/verify";

export const app = express();
// So req.protocol reports "https" correctly when running behind a tunnel
// (ngrok, a real reverse proxy) that terminates TLS and forwards plain HTTP -
// otherwise the OAuth discovery metadata would advertise http:// endpoints.
app.set("trust proxy", true);
app.disable("x-powered-by");
// Baseline headers for every response. The API returns JSON, and the few
// server-rendered pages (login, consent, account linking) must never be
// framed by another site.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  if (!res.getHeader("Content-Security-Policy")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'");
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// The personal app + marketing site used to be built into public/ and
// served from here; they're now their own Next.js deployment (assentry-frontend)
// that talks to this API over HTTP, so there's no longer anything to serve.

app.get("/health", (_req, res) => res.json({ ok: true }));

// User-facing (personal app), session-authenticated.
app.use("/auth", authRouter);
app.use("/agents", agentsRouter);
app.use("/grants", grantsRouter);
app.use("/audit", auditRouter);
app.use("/me", meRouter);

// Partner-facing (business SDK), API-key authenticated.
app.use("/verify", verifyRouter);
app.use("/profile", profileRouter);
app.use("/sign-in-requests", signInRouter);
app.use("/domain-verification", domainVerificationRouter);
app.use("/files", filesRouter);
app.use("/fields", fieldsCatalogueRouter);

// Public keys that sign agent credentials, so anyone can check a credential
// came from Assentry. Sites still ask /verify, which also checks revocation.
app.get("/.well-known/jwks.json", async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(await getJwks());
  } catch (err) {
    next(err);
  }
});

// Developer console: developer accounts and the partner apps/API keys they
// own. Separate session type from the personal app's.
app.use("/developer", developerRouter);

// OAuth: lets an MCP client (Claude, etc.) connect without a human ever
// handling a key, discovery metadata, dynamic client registration, the
// login/consent screens, and token exchange.
app.use(oauthMetaRouter);
app.use("/oauth", oauthClientsRouter);
app.use("/oauth", oauthAuthorizeRouter);
app.use("/oauth", oauthTokenRouter);

// The hosted remote MCP server itself, reached with the bearer token from
// the OAuth exchange above.
app.use("/mcp", mcpHttpRouter);

// Account linking (case 2. See STRATEGY.md): a partner's already-logged-in
// human confirms their Assentry identity matches an existing account there.
app.use("/link", linkRouter);

// Anything unhandled: log it, and tell the caller nothing about the internals.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const status = (err as { status?: number; type?: string }).status;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? "request too large" : "bad request" });
  }
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

export default app;
