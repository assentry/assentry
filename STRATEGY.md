# Agentic Trust Infrastructure
### Identity, authorisation and communication infrastructure for the AI-agent era

*Last updated 2026-10-21. Written for prospective design partners — AI-agent developers and the platforms (job boards, ATS vendors) their agents need to act against.*

## 1. Vision

Build the trust infrastructure that enables AI agents to securely act on behalf of **individual people** across websites and digital services — starting with one narrow, high-volume wedge (automated job applications) rather than a horizontal platform for everyone.

As people increasingly delegate tasks to AI agents, the internet needs a way to establish who an agent represents, what it is authorised to do, and how it can interact with online services without requiring unrestricted access to personal accounts and credentials.

**Our vision is to become the trust layer between individual people, their personal AI agents, and the consumer-facing internet** — not to compete with enterprise IAM vendors for workforce-agent budgets.

## 2. The Problem

The internet was designed primarily for people interacting with websites directly. Users log in with email addresses and passwords, complete multi-factor authentication, verify email addresses, and manually approve sensitive actions.

AI agents introduce a different model. People want agents to apply for jobs, book appointments, make purchases, manage subscriptions, complete forms and perform other online tasks autonomously.

However, existing systems create several barriers:

- Agents often need access to passwords or authenticated browser sessions.
- Email verification and one-time passcodes interrupt autonomous workflows.
- Users must repeatedly intervene to approve or complete routine tasks.
- Websites lack a consistent mechanism to recognise externally operated agents and verify their delegated authority.
- Giving an agent access to a user's primary inbox or account can expose unrelated personal information.
- Individual users — as opposed to enterprises deploying internal agents — have no control plane of their own for this. Every "agent identity" product shipping in 2025–2026 (see §8) is sold to companies managing *their own* agents against *their own* systems; none give a private individual a place to authorise, scope, and revoke their personal agent's access across arbitrary third-party sites.

The result is fragmented agent access, insecure credential sharing and incomplete automation — and the gap is sharpest for individuals, not enterprises.

## 3. The Solution

Build a two-sided platform with a shared identity and delegation infrastructure, with **individual users as the paying/primary customer** and developers (agent builders, and the websites that choose to accept agents) as the integration surface.

### A. Developer Infrastructure: Agent Authentication and Authorisation

Provide SDKs, APIs and middleware that developers integrate into their websites and applications.

The infrastructure enables participating services to:

- Verify the identity of an AI agent.
- Establish which person the agent represents.
- Validate the authority delegated to the agent.
- Define and enforce permissions for specific actions.
- Require human approval for sensitive operations.
- Issue short-lived, restricted credentials.
- Revoke authorisations and maintain audit logs.

Per §3.5, this layer should be built *on* the emerging open standards (OAuth 2.1, ID-JAG, AuthZEN), not as a proprietary alternative to them — the goal is to spare individual users and small agent developers from having to assemble enterprise-grade IAM themselves, not to out-build Okta.

### B. Personal Identity App

Provide a user-facing application through which people establish and manage their digital identity and relationships with AI agents.

Users can:

- Create and manage their personal identity.
- Connect supported identity providers and services.
- Authorise agents to perform specific tasks.
- Set permissions, limits and approval requirements.
- View agent activity across participating services.
- Revoke permissions and manage connected services.

The app becomes the user's control centre for delegated digital activity — this is the product's core differentiation, since it is the piece no enterprise-IAM competitor is building.

### C. Agent Email Identity

Provide purpose-specific email identities and inboxes designed for AI-agent workflows.

When an agent needs to register for a service or complete an authorised task, the platform can create a dedicated email address instead of exposing the user's primary email address.

The mailbox infrastructure enables authorised agents to:

- Receive email verification links and one-time passcodes.
- Complete supported account-registration workflows.
- Retrieve task-related notifications.
- Manage correspondence associated with a particular service or task.
- Access messages through a restricted API rather than an unrestricted personal inbox.

Email identities can be persistent when users need continuing access to important correspondence, or temporary when the task permits it. Users can revoke agent access and control message retention.

**This is the component with a funded, shipping direct competitor** (AgentMail — see §8). It should not be positioned as the product's core moat; it is necessary plumbing. The moat has to be the combination of B (user-owned consent/control plane) with A and C under one roof, aimed at individuals rather than enterprises.

The objective is not to bypass authentication controls. It is to enable authorised automation while respecting each website's security requirements — see §4.5 on why this has to be a hard constraint, not a disclaimer.

## 4. How the Platform Works

1. A user creates an identity through the personal app.
2. The user instructs an AI agent to complete a task.
3. The agent requests the necessary permissions.
4. The platform records consent and issues restricted authorisation.
5. Where required, the platform creates a task-specific email identity.
6. The agent interacts with a **participating** website — one that has integrated the SDK and explicitly opted in to accepting authorised agents.
7. The website's integration verifies the agent's identity and delegated authority **directly against HAPI's identity/authorisation service** — a handshake between the partner's SDK and HAPI, not credential injection by the agent. The agent never fills in or carries the user's password; it only presents the signed, scoped authorisation, and the website's own integration decides what to do with that trust (e.g. create an account, skip a redundant OTP/CAPTCHA step).
8. The agent completes permitted actions and retrieves relevant communications.
9. The platform records activity and allows the user to review or revoke access.

The website remains responsible for enforcing its own application permissions and compliance requirements. **The platform does not and will not claim to help an agent act against a non-participating website's wishes** — see §4.5.

### 4.5 Legal and Compliance Risk

The flow above — an agent registering for a service and clearing email verification without a human present — sits in live legal gray area, not settled law. This needs to be treated as a hard product constraint from day one, not a disclaimer buried in a terms page.

- **hiQ v. LinkedIn** (resolved 2022): the Ninth Circuit held the CFAA does not criminalise automated access to public data. But hiQ still lost on **breach-of-contract/ToS grounds** — a $500k judgment and permanent injunction that effectively ended the company. Takeaway: CFAA exposure is low, but **ToS-as-contract exposure is where real enforcement lives**, and a user authorising their own agent does not bind the *target website* to accept that agent.
- **Amazon v. Perplexity** (filed Nov 2025, N.D. Cal., unresolved as of this writing): Amazon's terms require agents to self-identify via User-Agent header; Amazon alleges Perplexity's Comet browser-agent violated this. A major platform is actively litigating against an agent it considers unauthorised, right now — this is not a hypothetical risk.
- **X and LinkedIn** both carry explicit anti-automation clauses (X: an OAuth grant alone is not consent for automated actions; LinkedIn §8.2 bans "bots or unauthorized automated methods").
- **OpenAI's own ChatGPT agent policy** blocks agents from certain sites outright, mandates human "watch mode" for sensitive actions on email/payment-adjacent sites, and bans concealing the role of AI — i.e. even the leading agent vendor hedges hard against undisclosed autonomous registration.

**Product implication:** the platform only supports **opted-in, participating websites** that have integrated the SDK (§3A) and explicitly agreed to accept authorised agents under disclosed terms. It is never marketed, sold, or engineered as a way to get an agent past a non-participating site's verification or anti-bot controls. This is not just risk management — it's the thing that makes "consent and auditability" in §8's differentiation actually true rather than aspirational, and it conveniently narrows scope for the MVP in §9 to sites willing to be design partners.

## 5. Target Customers

### Individual users (primary)

People who use AI agents to automate digital tasks — starting with job seekers running agent-assisted applications — and want control over their identity, credentials, communication and permissions.

They use the personal app to manage identity and authorise agents. **This is the paying customer the business is built around**, per the strategic call made in this revision: the enterprise/workforce agent-identity market (Okta, Microsoft, Stytch, Descope, WorkOS) is already well-capitalised and contested; the individual-consumer control plane is comparatively open.

### AI-agent developers (primary design partners)

Companies and individual developers building personal/consumer-facing agents — specifically, in the v1 vertical, job-application agents — that need secure, disclosed access to job boards, ATS systems, and employer-correspondence inboxes on behalf of the people they serve.

They integrate the platform to request permissions, obtain authorised access and retrieve relevant email messages, without having to build consent management, credential scoping, or inbox infrastructure themselves.

### Websites and platforms willing to accept agents (secondary, opt-in only)

Job boards, applicant-tracking-system vendors, and other consumer platforms that choose to explicitly support authorised agent traffic rather than treat all automation as abuse. They use the SDK and API to recognise and rate-limit/govern agent traffic distinctly from unauthorised bots — this is a sales motion that only works once there's a volume of real users and agent-developer partners asking for it, so it follows rather than leads the GTM sequence in §9.

## 6. Initial Use Cases

**v1 launch vertical (committed): automated job applications and employer correspondence.** This is high-volume, repetitive, heavily email-verification-dependent, and — unlike payments or enterprise SaaS onboarding — not currently targeted by any of the enterprise agent-identity incumbents in §8. It is also the one vertical in this list where "individual user as paying customer" and "agent developer as design partner" line up cleanly: job seekers have clear willingness to pay for better outcomes, and job-application agent builders are numerous and underserved on the identity/email side.

**Roadmap, not v1 (explicitly deprioritised for now, revisit after v1 traction):**
- Online account registration and email verification generally — this is AgentMail's existing shipped product; weak differentiation if pursued head-on before the consumer control-plane angle is proven.
- Travel, hotel and appointment bookings; online shopping and purchases — increasingly routed through Visa's Trusted Agent Protocol, Mastercard Agent Pay, and OpenAI/Stripe's Agentic Commerce Protocol. Integrate with these later; don't build competing payment-delegation rails now.
- Subscription management; business administration and customer onboarding — enterprise-leaning, closer to the already-contested Okta/Microsoft/Stytch/Descope space.
- Other multi-step consumer workflows requiring authenticated access — natural expansion once the job-applications wedge has real usage data.

## 7. Business Model

Primary model: individuals are the customer relationship, but — as with Plaid — much of the actual revenue is collected from the developers and platforms integrating around them, since infra is rarely a line item individuals pay for directly at first.

Potential revenue streams:

- Usage-based charges for authentication and authorisation requests (billed to agent-developer design partners).
- Developer subscriptions and API plans.
- Charges for managed agent inboxes and email delivery.
- A free or low-cost tier for individual users' personal app, to drive adoption and generate the usage that agent-developers and platforms pay for — mirrors the "open spec, paid hosted implementation" pattern WorkOS used with its `auth.md` release (see §9).
- Enterprise licensing for advanced policy enforcement, audit and compliance — explicitly a later-stage expansion, not the v1 focus, given how contested that segment already is.

The long-term business is an infrastructure platform with developer adoption and individual-user participation reinforcing one another, sequenced consumer-first rather than enterprise-first.

## 8. Competitive Positioning

The agent-identity market crystallized into a distinct, crowded category in a roughly 12-week window in early-to-mid 2025, and by late 2026 it is contested on every side. This section was revised after landscape research in October 2026 turned up closer, more direct competition than originally assumed — worth stating plainly rather than minimising.

**Enterprise IAM incumbents**, selling agent identity as an extension of workforce IAM: Okta (Agent SSO / Cross App Access, GA Aug 2026), Microsoft (Entra Agent ID via Agent 365, GA May 2026), Ping Identity, Palo Alto Networks (Idira — a unified control plane across human/machine/agent identity).

**Dev-first CIAM challengers**, selling agent identity as an API: Stytch (Connected Apps), Descope (Agentic Identity Hub, now v2.5 — credential vault, step-up auth, SCIM for agents), WorkOS (AuthKit for MCP servers, plus the open `auth.md` registration spec it published May 2026; raised a $100M Series C at a $2B valuation in Mar 2026), Clerk (agent toolkit, generally regarded as behind on enterprise depth).

**The protocol layer itself is becoming free and standardized**: IETF's ID-JAG draft, OpenID's AuthZEN (Final Jan 2026), and the Linux Foundation's A2A protocol are open specs with no single commercial owner — and Anthropic, as MCP's creator, now controls the largest distribution channel for agent-to-tool auth directly via Enterprise-Managed Authorization (GA Aug 2026, Okta as first IdP partner). See §3.5 — this means the cryptographic/token layer is not a place to try to build a moat.

**Direct competitor on the email-identity pillar specifically: AgentMail.** Funded ($6M), already shipping per-agent scoped inboxes with autonomous OTP/verification-link handling (`agent.sign_up()`), and as of **Oct 6, 2026** shipping **AgentID**, an OIDC-based agent identity layer on top of that inbox infrastructure. This is, as of this writing, identity + delegation + scoped email combined in one live, funded product — this doc's earlier claim that "nobody combines all three" no longer holds and should not be repeated to design partners.

**Payment delegation** is already a three-way fight between Visa, Mastercard, and OpenAI/Stripe — not a greenfield.

**Where this leaves actual differentiation**, given the above:

1. **Individual-consumer orientation, not enterprise/workforce orientation.** Every player listed sells to organisations deploying agents against their own or their partners' systems. None give a private individual a control plane for their own personal agent acting across arbitrary third-party consumer sites they don't operate. That's the open lane — narrower than the original "trust layer for everything" framing, but defensible precisely because it's less attractive to better-capitalised enterprise-IAM players.
2. **A named, committed vertical (job applications) rather than a horizontal platform.** AgentMail's AgentID is general-purpose; this platform's wedge is a specific, high-volume, individual-user workflow where the consent and audit experience can be tuned end-to-end, rather than a generic identity primitive developers have to assemble into a workflow themselves.
3. **Consent/control-plane UX as the product, not the token format.** §3B (the personal app) is the one piece none of the above are building, because none of them have an individual end-user as their customer.

This is a narrower bet than the original doc implied, and it should be stated to design partners as such: the win condition is not "become the trust layer for the agentic internet," it is "become the default way individuals authorise job-application agents, and expand from a proven, defensible beachhead."

## 9. Initial Product Strategy

Start with a developer-focused MVP and a minimal personal app, scoped to one vertical.

**Committed v1 workflow:** a job seeker authorises a job-application agent; the agent registers with a job board or ATS using a scoped, task-specific email identity; the platform issues short-lived delegated credentials the job board's integration can verify; the agent completes the application and surfaces employer correspondence back to the user through the personal app, without ever touching the user's primary inbox or password.

The MVP should include:

- A developer SDK and API, built on OAuth 2.1 / ID-JAG / AuthZEN per §3.5 rather than a proprietary protocol.
- An authorisation and policy service (an AuthZEN-compatible PDP, not a bespoke policy engine).
- A simple user consent interface, inside the personal app.
- A task-specific email API, scoped to the job-application vertical first.
- Token expiry and revocation.
- An audit trail, viewable by the end user.

### Agent integration model (locked, 2026-10-21)

The platform has three layers: **Identity** (the personal app, §3B — where the user creates identity and consent), **Agent** (Claude, GPT, Grok, or whatever orchestrator the user already runs — the bearer/conduit), and **Business** (the participating website or service — the verifier). The following decisions are locked for the first build:

- **v1 build excludes the email/OTP layer (§3C).** The first working slice is identity + grant model + consent UI + verification surface + audit log only. Task-specific email only gets built once the core issue→present→verify→revoke loop is proven; it is not needed to demonstrate the differentiated part of the product (§8.3).
- **Adoption is self-service, not platform-partnership-led.** Rather than waiting on Anthropic/OpenAI/xAI to integrate HAPI natively, HAPI ships a connector per platform (an MCP server for Claude, a custom action/plugin for ChatGPT, the equivalent for Grok) that the *user* installs into their own agent setup — the same pattern as adding an MCP server to Claude Desktop or a custom GPT action. This avoids depending on vendor cooperation, at the cost of only reaching technical/motivated early adopters until a one-click install flow exists per platform.
- **The agent layer is untrusted and must be treated as stateless.** Claude, GPT, and Grok are different vendors HAPI doesn't control — none can be trusted to faithfully carry scope/expiry, and any of them can be prompt-injected or can hallucinate authority. Therefore:
  - The agent does not "understand" or persistently carry identity. Whatever a connector call returns only lives in that session's model context, and reliability of that varies per host/platform.
  - Credentials must be **self-describing**: signed, with scope and expiry embedded, not bare opaque references.
  - The agent must **re-fetch a fresh credential per action** rather than relying on anything it remembers from earlier in the conversation.
  - All real state (the grant, its validity, its revocation status) lives server-side on HAPI's platform, not in the model's context.
  - **Verification at the Business layer must be independent of what the agent claims** — the business checks the credential's signature/scope/expiry (or calls back to HAPI) every time, regardless of the agent's behaviour. This is what makes consent and auditability (§8.3) actually enforceable rather than aspirational.
- **The mechanism is a handshake, not credential injection.** When an agent acts on a participating site, the trust decision is a direct exchange between that site's SDK integration and HAPI's identity/authorisation service — verifying the signed, scoped credential. The agent never holds, fills in, or injects the user's actual site password into a login/registration form; it only carries and presents the HAPI-issued authorisation. This distinction is canonical and should be used in all external-facing descriptions of the flow (see §4, step 7).

### What "the agent logs in" actually means (locked, 2026-11-01)

A participating site having the SDK installed does not by itself mean an agent can get past every login/signup wall on that site. Three cases, deliberately scoped:

1. **A new, agent-specific flow the site built** (e.g. "create an account and submit an application"). Works today, no password involved — the site's own code treats a valid HAPI credential as sufficient to create an account or session. This is what `examples/demo-job-board` demonstrates.
2. **An existing account the user had before connecting HAPI.** Two approaches exist, deliberately kept as alternatives rather than one replacing the other:
   - **Explicit account-linking** (`/link/authorize`, `/link/token`): a one-time, human-driven confirmation — the user, already logged into their existing account on the site, confirms "this is me" to HAPI once; the site stores the resulting HAPI `userId` against its account record. Strongest assurance, extra step for the user.
   - **Implicit matching via the existing handshake (locked, 2026-11-02, primary intended path):** no separate HAPI-hosted confirmation screen at all. The site's own backend, using the same `/verify` + `/profile` call it already makes, decides for itself whether the disclosed data (e.g. email) matches an existing account or warrants creating a new one — entirely the partner's own logic, invisible to the user. This follows directly from how HAPI's scope is defined (see below): HAPI proves *who the agent represents and what it's allowed to do*; what the site does with that proof — including whose account it is — is the site's business, not a second HAPI-mediated step.
3. **A plain login gate the site never modified for HAPI.** Out of scope, permanently, by design. HAPI never stores or hands over a user's actual site password, and never tries to help an agent bypass a non-participating site's unmodified security (§4.5). This is identical in spirit to §4.5's constraint, just stated at the level of an individual login wall rather than a whole site.

**HAPI's scope, stated precisely (locked, 2026-11-02):** HAPI's job ends at proving an agent is traceable to a specific, consenting person, with a specific permission. It does not execute the agent's errand (filling forms, writing applications, deciding what to submit) and does not mediate how a participating site reconciles that identity with its own account records — both are the site's and the agent's responsibility. This is a tighter restatement of §8.3's differentiation (consent/control-plane UX as the product), not a new position.

**Known gap this creates (accepted for the prototype, not a long-term position):** implicit matching is only as trustworthy as the data HAPI discloses. Email in a user's HAPI profile is **not currently verified** — a user can enter any string at signup. A partner matching accounts by email is, for now, trusting an unverified claim. **HAPI must eventually offer robust identity verification** — email verification, phone verification, address verification, KYC, and liveness checks — so that disclosed fields can be honestly marked as verified and partners can decide how much to trust them. Not built yet; explicitly on the roadmap, not forgotten.

Case 2's link flow reuses the Partner model (already a known, API-key-authenticated entity — see §3A) rather than introducing a second OAuth-client concept: the partner already has a secret (their API key) for server-to-server use, so the link-code exchange is a confidential-client token exchange, not a new public-client PKCE flow like the agent connector in §9's agent integration model.

### Go-to-market sequencing

Precedent from comparable infrastructure plays, applied to this vertical:

- **Plaid and Stripe** both grew bottom-up — individual developers first, enterprise sales later, letting early integrators become internal advocates rather than starting with procurement-led enterprise sales.
- **WorkOS's `auth.md`** (May 2026): an open, MIT-licensed spec released for free to seed adoption and mindshare, monetizing the hosted/managed implementation. Directly applicable here — open-source the consent schema and agent-authorisation SDK; charge for the hosted authorisation service and managed inboxes.
- **Design-partner programs succeed when they measure willingness to pay pre-launch, not enthusiasm** (Bessemer's framing). Given how crowded the horizontal space already is (§8), the first 3–5 design partners should be named, committed, and paying or contractually committed to pay — not demo accounts. Concretely: 2–3 job-application-agent developers/startups as the agent-developer side, and 1–2 mid-size job boards or ATS vendors willing to explicitly opt in to accepting disclosed agent traffic (per §4.5, this has to be opt-in — do not approach platforms that would treat this as unauthorised automation).
- Validate the product with this named cohort before expanding into the roadmap verticals in §6, and well before any attempt at the "universal identity network" framing in §10.

## 10. Long-Term Ambition

If the job-applications wedge proves out — real usage, real willingness to pay from both job seekers and agent-developer partners, and at least one job board or ATS vendor treating agent traffic as a supported channel rather than abuse — the same consent/control-plane model extends to the other roadmap verticals in §6: subscription management, bookings, shopping, account registration broadly.

The honest long-term ambition, revised from the original "common trust and delegation layer for the agentic internet": not to out-build Okta, Microsoft, or AgentMail on protocol or inbox infrastructure, but to be the place **individuals** go to control what their personal agents are authorised to do — a consumer identity brand in a category that, as of October 2026, is being built almost entirely for enterprises.

People would control their identity and permissions through one interface, starting with the one workflow (job applications) where that control plane is most obviously worth paying for.
