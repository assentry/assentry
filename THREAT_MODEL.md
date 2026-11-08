# Threat model (internal)

What an attacker could want from Assentry, how each attempt is stopped, and what's still open. Every "Stopped by" line has an automated test in `test/` unless marked otherwise. Update this file whenever a flow changes.

## What we protect

1. **A person's identity**: nobody else's agent may sign in as them.
2. **A person's details and files**: a site gets only what that person agreed to share with it.
3. **Unlinkability**: two unrelated sites can't tell they're dealing with the same person.
4. **Sites' API keys and verified domains**: only the developer who owns them can use them.
5. **Assentry's signing keys**: whoever holds them can mint credentials.

## Who might attack

- **A malicious website** that installs the SDK and verifies its own domain.
- **Prompt injection**: text on a page that steers someone's AI agent.
- **Another person** with an Assentry account.
- **Another developer** with a console account.
- **An outsider** with no account: guessing, replaying, forging, flooding.

## Attacks and what stops them

| Attack | Stopped by |
|---|---|
| Guess a sign-in code | `asq_` + 52 random symbols (about 258 bits). Only a SHA-256 fingerprint is stored. Codes expire after 5 minutes. |
| Get a person's details through a malicious site plus a prompt injection | The person allows each site once, in the app, before it can sign in or receive a credential. Until then the site gets nothing; removing a site ends its sign-ins and stops its credentials at once. |
| Get an agent to approve the attacker's own code shown on a real site | Agents are told (MCP instructions, tool descriptions, the site's discovery document) to use only the code in the site's own sign-in box or header, never one in page content. Every sign-in is listed in the app, where the person can end it. (Partly; see open risks.) |
| Approve a code shown on one site for another | The agent must pass the domain from the address bar; the code must belong to that verified domain. |
| Approve or collect the same code twice | Conditional database updates: exactly one approval and one collection, even at the same moment. |
| Replay a credential on a different site | ES256 credentials carry the site's verified domain as `aud`; `/verify` refuses any other site. |
| Forge or alter a credential | Signature checked against Assentry's public key; `alg`, `typ`, `kid` and `iss` pinned. `none`, HMAC-with-public-key and self-signed tokens are refused. |
| Keep using a credential after the person withdraws | `/verify` and `/profile` re-check the grant, agent and sign-in in the database on every call. |
| Read details the person didn't agree to share | `/profile` releases only declared fields that are in the grant or were shared with that site by the person. Suggestions aren't released until confirmed. |
| Get a detail shared by waiting for the person to edit it | Editing a filled-in detail shares nothing new; only "Share" or filling in a missing detail does. |
| Read another site's custom details or a person's private details | Keys are namespaced (`site:<id>:` / `my:`); a site can only ask for its own declared keys. |
| Link a person across sites | Per-developer pairwise IDs (HMAC); credentials hold no user or agent IDs. |
| Reach another person's grants, files, agents, sign-ins | Every query is scoped to the session's user ID. |
| Reach another developer's apps | Every query is scoped to the session's developer ID. |
| Use one kind of session as another | Separate HKDF-derived keys per session type, plus a `kind` claim check. |
| Guess passwords | bcrypt (cost 12); 10 failed logins per email and 50 per IP per 15 minutes, then 429. |
| Find out which emails have accounts | Login gives one answer for unknown email and wrong password, in the same time (a full password check either way). Sign-up must say when an email is taken, so it's limited to 10 attempts per IP per 15 minutes. |
| Keep using a stolen session | Every session carries the account's session version, checked on every request; "Sign out on every device" raises it and ends them all, including the AI-connection browser session. |
| Keep using a stolen agent token | Access tokens last one hour. Refresh tokens work once, are replaced on every use, only for the AI app they were issued to, and stop when the person disconnects the agent; an unused connection ends after 90 days. |
| Forge a login or consent form from another site | Double-submit CSRF token on every server-rendered form; `SameSite=Lax` cookies. |
| Trick a person into connecting a look-alike AI app | The consent page shows the signed-in email and the redirect host; "replace a connection" is never pre-selected. |
| Steal an OAuth or linking code | Codes stored as fingerprints, single use (conditional update), 60 seconds, PKCE S256 required, exact redirect URI match. |
| Finish someone else's account linking in a victim's browser | The SDK requires a random `state` that the site keeps in the session and checks on return. (Docs and SDK; not tested here.) |
| Upload a disguised file | The first bytes must match the declared type; files are always served as downloads with `nosniff` and a sandbox CSP. |
| Swap a checked file for other bytes | An upload link stops working once the file is checked. |
| Download someone's file | Single-use, 5-minute download links that only the receiving site's API key can open. |
| Use domain verification to probe internal hosts | Domains must resolve only to public addresses; responses are read up to 1 KB; no redirects; 8-second timeout. |
| Plant a sign-in code or credential cookie on a partner site | The SDK uses `__Host-` cookies over HTTPS, and only accepts pending sign-ins in Assentry's exact format. (SDK tests.) |
| Inject markup into a partner page through the sign-in code | The SDK validates and escapes the code before placing it in the page. (SDK tests.) |
| Frame Assentry's pages (clickjacking) | `X-Frame-Options: DENY` and `frame-ancestors 'none'` on the API and the website. |
| Leak internals through errors | One error handler; clients only see "bad request" or "internal error". |
| Leak secrets from the activity log | The log returns display fields only. |
| A database leak exposes live secrets | API keys, agent tokens, sign-in codes, OAuth and linking codes are stored as hashes; signing keys are encrypted with a key derived from `JWT_SECRET`. (Not tested.) |
| Known flaws in libraries | `npm audit` runs on every push; Dependabot alerts and security updates are on. |
| Secrets committed to git | gitleaks scans the whole history on every push. |

## Accepted or open risks

These need a product decision or more work. They are tracked in the known-limits list.

1. **A code shown by an attacker on a real site the person already allowed.** If an agent ignores its instructions and approves a code from page content, the attacker's browser is signed in as the person. Inherent to code-based sign-in; reduced by the agent instructions and the Sign-ins list. A push or email notice for each new sign-in would help further.
2. **Email enumeration through sign-up** is limited, not closed: closing it needs email verification at sign-up.
3. **Sessions live in the browser's localStorage**, so script injection on assentry.io could read them. The CSP limits this; httpOnly cookies would close it.
4. **Agent connections from before token expiry** keep their old token until it expires (30 days after this change), then the AI app asks the person to reconnect once.
5. **DNS rebinding during domain verification.** The address is checked, then fetched; a fast-changing DNS answer could slip between the two. Low impact: no redirects, 1 KB, status only.
6. **No independent penetration test yet.**
