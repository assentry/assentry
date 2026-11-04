import Link from "next/link";
import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";
import { DevHeader } from "./DevHeader";
import { API_BASE_URL } from "../../lib/api";

const BASE_URL = API_BASE_URL;

const SECTIONS = [
  { id: "overview", label: "Overview & concepts" },
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk-reference", label: "SDK reference" },
  { id: "discovery", label: "Agent discovery" },
  { id: "account-linking", label: "Account linking" },
  { id: "http-api", label: "HTTP API" },
  { id: "errors", label: "Errors & denial reasons" },
];

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-t border-white/5 pt-12 text-2xl font-bold tracking-tight text-white first:border-0 first:pt-0">
      {children}
    </h2>
  );
}

function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mt-10 scroll-mt-24 text-lg font-semibold text-white">
      {children}
    </h3>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-slate-300">{children}</p>;
}

function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-200">{children}</code>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm leading-relaxed text-white">
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-300">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Signature({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 font-mono text-[13px] text-white">
      {children}
    </pre>
  );
}

const QUICKSTART_CODE = `import express from "express";
import { Assentry, assentryDiscovery, requireGrant, type AssentryRequest } from "@assentry/sdk";

const assentry = new Assentry({
  apiKey: process.env.ASSENTRY_API_KEY!,
  baseUrl: "${BASE_URL}",
});

const app = express();
app.use(express.json());

// Makes your whole site discoverable to agents (see "Agent discovery").
app.use(assentryDiscovery({ partnerName: "Acme" }));

app.get(
  "/account",
  requireGrant(assentry, {
    discover: { path: "/account", method: "GET", description: "The person's account page" },
  }),
  async (req: AssentryRequest, res) => {
    // req.assentryGrant = { userId, agentId, expiresAt } — who the agent acts for.
    const profile = await assentry.getProfile(req.assentryCredential!, ["name", "email"]);
    res.json({
      actingFor: req.assentryGrant!.userId,
      profile: profile.valid ? profile.profile : {},
    });
  }
);

app.listen(3000);`;

const SESSION_OR_CREDENTIAL_CODE = `import { declareDiscoverableRoute, getCredentialFromRequest } from "@assentry/sdk";

// This page also accepts a normal logged-in human, so it can't use
// requireGrant (which rejects any request without a credential).
declareDiscoverableRoute({ path: "/dashboard", method: "GET", description: "Account dashboard" });

app.get("/dashboard", async (req, res) => {
  if (req.session?.user) return res.send(renderDashboard(req.session.user));

  const credential = getCredentialFromRequest(req);
  if (!credential) return res.redirect("/login");

  const result = await assentry.verify(credential);
  if (!result.valid) return res.status(403).send(\`Access denied: \${result.reason}\`);

  res.send(renderDashboard({ assentryUserId: result.userId }));
});`;

const DISCOVERY_DOC = `{
  "assentry_version": "1",
  "partner": "Acme",
  "description": "This site accepts AI agents acting on a person's behalf, authorised and verified through Assentry (...).",
  "credential": {
    "header": "Authorization",
    "scheme": "Bearer",
    "instructions": "Present the Assentry credential your grant issued as 'Authorization: Bearer <credential>' on the routes below. No login, session or signup is needed or should be attempted."
  },
  "routes": [
    { "path": "/account", "method": "GET", "description": "The person's account page" }
  ]
}`;

const LINKING_CODE = `const assentry = new Assentry({
  apiKey: process.env.ASSENTRY_API_KEY!,
  baseUrl: "${BASE_URL}",
  partnerId: process.env.ASSENTRY_PARTNER_PUBLIC_ID!, // your app's Public ID — safe to expose
});

// 1. Your already-logged-in user clicks "Link my Assentry account".
app.get("/link/start", (req, res) => {
  res.redirect(
    assentry.getAccountLinkUrl({
      redirectUri: "https://yoursite.com/link/callback", // must be registered in the console
      state: req.session.user.id,                          // echoed back to you unchanged
    })
  );
});

// 2. Assentry sends them back with a one-time code (valid 60 seconds).
app.get("/link/callback", async (req, res) => {
  if (req.query.error === "access_denied") return res.send("Linking cancelled.");
  const { userId } = await assentry.exchangeLinkCode(String(req.query.code));
  await db.users.update(req.session.user.id, { assentryUserId: userId });
  res.send("Linked!");
});`;

export function DeveloperDocs() {
  return (
    <div className="relative min-h-screen bg-navy-950">
      <DevHeader />

      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Documentation</p>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
                {s.label}
              </a>
            ))}
            <div className="mt-6 border-t border-white/5 pt-4">
              <Link href="/developers/console" className="block rounded-lg px-3 py-1.5 font-medium text-neutral-300 hover:bg-white/5">
                Open the console →
              </Link>
            </div>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl flex-1 pb-24">
          <details className="mb-8 rounded-xl border border-white/10 bg-white/5 lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-white">Jump to a section</summary>
            <nav className="space-y-1 px-4 pb-3 text-sm">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block py-1 text-slate-300 hover:text-white">
                  {s.label}
                </a>
              ))}
            </nav>
          </details>

          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Assentry developer documentation</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Accept AI agents on your website</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            Assentry lets your site recognise an AI agent acting on behalf of a real, consenting person — and
            pull only the profile data that person agreed to share — without the agent ever touching a
            password.
          </p>

          {/* ---------------- Overview ---------------- */}
          <div className="mt-12">
            <H2 id="overview">Overview & concepts</H2>
            <P>Four things are involved in every request an agent makes to your site:</P>
            <Table
              head={["Concept", "What it is"]}
              rows={[
                [<b key="p">Person</b>, "Someone with an Assentry account. They own their identity and decide which agents can act for them."],
                [<b key="a">Agent</b>, "An AI assistant (Claude, ChatGPT, …) the person connected to Assentry. It never holds the person's passwords."],
                [
                  <b key="g">Grant</b>,
                  "The person's authorisation for one agent: which profile fields it may disclose, and until when. The person can revoke it at any time.",
                ],
                [
                  <b key="c">Credential</b>,
                  <>
                    A short-lived signed token the agent fetches from Assentry right before acting, and presents to your site as{" "}
                    <C>Authorization: Bearer &lt;credential&gt;</C>. It contains IDs and an expiry only — never personal data.
                  </>,
                ],
              ]}
            />
            <H3>What your site does</H3>
            <P>
              When a request arrives with a credential, your server asks Assentry whether it&apos;s valid
              (<C>verify</C>) — every time, never trusting the token on its own. If it is, you know which
              person the agent represents. If you need details like their name or email, you ask Assentry for
              them separately (<C>getProfile</C>), and you only get the fields that person consented to
              share for this grant.
            </P>
            <H3>What Assentry does not do</H3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">
              <li>It never reads, fetches or touches your site&apos;s content — the agent does its own browsing.</li>
              <li>It never sees or stores passwords for your site.</li>
              <li>It doesn&apos;t perform the agent&apos;s task, or decide what an authorised agent may do on your site — your own code does.</li>
            </ul>
            <Note>
              There is no per-action permission scope today: a valid credential means &ldquo;this agent is
              acting for this person, with their consent.&rdquo; If some routes should only be reachable for
              certain people or actions, enforce that in your own application logic, exactly as you would
              for a logged-in human.
            </Note>
            <P>Every verification and profile request is recorded in the person&apos;s own Assentry audit log.</P>
          </div>

          {/* ---------------- Quickstart ---------------- */}
          <div className="mt-16">
            <H2 id="quickstart">Quickstart</H2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-300">
              <li>
                <Link href="/developers/signup" className="text-neutral-300 hover:text-neutral-200">
                  Create a developer account
                </Link>
                .
              </li>
              <li>
                In the{" "}
                <Link href="/developers/console" className="text-neutral-300 hover:text-neutral-200">
                  console
                </Link>
                , create an app and copy its API key. It&apos;s shown once — store it as a secret on your server.
              </li>
              <li>Install the SDK:</li>
            </ol>
            <CodeBlock code="npm install @assentry/sdk" label="Terminal" />
            <P>Set your key as an environment variable on your server (never in browser code):</P>
            <CodeBlock code={"ASSENTRY_API_KEY=assentry_your_key_here"} label=".env" />
            <P>Protect a route, and make the site discoverable:</P>
            <CodeBlock code={QUICKSTART_CODE} label="server.ts" />
            <Note>
              <C>baseUrl</C> defaults to <C>http://localhost:4000</C> (for running Assentry locally). In
              production always set it to <C>{BASE_URL}</C>.
            </Note>
            <P>That&apos;s it. A request without a credential now gets a standard challenge:</P>
            <CodeBlock
              label="Response with no credential"
              code={`HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="Assentry"
Link: </.well-known/assentry.json>; rel="assentry-agent-discovery"

{"error":"missing Assentry credential"}`}
            />
            <P>…and an agent presenting a valid credential gets through:</P>
            <CodeBlock code={`curl https://yoursite.com/account \\\n  -H "Authorization: Bearer <credential>"`} label="Terminal" />
          </div>

          {/* ---------------- SDK reference ---------------- */}
          <div className="mt-16">
            <H2 id="sdk-reference">SDK reference</H2>
            <P>
              <C>@assentry/sdk</C> is a server-side Node/TypeScript package. Express middleware is included;
              the <C>Assentry</C> client works with any framework.
            </P>

            <H3 id="sdk-assentry">new Assentry(options)</H3>
            <Signature>{"new Assentry({ apiKey: string, baseUrl?: string, partnerId?: string })"}</Signature>
            <Table
              head={["Option", "Description"]}
              rows={[
                [<C key="1">apiKey</C>, "Required. Your app's API key from the console. Server-side only."],
                [<C key="2">baseUrl</C>, <>Assentry&apos;s API origin. Defaults to <C>http://localhost:4000</C>; set <C>{BASE_URL}</C> in production.</>],
                [<C key="3">partnerId</C>, <>Your app&apos;s <b>Public ID</b> from the console. Only needed for <C>getAccountLinkUrl</C>.</>],
              ]}
            />

            <H3 id="sdk-verify">assentry.verify(credential)</H3>
            <Signature>{"verify(credential: string): Promise<VerifyResult>"}</Signature>
            <P>Checks a credential with Assentry. Always a live check — revocation takes effect immediately.</P>
            <CodeBlock
              label="VerifyResult"
              code={`type VerifyResult =
  | { valid: true; userId: string; agentId: string; expiresAt: string }
  | { valid: false; reason: DenialReason };`}
            />
            <P>
              Throws <C>AssentryRequestError</C> (status 401) if your API key is wrong or revoked.
            </P>

            <H3 id="sdk-getprofile">assentry.getProfile(credential, fields)</H3>
            <Signature>{"getProfile(credential: string, fields: string[]): Promise<ProfileResult>"}</Signature>
            <P>
              Returns the subset of <C>fields</C> the person consented to share for this grant (and has
              filled in). Fields they didn&apos;t consent to are simply omitted — not an error. The personal
              app currently offers <C>name</C>, <C>email</C>, <C>resume</C>, <C>phone</C> and <C>address</C>.
            </P>
            <CodeBlock
              label="ProfileResult"
              code={`type ProfileResult =
  | { valid: true; profile: Record<string, unknown> }
  | { valid: false; reason: DenialReason };`}
            />

            <H3 id="sdk-requiregrant">requireGrant(assentry, options?)</H3>
            <Signature>{"requireGrant(assentry: Assentry, options?: RequireGrantOptions): RequestHandler"}</Signature>
            <P>Express middleware that only lets requests with a valid credential through.</P>
            <Table
              head={["Outcome", "Response"]}
              rows={[
                ["No credential", <>401 <C>{'{"error":"missing Assentry credential"}'}</C> + <C>WWW-Authenticate: Bearer realm=&quot;Assentry&quot;</C></>],
                ["Credential not valid", <>403 <C>{'{"error":"not authorised","reason":"…"}'}</C></>],
                ["Valid", <>Calls <C>next()</C> with <C>req.assentryGrant</C> and <C>req.assentryCredential</C> set</>],
              ]}
            />
            <Table
              head={["Option", "Description"]}
              rows={[
                [<C key="1">credentialHeader</C>, <>Read the credential from a different header. Defaults to the standard <C>Authorization: Bearer</C> — only change this with good reason.</>],
                [<C key="2">discover</C>, <>A <C>DiscoverableRoute</C> — lists this route in your discovery document. Omit to keep it unlisted.</>],
              ]}
            />
            <CodeBlock
              label="Request properties"
              code={`interface AssentryRequest extends express.Request {
  assentryGrant?: { userId: string; agentId: string; expiresAt: string };
  assentryCredential?: string; // reuse for assentry.getProfile()
}`}
            />

            <H3 id="sdk-getcredential">getCredentialFromRequest(req, options?)</H3>
            <Signature>{"getCredentialFromRequest(req: Request, options?: { credentialHeader?: string }): string | null"}</Signature>
            <P>
              Reads a credential without rejecting the request — for pages that accept either a normal
              logged-in human <i>or</i> an agent:
            </P>
            <CodeBlock code={SESSION_OR_CREDENTIAL_CODE} label="server.ts" />

            <H3 id="sdk-discovery">assentryDiscovery(options)</H3>
            <Signature>{"assentryDiscovery({ partnerName: string }): RequestHandler"}</Signature>
            <P>
              Mount once, before your routes. See <a href="#discovery" className="text-neutral-300 hover:text-neutral-200">Agent discovery</a>.
            </P>

            <H3 id="sdk-declare">declareDiscoverableRoute(route)</H3>
            <Signature>{'declareDiscoverableRoute({ path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", description: string }): void'}</Signature>
            <P>
              Lists a route in your discovery document when it can&apos;t use <C>requireGrant</C>&apos;s{" "}
              <C>discover</C> option. Call it once at startup, next to the route.
            </P>

            <H3 id="sdk-linking">assentry.getAccountLinkUrl(params) · assentry.exchangeLinkCode(code)</H3>
            <Signature>{"getAccountLinkUrl({ redirectUri: string, state?: string }): string"}</Signature>
            <Signature>{"exchangeLinkCode(code: string): Promise<{ userId: string }>"}</Signature>
            <P>
              See <a href="#account-linking" className="text-neutral-300 hover:text-neutral-200">Account linking</a>.{" "}
              <C>getAccountLinkUrl</C> throws if the client was created without <C>partnerId</C>.
            </P>

            <H3 id="sdk-errors">AssentryRequestError</H3>
            <Signature>{"class AssentryRequestError extends Error { status: number }"}</Signature>
            <P>
              Thrown by the client when Assentry itself rejects the call — an invalid/revoked API key (401), a
              malformed request (400), or an invalid link code (400). A credential that simply isn&apos;t valid
              is <b>not</b> an exception: it&apos;s <C>{"{ valid: false, reason }"}</C>.
            </P>
          </div>

          {/* ---------------- Discovery ---------------- */}
          <div className="mt-16">
            <H2 id="discovery">Agent discovery</H2>
            <P>
              An agent told &ldquo;go check my account on acme.com&rdquo; can&apos;t know which of your routes accept a
              Assentry credential. Without help it finds only your human login page — and a well-behaved agent
              won&apos;t try to get past that. <C>assentryDiscovery</C> fixes this on every page of your site:
            </P>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                Every response — including 404s and redirects — carries{" "}
                <C>{'Link: </.well-known/assentry.json>; rel="assentry-agent-discovery"'}</C>, so an agent sees it
                wherever it lands first.
              </li>
              <li>
                <C>/.well-known/assentry.json</C> describes how to present a credential and lists every route
                declared with <C>discover</C> or <C>declareDiscoverableRoute</C>. There&apos;s no separate list to
                keep in sync.
              </li>
              <li>
                Routes protected by <C>requireGrant</C> answer a credential-less request with the standard{" "}
                <C>WWW-Authenticate: Bearer</C> challenge.
              </li>
            </ul>
            <CodeBlock code={DISCOVERY_DOC} label="GET /.well-known/assentry.json" />
          </div>

          {/* ---------------- Account linking ---------------- */}
          <div className="mt-16">
            <H2 id="account-linking">Account linking</H2>
            <P>
              If a person already had an account on your site before they used Assentry, a credential alone
              doesn&apos;t say <i>which</i> of your accounts is theirs. You have two options:
            </P>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                <b>Match it yourself</b> — use <C>getProfile</C> (e.g. their email) and your own logic to find or
                create the account. Simple, no extra step for the person. Note that Assentry doesn&apos;t verify emails
                yet, so treat this as an unverified claim.
              </li>
              <li>
                <b>Explicit linking</b> — a one-time confirmation by the person, while logged in to your site.
                Stronger assurance; after it, any credential for that Assentry user is proof of that specific account.
              </li>
            </ul>
            <H3>Setting up explicit linking</H3>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-slate-300">
              <li>
                In the console, add your callback URL under <b>Account-linking redirect URIs</b>. Assentry only ever
                redirects to an exact URI registered there.
              </li>
              <li>Pass your app&apos;s <b>Public ID</b> as <C>partnerId</C>.</li>
            </ol>
            <CodeBlock code={LINKING_CODE} label="server.ts" />
            <P>
              The code is single-use and expires after 60 seconds. If the person declines, your callback
              receives <C>?error=access_denied&amp;state=…</C> instead of a code.
            </P>
          </div>

          {/* ---------------- HTTP API ---------------- */}
          <div className="mt-16">
            <H2 id="http-api">HTTP API</H2>
            <P>
              Not using Node? The SDK is a thin wrapper over three JSON endpoints. Call them from your
              server — never from a browser — with your API key in the <C>x-assentry-api-key</C> header.
            </P>
            <CodeBlock code={BASE_URL} label="Base URL" />

            <H3 id="api-verify">POST /verify</H3>
            <CodeBlock
              label="Request"
              code={`curl -X POST ${BASE_URL}/verify \\
  -H "Content-Type: application/json" \\
  -H "x-assentry-api-key: $ASSENTRY_API_KEY" \\
  -d '{"credential":"<credential>"}'`}
            />
            <CodeBlock
              label="200 — valid"
              code={`{ "valid": true, "userId": "…", "agentId": "…", "expiresAt": "2026-11-04T09:00:00.000Z" }`}
            />
            <CodeBlock label="200 — not valid" code={`{ "valid": false, "reason": "revoked" }`} />

            <H3 id="api-profile">POST /profile</H3>
            <CodeBlock
              label="Request"
              code={`curl -X POST ${BASE_URL}/profile \\
  -H "Content-Type: application/json" \\
  -H "x-assentry-api-key: $ASSENTRY_API_KEY" \\
  -d '{"credential":"<credential>","fields":["name","email"]}'`}
            />
            <CodeBlock label="200 — valid" code={`{ "valid": true, "profile": { "name": "Ada Lovelace", "email": "ada@example.com" } }`} />
            <P>
              <C>fields</C> must contain at least one name. Unconsented fields are left out of <C>profile</C>.
              An invalid credential returns <C>{'{ "valid": false, "reason": … }'}</C> like <C>/verify</C>.
            </P>

            <H3 id="api-link-token">POST /link/token</H3>
            <CodeBlock
              label="Request"
              code={`curl -X POST ${BASE_URL}/link/token \\
  -H "Content-Type: application/json" \\
  -H "x-assentry-api-key: $ASSENTRY_API_KEY" \\
  -d '{"code":"<code from your callback>"}'`}
            />
            <CodeBlock label="200" code={`{ "userId": "…" }`} />
            <P>
              The link flow itself starts with a browser redirect (not an API call) to{" "}
              <C>{`${BASE_URL}/link/authorize?partner_id=<Public ID>&redirect_uri=<registered URI>&state=<anything>`}</C>.
            </P>

            <H3>Request errors (all endpoints)</H3>
            <Table
              head={["Status", "Body", "Meaning"]}
              rows={[
                ["401", <C key="1">{'{"error":"missing x-assentry-api-key header"}'}</C>, "No API key sent."],
                ["401", <C key="2">{'{"error":"invalid api key"}'}</C>, "Unknown, rotated-out or revoked key."],
                ["400", <C key="3">{'{"error":{ … }}'}</C>, "Malformed body on /verify or /profile (field-level details included)."],
                ["400", <C key="4">{'{"error":"invalid_request"}'}</C>, "/link/token: missing code."],
                ["400", <C key="5">{'{"error":"invalid_grant"}'}</C>, "/link/token: code unknown, already used, expired, or issued to another app."],
              ]}
            />
          </div>

          {/* ---------------- Errors ---------------- */}
          <div className="mt-16">
            <H2 id="errors">Errors & denial reasons</H2>
            <P>
              When a credential isn&apos;t accepted, <C>verify</C> and <C>getProfile</C> return{" "}
              <C>{"{ valid: false, reason }"}</C> with one of these <C>DenialReason</C> values:
            </P>
            <Table
              head={["reason", "Meaning", "What to do"]}
              rows={[
                [<C key="1">invalid_credential</C>, "Malformed, tampered with, or past its own expiry.", "Treat as unauthenticated. The agent should fetch a fresh credential."],
                [<C key="2">grant_not_found</C>, "The grant behind it no longer exists.", "Treat as unauthenticated."],
                [<C key="3">revoked</C>, "The person revoked this authorisation.", "Deny. Only the person can authorise again."],
                [<C key="4">agent_revoked</C>, "The person disconnected this agent entirely.", "Deny."],
                [<C key="5">expired</C>, "The grant's time window has ended.", "Deny. The person can issue a new grant."],
              ]}
            />
            <P>
              In every case, fall back to however your site normally treats an unauthenticated visitor.
            </P>
            <Note>
              Managing keys: if a key leaks, <b>rotate</b> it in the{" "}
              <Link href="/developers/console" className="underline">
                console
              </Link>{" "}
              — the old key stops working on the very next request. <b>Revoking</b> an app disables its key
              permanently.
            </Note>
          </div>
        </article>
      </div>
    </div>
  );
}
