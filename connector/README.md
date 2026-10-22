# @hapi-id/connector

Two ways for an AI agent (Claude, etc.) to use permissions a person already granted it through the HAPI personal app. Both are deliberately limited to **Option A** from the design discussion: a connector can only *use* authorisations that already exist — it cannot create new ones.

## The real one: hosted, OAuth-connected (no key ever shown to the end user)

This is what a non-technical person should actually use. The backend itself hosts a remote MCP server at `/mcp`, protected by OAuth 2.1 (Authorization Code + PKCE, with Dynamic Client Registration so the AI client doesn't need a pre-issued `client_id`).

The flow: add HAPI as a custom connector in Claude (or another MCP host) by its URL (`http://localhost:4000/mcp` in dev) → the host discovers the OAuth endpoints automatically → redirects the person to a HAPI login/consent page → they log in with email+password (same as the app) and click "Connect" → redirected back, done. No key, no JSON, no copy-paste — the access token is exchanged server-to-server.

This is implemented in the backend itself (`src/routes/oauth*.ts`, `src/routes/mcpHttp.ts`, `src/mcp/buildServer.ts`), not in this package. See `scripts/test-oauth-flow.mjs` in the repo root for a script that drives the entire flow (registration → login → consent → token exchange → real MCP tool calls) without a human in the loop, useful for verifying the backend without a real MCP host.

One honest limit: adding a connector by pasting its URL isn't literally zero-step — the person still needs that URL. It just removes all secret-handling. A listed/discoverable connector (so it shows up without even pasting a URL) is a later step once this is public.

## The developer one: local stdio connector (this package)

Useful for testing the backend directly, or for technical users who'd rather run a local process than rely on the hosted remote server. Requires manually pasting a connector key — not meant for end users.

### Setup

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

### Tools (same two on both paths)

- **`list_my_authorizations`** — what this agent is currently allowed to do, with scope, consented data fields, and expiry.
- **`get_credential`** — fetches a fresh, short-lived credential for one authorisation, by its grant id. Call this immediately before acting; don't reuse a credential from earlier in the conversation.

### Manual test (no real MCP host required)

```bash
npm run build
HAPI_AGENT_KEY=<key> node scripts/manual-test.mjs
```

Spawns the built connector over stdio with a real MCP client, calls both tools, and presents the resulting credential to `examples/demo-job-board`.
