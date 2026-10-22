# @hapi-id/connector

The MCP server that lets an AI agent (Claude, etc.) use permissions a person already granted it through the HAPI personal app.

Deliberately limited to **Option A** from the design discussion: this connector can only *use* authorisations that already exist — it cannot create new ones. If a person wants their agent to do something new, they authorise it in the personal app first, then tell their agent to go.

## Setup

1. In the personal app, connect an agent (Agents tab) and copy the connector key it gives you once.
2. Authorise that agent for whatever it needs to do (Authorisations tab).
3. Add this as an MCP server in your AI's config, e.g. for Claude Desktop:

```json
{
  "mcpServers": {
    "hapi": {
      "command": "node",
      "args": ["/absolute/path/to/hapi/connector/dist/index.js"],
      "env": {
        "HAPI_AGENT_KEY": "<the connector key from step 1>",
        "HAPI_BASE_URL": "http://localhost:4000"
      }
    }
  }
}
```

```bash
npm install
npm run build
```

## Tools

- **`list_my_authorizations`** — what this agent is currently allowed to do, with scope, consented data fields, and expiry.
- **`get_credential`** — fetches a fresh, short-lived credential for one authorisation, by its grant id. Call this immediately before acting; don't reuse a credential from earlier in the conversation — if the person revoked it since, this fails instead of handing out stale access.

## Manual test (no real MCP host required)

```bash
npm run build
HAPI_AGENT_KEY=<key> node scripts/manual-test.mjs
```

Spawns the built connector over stdio with a real MCP client, calls both tools, and presents the resulting credential to `examples/demo-job-board` — exercising the exact path a real AI host would.
