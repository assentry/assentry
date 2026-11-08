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

1. **A grant isn't tied to a site.** The fields a person consents to are available to any verified site their agent signs in to. A malicious site plus a prompt injection could get those fields. Options: ask the person the first time their agent signs in to a new site, or make grants per site.
2. **A code shown by an attacker on a real site.** If an attacker gets their own sign-in code shown to someone's agent on a real site (for example in user-generated content), the agent's approval signs the attacker's browser in. Inherent to code-based sign-in. Mitigations: tell agents to trust only the code in the page's `Assentry-Sign-In-Code` response header, and notify the person of each new sign-in.
3. **Sessions can't be revoked.** Person and developer sessions last 7 days and live in the browser's localStorage. Agent access tokens don't expire. Needs a session version check, logout everywhere, and refresh tokens for agents.
4. **Email enumeration.** Signup says when an email is already registered.
5. **DNS rebinding during domain verification.** The address is checked, then fetched; a fast-changing DNS answer could slip between the two. Low impact: no redirects, 1 KB, status only.
6. **No independent penetration test yet.**
