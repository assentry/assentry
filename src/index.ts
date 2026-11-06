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
import { meRouter } from "./routes/me";
import { verifyRouter } from "./routes/verify";

const app = express();
// So req.protocol reports "https" correctly when running behind a tunnel
// (ngrok, a real reverse proxy) that terminates TLS and forwards plain HTTP —
// otherwise the OAuth discovery metadata would advertise http:// endpoints.
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());
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

// Developer console: developer accounts and the partner apps/API keys they
// own. Separate session type from the personal app's.
app.use("/developer", developerRouter);

// OAuth: lets an MCP client (Claude, etc.) connect without a human ever
// handling a key — discovery metadata, dynamic client registration, the
// login/consent screens, and token exchange.
app.use(oauthMetaRouter);
app.use("/oauth", oauthClientsRouter);
app.use("/oauth", oauthAuthorizeRouter);
app.use("/oauth", oauthTokenRouter);

// The hosted remote MCP server itself, reached with the bearer token from
// the OAuth exchange above.
app.use("/mcp", mcpHttpRouter);

// Account linking (case 2 — see STRATEGY.md): a partner's already-logged-in
// human confirms their Assentry identity matches an existing account there.
app.use("/link", linkRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Assentry core listening on http://localhost:${port}`);
});
