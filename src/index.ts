import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { agentsRouter } from "./routes/agents";
import { auditRouter } from "./routes/audit";
import { authRouter } from "./routes/auth";
import { grantsRouter } from "./routes/grants";
import { mcpHttpRouter } from "./routes/mcpHttp";
import { oauthAuthorizeRouter } from "./routes/oauthAuthorize";
import { oauthClientsRouter } from "./routes/oauthClients";
import { oauthMetaRouter } from "./routes/oauthMeta";
import { oauthTokenRouter } from "./routes/oauthToken";
import { profileRouter } from "./routes/profile";
import { verifyRouter } from "./routes/verify";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true }));

// User-facing (personal app), session-authenticated.
app.use("/auth", authRouter);
app.use("/agents", agentsRouter);
app.use("/grants", grantsRouter);
app.use("/audit", auditRouter);

// Partner-facing (business SDK), API-key authenticated.
app.use("/verify", verifyRouter);
app.use("/profile", profileRouter);

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

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`HAPI core listening on http://localhost:${port}`);
});
