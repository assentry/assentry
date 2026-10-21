# HAPI core

Identity, grant, verification and audit core for HAPI — the first build slice per `STRATEGY.md` §9 and the locked agent-integration model. No email/OTP, no partner SDK polish, no connector yet: just the consent/authorisation loop that everything else depends on.

## Architecture

- **Identity** — `User` signup/login (`/auth`).
- **Agent** — a connected AI orchestrator instance the user owns (`/agents`). Connecting an agent grants it nothing by itself.
- **Grant** — the consent act: a user authorises a specific agent to do a specific scoped action until a specific time (`/grants`). Issuing a grant returns a signed **credential** — this is what an agent would carry and present, once a real connector exists.
- **Verify** — the partner-facing handshake (`/verify`, API-key authenticated). Always re-checks the database (revocation, expiry, agent status), never trusts the signed token alone.
- **Profile** — scoped data disclosure (`/profile`), separate from authorisation. Returns only the intersection of what's requested and what the grant's `consentedFields` actually cover. Pull, not push — nothing is embedded in the credential itself.
- **Audit** — every verify/profile/grant event is logged and viewable by the user (`/audit`).

The personal app (consent UI) lives in `frontend/` — a React + TypeScript + Tailwind app. In dev it runs on its own Vite server and proxies API calls to the backend; in production it's built into `public/` and served directly by the backend.

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

- Agent connectors (MCP server for Claude, etc.) — nothing presents credentials automatically yet.
- Task-specific email/OTP handling.
- Any real partner integration/SDK packaging — `/verify` and `/profile` are the contract, not yet published as an installable package.
