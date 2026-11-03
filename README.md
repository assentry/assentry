# HAPI core

Identity, grant, verification, audit, partner SDK and OAuth-connected agent access for HAPI — the first build slice per `STRATEGY.md` §9 and the locked agent-integration model. No task-specific email/OTP yet: everything else in the committed v1 workflow (§9) now has a working, end-to-end-tested path.

## Architecture

- **Identity** — `User` signup/login (`/auth`).
- **Agent** — a connected AI orchestrator instance the user owns (`/agents`, list/revoke only). Agents are created exclusively through the OAuth consent flow below — there's no manual "create an agent" path, so no secret is ever generated for a human to copy.
- **Grant** — the consent act: a user authorises a specific agent to do a specific scoped action until a specific time (`/grants`). Issuing a grant returns a signed **credential** — what an agent carries and presents.
- **Verify** — the partner-facing handshake (`/verify`, API-key authenticated). Always re-checks the database (revocation, expiry, agent status), never trusts the signed token alone.
- **Profile** — scoped data disclosure (`/profile`), separate from authorisation. Returns only the intersection of what's requested and what the grant's `consentedFields` actually cover. Pull, not push — nothing is embedded in the credential itself.
- **Audit** — every verify/profile/grant/credential event is logged and viewable by the user (`/audit`).
- **OAuth** (`/oauth/*`, `/.well-known/*`) — lets an AI client connect itself the way a non-technical person would expect: no key ever shown on screen. Authorization Code + PKCE with Dynamic Client Registration; the consent screen is where an `Agent` actually gets created.
- **Remote MCP server** (`/mcp`, bearer-token authenticated) — what the AI talks to after connecting: `list_my_authorizations` and `get_credential`. Deliberately read-only — an agent can only *use* permissions the person already granted through the personal app, never request new ones (Option A from the design discussion).
- **Account linking** (`/link/*`) — the explicit, stronger-assurance way to handle a partner's *existing* accounts (created before HAPI existed): a one-time, human-driven confirmation that the partner stores as a mapping, no password needed from then on. This is an alternative, not the primary path — see below.
- **Implicit matching, no new HAPI infrastructure** — the primary intended way to handle existing accounts: a partner's own backend decides, using only what `/verify` + `/profile` already disclose, whether to match an existing account or create one. HAPI's job stops at proving who the agent represents; what a site does with that proof is the site's business. `examples/demo-job-board`'s `/apply` demonstrates this (match/create by email). See "What 'the agent logs in' actually means" in `STRATEGY.md` §9 for the full model, and the known gap this accepts (HAPI doesn't verify email yet, so this trusts an unverified claim for now — real identity verification, KYC, and liveness checks are future work, not forgotten).

The personal app (consent UI) lives in `frontend/` — a React + TypeScript + Tailwind app. In dev it runs on its own Vite server and proxies API calls to the backend; in production it's built into `public/` and served directly by the backend. Its Agents tab shows the `/mcp` address to paste into an AI's own connector settings — that's the only "setup" a person ever does; everything else happens via the OAuth login/consent redirect.

Partner sites integrate via `@hapi-id/sdk` ([separate public repo](https://github.com/bioku-QR/hapi-sdk), MIT licensed) rather than calling `/verify` and `/profile` directly — a thin client plus an Express `requireGrant` middleware. `examples/demo-job-board` is a runnable partner site built on it (installed as a real external dependency, not a local path), used both as SDK test coverage and as the integration reference for design partners.

See `scripts/test-oauth-flow.mjs` for a script that plays the real MCP client role end-to-end with no shortcuts — dynamic registration, login, consent, PKCE'd token exchange, and real MCP tool calls over the remote transport — useful for verifying the backend without a real AI client. `scripts/test-account-link.mjs` does the same for the account-linking flow.

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

Via the SDK (recommended — see [hapi-sdk's README](https://github.com/bioku-QR/hapi-sdk)):

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
- Publishing the SDK to npm — installed as a GitHub dependency (`github:bioku-QR/hapi-sdk`) for now.
- An agent requesting *new* authorisations on the fly (Option B from the design discussion) — only pre-existing grants can be used today.
- Listing HAPI in each AI platform's official connector directory — today it's added as a custom/unlisted connector by URL.
- Helping an agent through a plain login gate a site never modified for HAPI (case 3 of the account-access model) — permanently out of scope, by design, not a gap to close later.
