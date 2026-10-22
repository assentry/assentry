# HAPI core

Identity, grant, verification, audit, partner SDK and agent connector for HAPI — the first build slice per `STRATEGY.md` §9 and the locked agent-integration model. No task-specific email/OTP yet: everything else in the committed v1 workflow (§9) now has a working, end-to-end-tested path.

## Architecture

- **Identity** — `User` signup/login (`/auth`).
- **Agent** — a connected AI orchestrator instance the user owns (`/agents`). Connecting an agent issues it a connector key but grants it nothing by itself.
- **Grant** — the consent act: a user authorises a specific agent to do a specific scoped action until a specific time (`/grants`). Issuing a grant returns a signed **credential** — what an agent carries and presents.
- **Verify** — the partner-facing handshake (`/verify`, API-key authenticated). Always re-checks the database (revocation, expiry, agent status), never trusts the signed token alone.
- **Profile** — scoped data disclosure (`/profile`), separate from authorisation. Returns only the intersection of what's requested and what the grant's `consentedFields` actually cover. Pull, not push — nothing is embedded in the credential itself.
- **Audit** — every verify/profile/grant/credential event is logged and viewable by the user (`/audit`).
- **Agent API** (`/agent/*`, connector-key authenticated) — lets the connector running inside the user's own AI list what it's currently authorised to do and fetch a fresh credential right before acting. Deliberately read-only: a connector can only *use* permissions the person already granted through the personal app, never request new ones (Option A from the design discussion — see `connector/README.md`).
- **OAuth** (`/oauth/*`, `/.well-known/*`) — lets an AI client connect itself the way a non-technical person would expect: no key ever shown on screen. Authorization Code + PKCE with Dynamic Client Registration; the consent screen is where an `Agent` actually gets created.
- **Remote MCP server** (`/mcp`, bearer-token authenticated) — the hosted equivalent of `connector/`'s two tools, reached over OAuth instead of a locally configured key.

The personal app (consent UI) lives in `frontend/` — a React + TypeScript + Tailwind app. In dev it runs on its own Vite server and proxies API calls to the backend; in production it's built into `public/` and served directly by the backend.

Partner sites integrate via `sdk/` (`@hapi-id/sdk`) rather than calling `/verify` and `/profile` directly — a thin client plus an Express `requireGrant` middleware. `examples/demo-job-board` is a runnable partner site built on it, used both as SDK test coverage and as the integration reference for design partners.

AI agents integrate two ways, both exposing the same two tools (`list_my_authorizations`, `get_credential`):

- **Hosted, OAuth-connected (`/mcp`, `/oauth/*`)** — the real end-user path. The backend itself is a remote MCP server; a person connects it the way they'd connect any other app — "Connect" → log in → approve — and never sees or handles a key. Built on OAuth 2.1 (Authorization Code + PKCE, Dynamic Client Registration) rather than a proprietary scheme. See `scripts/test-oauth-flow.mjs` for a script that drives the whole flow without a human or a real MCP host.
- **Local stdio connector (`connector/`, `@hapi-id/connector`)** — a developer/testing path. Requires manually pasting a connector key into an MCP host's config; not something to hand a non-technical user.

## Quickstart

```bash
npm install
docker compose up -d postgres   # Postgres on localhost:55432 (5432 was already taken locally)
npx prisma migrate dev --name init
npm run seed:partner             # prints a demo partner API key — save it, shown once
npm run dev                      # backend on http://localhost:4000

cd frontend && npm install && npm run dev   # personal app on http://localhost:5173
```

Open `http://localhost:5173` for the consent UI in dev (hot reload), or `http://localhost:4000` after running `npm run build` in `frontend/`. Drive the partner-facing API directly — see the handshake example below.

## Partner handshake example

Via the SDK (recommended — see `sdk/README.md`):

```ts
const hapi = new HAPI({ apiKey: process.env.HAPI_API_KEY! });
app.post("/apply", requireGrant(hapi, "job_application:submit"), async (req, res) => {
  const profile = await hapi.getProfile(req.hapiCredential!, ["name", "email", "resume"]);
  res.json({ status: "submitted", applicant: profile.profile });
});
```

Or the raw HTTP contract the SDK wraps:

```bash
# 1. Partner verifies a credential the agent presented
curl -X POST http://localhost:4000/verify \
  -H "Content-Type: application/json" \
  -H "x-hapi-api-key: <partner api key>" \
  -d '{"credential":"<credential>","action":"job_application:submit"}'

# 2. Partner pulls only the consented profile fields
curl -X POST http://localhost:4000/profile \
  -H "Content-Type: application/json" \
  -H "x-hapi-api-key: <partner api key>" \
  -d '{"credential":"<credential>","fields":["name","email","resume"]}'
```

## Not in this slice (by design, see STRATEGY.md)

- Task-specific email/OTP handling.
- Publishing the SDK or connector to a package registry — both are installed locally (`file:`) for now.
- The connector requesting *new* authorisations on the fly (Option B from the design discussion) — only pre-existing grants can be used today.
