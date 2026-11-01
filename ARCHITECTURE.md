# HAPI Architecture

```mermaid
flowchart TB
    User(["Person"])
    App["Personal App (React)"]
    Agent["AI Agent (Claude / ChatGPT)"]
    Partner["Partner Website<br/>e.g. Demo Job Board"]
    DB[("Postgres")]

    subgraph HAPI["HAPI Backend (Render)"]
        direction TB
        Core["Identity / Grants / Audit"]
        OAuthSrv["OAuth 2.1 server<br/>register · authorize · token"]
        MCP["MCP server (/mcp)<br/>list_my_authorizations · get_credential"]
        Verify["/verify · /profile · /link/*"]
    end

    User -- "log in, connect agent,<br/>grant permission" --> App
    App -- "session (JWT)" --> Core
    User -- "instructs" --> Agent
    Agent -- "OAuth connect" --> OAuthSrv
    Agent -- "fetch credential (MCP)" --> MCP
    Agent -- "present credential<br/>Authorization: Bearer" --> Partner
    Partner -- "@hapi-id/sdk" --> Verify
    Core --> DB
    OAuthSrv --> DB
    MCP --> DB
    Verify --> DB
```

## The flow, step by step

1. **A person creates their identity** in the Personal App and connects an agent — not by pasting a key, but by adding HAPI's `/mcp` address in their AI's own connector settings, which redirects them to a HAPI login/consent screen. Approving it is what creates the `Agent` record.
2. **The person authorises that agent** for a specific scope (e.g. `job_application:submit`), specific data fields, and an expiry — a `Grant`. Nothing is granted just by connecting.
3. **The agent asks HAPI what it's allowed to do** (`list_my_authorizations`) and, right before acting, asks for a fresh, short-lived credential (`get_credential`) — both over MCP, authenticated by the OAuth access token from step 1. The credential contains no personal data, only IDs, scope, and expiry.
4. **The agent presents that credential to a participating website**, as a standard `Authorization: Bearer` header — HAPI's job ends here. What the agent does with the credential (apply for a job, read content, whatever the task is) is the agent's and the website's business, not HAPI's.
5. **The website verifies independently**, via `@hapi-id/sdk`, which calls HAPI's `/verify` (and optionally `/profile`, which only discloses the specific fields the grant consented to, live, not baked into the credential). The website decides what the verified identity is allowed to do on its own — including recognising an existing account (implicit email matching, or an explicit one-time linking flow), with no further HAPI-hosted step.
6. **Every verification, disclosure, and grant action is logged**, visible to the person who owns the identity, not just to whoever built the agent or the website.

## What's deliberately *not* in this diagram

- HAPI never touches the partner website directly — no arrow from HAPI to Partner. That's the agent's job.
- There's no arrow from Partner back into HAPI's identity database — the website keeps its own account records; HAPI only ever answers "is this credential valid, and what does it disclose."
- A plain login gate a website never adapted for HAPI isn't reachable by any of this, by design (see `STRATEGY.md`, §9, case 3).
