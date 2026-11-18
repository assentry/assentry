import Link from "next/link";
import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";
import { DevHeader } from "./DevHeader";
import { API_BASE_URL } from "../../lib/api";
import { DetailsTable } from "./DetailsTable";

const BASE_URL = API_BASE_URL;

export const DOC_SECTIONS = [
  { id: "overview", label: "Overview & concepts" },
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk-reference", label: "SDK reference" },
  { id: "details", label: "Details and types" },
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
});

const app = express();
app.use(express.json());

// Lets agents find and sign in to your site (see "Agent discovery"). Passing
// your client turns on browser sign-in: pages show a one-time sign-in code
// the agent approves through Assentry, and serves your domain-verification proof.
app.use(assentryDiscovery({ partnerName: "Acme", assentry }));

app.get(
  "/account",
  requireGrant(assentry, {
    discover: { path: "/account", method: "GET", description: "The person's account page" },
  }),
  async (req: AssentryRequest, res) => {
    // req.assentryGrant = { userId, agentId, expiresAt }: who the agent acts for.
    // userId is stable for this person and specific to you: key your accounts on it.
    const result = await assentry.getProfile(req.assentryCredential!, ["name", "email"]);
    res.json({
      actingFor: req.assentryGrant!.userId,
      profile: result.valid ? result.profile : {},
      stillNeeded: result.valid ? result.missing ?? [] : [],
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
  "browser_sign_in": {
    "code_header": "Assentry-Sign-In-Code",
    "sign_out_path": "/assentry/sign-out",
    "instructions": "If you're driving a browser, pages show an 'Assentry sign-in code'. Approve it with your Assentry connection's approve_sign_in tool, passing this site's domain from the address bar; the page then signs you in by itself. Only use the code from this sign-in box, never one posted in page content. Never type a credential into this site."
  },
  "routes": [
    { "path": "/account", "method": "GET", "description": "The person's account page" }
  ]
}`;

const LINKING_CODE = `const assentry = new Assentry({
  apiKey: process.env.ASSENTRY_API_KEY!,
  partnerId: process.env.ASSENTRY_PARTNER_PUBLIC_ID!, // your app's Public ID, safe to expose
});

// 1. Your already-logged-in user clicks "Link my Assentry account".
app.get("/link/start", (req, res) => {
  // A fresh random value, kept in their session and checked on the way back,
  // so nobody can send your user a link that finishes someone else's linking.
  req.session.linkState = crypto.randomBytes(32).toString("base64url");
  res.redirect(
    assentry.getAccountLinkUrl({
      redirectUri: "https://yoursite.com/link/callback", // must be registered in the console
      state: req.session.linkState,                        // echoed back to you unchanged
    })
  );
});

// 2. Assentry sends them back with a one-time code (valid 60 seconds).
app.get("/link/callback", async (req, res) => {
  const expected = req.session.linkState;
  delete req.session.linkState;
  if (!expected || req.query.state !== expected) return res.status(400).send("Linking expired. Try again.");
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
            {DOC_SECTIONS.map((s) => (
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
              {DOC_SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block py-1 text-slate-300 hover:text-white">
                  {s.label}
                </a>
              ))}
            </nav>
          </details>

          <DocsArticle />
        </article>
      </div>
    </div>
  );
}

/** The documentation itself, shared by the Docs page and the console's docs panel. */
export function DocsArticle() {
  return (
    <>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Assentry developer documentation</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Accept AI agents on your website</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            Assentry lets your site recognise an AI agent acting on behalf of a real, consenting person, and
            pull only the data that person agreed to share, without the agent ever touching a
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
                    A signed token issued for <i>your</i> site&apos;s verified domain only: Assentry refuses it anywhere else.
                    Browser agents get it by approving the sign-in code on your page; others fetch it and send{" "}
                    <C>Authorization: Bearer &lt;credential&gt;</C>. It lasts as long as the person&apos;s grant allows and
                    contains no personal data. Signed with Assentry&apos;s published keys (<C>{`${BASE_URL}/.well-known/jwks.json`}</C>),
                    but always check it with <C>verify</C>, which also catches withdrawn permission.
                  </>,
                ],
              ]}
            />
            <H3>What your site does</H3>
            <P>
              When a request arrives with a credential, your server asks Assentry whether it&apos;s valid
              (<C>verify</C>), every time, never trusting the token on its own. If it is, you know which
              person the agent represents, as an ID specific to you. If you need details like their name or email, you
              ask Assentry for them separately (<C>getProfile</C>), and you only get details you declared in the
              console <i>and</i> the person allowed.
            </P>
            <H3>What Assentry does not do</H3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">
              <li>It never reads, fetches or touches your site&apos;s content. The agent does its own browsing.</li>
              <li>It never sees or stores passwords for your site.</li>
              <li>It doesn&apos;t perform the agent&apos;s task, or decide what an authorised agent may do on your site. Your own code does.</li>
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
                , create an app with your site&apos;s exact domain (e.g. <C>shop.example.com</C>) and copy its API
                key. It&apos;s shown once: store it as a secret on your server.
              </li>
              <li>
                Under <b>Required data</b>, tick what your site needs and mark each detail required or optional.
              </li>
              <li>Install the SDK:</li>
            </ol>
            <CodeBlock code="npm install @assentry/sdk" label="Terminal" />
            <P>Set your key as an environment variable on your server (never in browser code):</P>
            <CodeBlock code={"ASSENTRY_API_KEY=assentry_your_key_here"} label=".env" />
            <P>Make the site discoverable, and protect a route:</P>
            <CodeBlock code={QUICKSTART_CODE} label="server.ts" />
            <ol start={5} className="mt-4 list-decimal space-y-3 pl-5 text-slate-300">
              <li>
                Deploy, then click <b>Verify domain</b> in the console. The SDK already serves the proof Assentry
                checks; until the domain is verified, agents can&apos;t sign in to your site.
              </li>
            </ol>
            <Note>
              The SDK talks to <C>https://api.assentry.io</C> by default. Only set <C>baseUrl</C> to point it at a
              local or test Assentry.
            </Note>
            <P>
              That&apos;s it. A browser agent sees a sign-in code at the bottom of your pages and approves it through
              its Assentry connection; the page then signs it in by itself. An agent calling your site directly gets
              a standard challenge:
            </P>
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
                [<C key="2">baseUrl</C>, <>Assentry&apos;s API origin. Defaults to <C>https://api.assentry.io</C>; only set it for a local or test Assentry.</>],
                [<C key="3">partnerId</C>, <>Your app&apos;s <b>Public ID</b> from the console. Only needed for <C>getAccountLinkUrl</C>.</>],
              ]}
            />

            <H3 id="sdk-verify">assentry.verify(credential)</H3>
            <Signature>{"verify(credential: string): Promise<VerifyResult>"}</Signature>
            <P>
              Checks a credential with Assentry. Always a live check, so withdrawn permission takes effect immediately. A
              credential issued for a different site is refused with <C>wrong_site</C>.
            </P>
            <P>
              <C>userId</C> and <C>agentId</C> are specific to your developer account: the same person always has the
              same <C>userId</C> across your apps, but every other developer sees a different one, so sites can&apos;t
              link a person between them. Key your accounts on <C>userId</C>.
            </P>
            <CodeBlock
              label="VerifyResult"
              code={`type VerifyResult =
  | { valid: true; userId: string; agentId: string; expiresAt: string }
  | { valid: false; reason: DenialReason };`}
            />
            <P>
              Never throws: if Assentry can&apos;t be reached or rejects your API key, it returns{" "}
              <C>{`{ valid: false, reason: "assentry_unavailable" }`}</C>.
            </P>

            <H3 id="sdk-getprofile">assentry.getProfile(credential, fields)</H3>
            <Signature>{"getProfile(credential: string, fields: string[]): Promise<ProfileResult>"}</Signature>
            <P>
              Returns the subset of <C>fields</C> that your app declared in the console <i>and</i> the person allowed for
              this grant (and has filled in). Anything else is simply omitted, not an error; fields your app didn&apos;t
              declare are listed in <C>undeclaredFields</C> so you can spot a missing declaration. Required details
              you declared but aren&apos;t getting are listed in <C>missing</C>: Assentry has asked the person for
              them. People declare these details themselves; Assentry checks the format, not the truth. Each value
              arrives in its type&apos;s format (see{" "}
              <a href="#details" className="text-neutral-300 underline hover:text-white">
                Details and types
              </a>
              ).
            </P>
            <CodeBlock
              label="ProfileResult"
              code={`type ProfileResult =
  | {
      valid: true;
      profile: Record<string, ProfileValue>;
      meta: Record<string, { source: "person" | "agent"; updatedAt: string; verified?: boolean }>;
      missing?: string[];
      undeclaredFields?: string[];
    }
  | { valid: false; reason: DenialReason };`}
            />

            <H3 id="sdk-downloadfile">assentry.downloadFile(file)</H3>
            <Signature>{"downloadFile(file: ProfileFile): Promise<{ bytes: Buffer; contentType: string; filename: string }>"}</Signature>
            <P>
              Downloads a file detail. A file arrives in <C>getProfile</C> as{" "}
              <C>{"{ filename, contentType, size, sha256, url, expiresAt }"}</C>; the <C>url</C> works once, within 5
              minutes, and only with your API key, so a leaked link is useless. Each download appears in the
              person&apos;s activity.
            </P>

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
                [<C key="1">credentialHeader</C>, <>Read the credential from a different header. Defaults to the standard <C>Authorization: Bearer</C>. Only change this with good reason.</>],
                [<C key="2">discover</C>, <>A <C>DiscoverableRoute</C> that lists this route in your discovery document. Omit to keep it unlisted.</>],
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
              Reads a credential without rejecting the request, for pages that accept either a normal
              logged-in human <i>or</i> an agent:
            </P>
            <CodeBlock code={SESSION_OR_CREDENTIAL_CODE} label="server.ts" />

            <H3 id="sdk-discovery">assentryDiscovery(options)</H3>
            <Signature>{"assentryDiscovery({ partnerName: string, assentry?: Assentry }): RequestHandler"}</Signature>
            <P>
              Mount once, before your routes. Always pass <C>assentry</C>: without it, only agents that send an{" "}
              <C>Authorization</C> header can get in, browser agents can&apos;t, and your domain can&apos;t be verified.
              See <a href="#discovery" className="text-neutral-300 hover:text-neutral-200">Agent discovery</a>.
            </P>
            <Table
              head={["With assentry, it also serves", "What for"]}
              rows={[
                [<C key="1">sign-in code on HTML pages</C>, "For visitors who aren't signed in: the code, in visible text, a meta tag and an Assentry-Sign-In-Code header."],
                [<C key="2">/assentry/sign-in/status</C>, "The page checks this every few seconds and moves on once the agent has approved the code."],
                [<C key="3">/assentry/sign-out</C>, "Ends the agent's browser session on your site."],
                [<C key="4">/.well-known/assentry-domain-verification</C>, "The proof Assentry fetches when you click Verify domain."],
              ]}
            />

            <H3 id="sdk-declare">declareDiscoverableRoute(route)</H3>
            <Signature>{'declareDiscoverableRoute({ path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", description: string }): void'}</Signature>
            <P>
              Lists a route in your discovery document when it can&apos;t use <C>requireGrant</C>&apos;s{" "}
              <C>discover</C> option. Call it once at startup, next to the route.
            </P>

            <H3 id="sdk-linking">assentry.getAccountLinkUrl(params) · assentry.exchangeLinkCode(code)</H3>
            <Signature>{"getAccountLinkUrl({ redirectUri: string, state: string }): string"}</Signature>
            <Signature>{"exchangeLinkCode(code: string): Promise<{ userId: string }>"}</Signature>
            <P>
              See <a href="#account-linking" className="text-neutral-300 hover:text-neutral-200">Account linking</a>.{" "}
              <C>getAccountLinkUrl</C> throws if the client was created without <C>partnerId</C>.
            </P>

            <H3 id="sdk-signin">Lower-level sign-in calls</H3>
            <Signature>{"startSignIn(): Promise<{ requestId: string; code: string; expiresAt: string }>"}</Signature>
            <Signature>{"collectSignIn(requestId: string): Promise<SignInCollectResult>"}</Signature>
            <Signature>{"getDomainVerificationToken(): Promise<string | null>"}</Signature>
            <P>
              What <C>assentryDiscovery</C> uses under the hood, for frameworks other than Express. Start a sign-in,
              show the code, and poll <C>collectSignIn</C>: once the agent approves it, you get the credential exactly
              once (<C>{'{ status: "approved", credential, userId, agentId, expiresAt }'}</C>); before that,{" "}
              <C>pending</C>; afterwards, <C>expired</C> or <C>already_collected</C>. The first time a person&apos;s
              agent signs in to your site, the person allows your site in the Assentry app: until then you get{" "}
              <C>{'{ status: "pending", waitingFor: "person", expiresAt }'}</C>, with a later <C>expiresAt</C>, so keep
              polling until then. If they decline, you get <C>{'{ status: "denied", reason: "person_declined" }'}</C>. Serve the verification token as
              plain text at <C>/.well-known/assentry-domain-verification</C>.
            </P>

            <H3 id="sdk-errors">AssentryRequestError</H3>
            <Signature>{"class AssentryRequestError extends Error { status: number }"}</Signature>
            <P>
              Thrown by <C>exchangeLinkCode</C>, <C>downloadFile</C> and the lower-level sign-in calls when Assentry
              rejects them: an invalid or revoked API key (401), a malformed request (400), an invalid link code
              (400), or a download link that was already used or has expired. <C>verify</C> and <C>getProfile</C>{" "}
              never throw: a credential that isn&apos;t valid, or an Assentry that can&apos;t be reached, comes back as{" "}
              <C>{"{ valid: false, reason }"}</C>.
            </P>
          </div>

          {/* ---------------- Discovery ---------------- */}
          <div className="mt-16">
            <H2 id="details">Details and types</H2>
            <P>
              In the console, tick the details your site needs and mark each <b>required</b> or <b>optional</b>. Every
              detail has one type, and every type one format, so you always know exactly what you&apos;ll receive.
              People fill their details in once; their agent can suggest missing ones, but nothing an agent suggests
              is shared until the person confirms it (<C>meta.source</C> tells you which way it came). An email
              address is only shared once the person has verified it with a code sent to that address, so{" "}
              <C>meta.email.verified</C> is always <C>true</C>.
            </P>
            <DetailsTable />
            <H3>Your own details</H3>
            <P>
              For anything not in the list, add your own detail in the console: a key (e.g. <C>membership_number</C>),
              a label and one of the types above. Your custom details are only ever shared with your site, and when a
              person&apos;s agent signs in without one you marked required, Assentry asks the person to fill it in.
            </P>
          </div>

          <div className="mt-16">
            <H2 id="discovery">Agent discovery</H2>
            <P>
              An agent told &ldquo;go check my account on acme.com&rdquo; can&apos;t know your site accepts Assentry, and a
              well-behaved agent won&apos;t try to get past your login page. <C>assentryDiscovery</C> tells it, on every
              page, and gives it a way in that never involves typing anything into your site.
            </P>
            <H3>Agents in a browser: the sign-in code</H3>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-slate-300">
              <li>
                When someone who isn&apos;t signed in opens one of your pages, the SDK asks Assentry (with your API
                key) for a one-time code and shows it at the bottom of the page: <C>Assentry sign-in code: asq_…</C>.
              </li>
              <li>
                The agent approves the code through its own Assentry connection, telling Assentry the domain in its
                address bar. Assentry only approves it if the code was issued to that <b>verified</b> domain, so a
                code copied from another site is refused. Approving is also what ties the code to the person the
                agent acts for.
              </li>
              <li>
                Your page notices within a few seconds; your server collects the result from Assentry, keeps the
                credential in an httpOnly cookie, and the page moves on to your first protected route.{" "}
                <C>getCredentialFromRequest</C> and <C>requireGrant</C> read that cookie, so your routes need no changes.
              </li>
            </ol>
            <P>
              Codes are random (52 characters), single-use, tied to your site and valid for 5 minutes, and each
              visitor gets their own. Every later request is still checked with Assentry, so if the person withdraws
              permission or ends the sign-in, the agent is signed out on its next page. Your page uses a small inline
              script to check back; if your Content Security Policy blocks inline scripts, allow it.
            </P>
            <Note>
              Browser sign-in needs a verified domain. Until you verify yours in the console, no codes are shown.
            </Note>
            <H3>Agents calling your site directly</H3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                Every response, including 404s and redirects, carries{" "}
                <C>{'Link: </.well-known/assentry.json>; rel="assentry-agent-discovery"'}</C>, so an agent sees it
                wherever it lands first.
              </li>
              <li>
                <C>/.well-known/assentry.json</C> explains both ways in and lists every route declared with{" "}
                <C>discover</C> or <C>declareDiscoverableRoute</C>. There&apos;s no separate list to keep in sync.
              </li>
              <li>
                The agent fetches a credential for your domain from Assentry and sends it as{" "}
                <C>Authorization: Bearer &lt;credential&gt;</C>. Routes protected by <C>requireGrant</C> answer a
                request without one with the standard <C>WWW-Authenticate: Bearer</C> challenge.
              </li>
            </ul>
            <CodeBlock code={DISCOVERY_DOC} label="GET /.well-known/assentry.json" />
          </div>

          {/* ---------------- Account linking ---------------- */}
          <div className="mt-16">
            <H2 id="account-linking">Account linking</H2>
            <H3>Recognising returning people</H3>
            <P>
              Key your accounts on the <C>userId</C> that <C>verify</C> returns. It&apos;s the same for a person every
              time, whichever agent they use and however many times they renew or change their permission. Don&apos;t
              key on email: people can change it or choose not to share it.
              Store the email or name alongside the account if the person shares them, but find the account by{" "}
              <C>userId</C>.
            </P>
            <H3>People who already had an account</H3>
            <P>
              If a person already had an account on your site before they used Assentry, a credential alone
              doesn&apos;t say <i>which</i> of your accounts is theirs. You have two options:
            </P>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                <b>Match it yourself</b>: on their first visit through Assentry, use <C>getProfile</C> (e.g. their
                email) and your own logic to find the existing account, then save the <C>userId</C> on it so later
                visits are found by ID. Simple, no extra step for the person. Only match automatically on details you
                would trust from your own sign-up form; otherwise use explicit linking.
              </li>
              <li>
                <b>Explicit linking</b>: a one-time confirmation by the person, while logged in to your site.
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
              Not using Node? The SDK is a thin wrapper over these JSON endpoints. Call them from your server, never
              from a browser, with your API key in the <C>x-assentry-api-key</C> header (except the two public ones at
              the end).
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
              label="200, valid"
              code={`{ "valid": true, "userId": "usr_…", "agentId": "agt_…", "expiresAt": "2026-11-04T09:00:00.000Z" }`}
            />
            <CodeBlock label="200, not valid" code={`{ "valid": false, "reason": "revoked" }`} />

            <H3 id="api-profile">POST /profile</H3>
            <CodeBlock
              label="Request"
              code={`curl -X POST ${BASE_URL}/profile \\
  -H "Content-Type: application/json" \\
  -H "x-assentry-api-key: $ASSENTRY_API_KEY" \\
  -d '{"credential":"<credential>","fields":["name","email"]}'`}
            />
            <CodeBlock
              label="200, valid"
              code={`{
  "valid": true,
  "profile": { "name": "Ada Lovelace", "email": "ada@example.com" },
  "meta": {
    "name": { "source": "person", "updatedAt": "2026-11-06T09:00:00.000Z" },
    "email": { "source": "agent", "updatedAt": "2026-11-06T09:05:00.000Z", "verified": true }
  },
  "missing": ["phone_number"]
}`}
            />
            <P>
              <C>fields</C> must contain at least one key. You only get keys you declared under Required data that the
              person allowed and has filled in; others are left out. <C>missing</C> lists required keys you aren&apos;t
              getting (Assentry has asked the person), <C>undeclaredFields</C> any you asked for but didn&apos;t declare.
              File details come as <C>{"{ filename, contentType, size, sha256, url, expiresAt }"}</C>. An invalid
              credential returns <C>{'{ "valid": false, "reason": … }'}</C> like <C>/verify</C>.
            </P>

            <H3 id="api-files">GET /files/download/:token</H3>
            <P>
              The <C>url</C> of a file detail. Send your API key; the link works once, within 5 minutes, and returns
              the file as a download (<C>Content-Disposition: attachment</C>). 401 without your key, 404 once used or
              expired.
            </P>

            <H3 id="api-sign-in">POST /sign-in-requests · POST /sign-in-requests/collect</H3>
            <CodeBlock
              label="Start a browser sign-in"
              code={`curl -X POST ${BASE_URL}/sign-in-requests -H "x-assentry-api-key: $ASSENTRY_API_KEY"
# 201 { "requestId": "…", "code": "asq_…", "expiresAt": "…" }
# 403 if your app's domain isn't verified yet`}
            />
            <CodeBlock
              label="Collect it"
              code={`curl -X POST ${BASE_URL}/sign-in-requests/collect \
  -H "Content-Type: application/json" -H "x-assentry-api-key: $ASSENTRY_API_KEY" \
  -d '{"requestId":"…"}'
# { "status": "pending", "expiresAt": "…" }   until the agent approves the code
# { "status": "pending", "waitingFor": "person", "expiresAt": "…" }   first sign-in: the person is allowing your site
# { "status": "approved", "credential": "…", "userId": "usr_…", "agentId": "agt_…", "expiresAt": "…" }   once
# { "status": "denied", "reason": "person_declined" | "grant_revoked" | "grant_expired" | "agent_revoked" }
# { "status": "expired" | "already_collected" | "not_found" }`}
            />

            <H3 id="api-domain">GET /domain-verification</H3>
            <P>
              Returns <C>{'{ "domain": "…", "token": "…" }'}</C>: serve <C>token</C> as plain text at{" "}
              <C>https://your-domain/.well-known/assentry-domain-verification</C>, then click Verify domain.
            </P>

            <H3 id="api-public">Public: GET /fields · GET /.well-known/jwks.json</H3>
            <P>
              <C>/fields</C> lists the standard details with their types and formats (the table in Details and
              types). <C>/.well-known/jwks.json</C> publishes the public keys credentials are signed with (ES256),
              in case you want to check a signature yourself; still call <C>/verify</C>, which also catches withdrawn
              permission.
            </P>

            <H3 id="api-link-token">POST /link/token</H3>
            <CodeBlock
              label="Request"
              code={`curl -X POST ${BASE_URL}/link/token \\
  -H "Content-Type: application/json" \\
  -H "x-assentry-api-key: $ASSENTRY_API_KEY" \\
  -d '{"code":"<code from your callback>"}'`}
            />
            <CodeBlock label="200" code={`{ "userId": "usr_…" }`} />
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
                ["403", <C key="6">{"{\"error\":\"this app's domain isn't verified yet…\"}"}</C>, "/sign-in-requests: verify your domain in the console first."],
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
                [<C key="6">wrong_site</C>, "The credential was issued for a different site, or your app's domain isn't verified.", "Deny. The agent needs a credential for your site."],
                [<C key="7">sign_in_ended</C>, "The person ended this sign-in from their Sign-ins screen.", "Deny. The agent can sign in again if its permission still holds."],
                [<C key="9">site_not_allowed</C>, "The person removed your site from their allowed sites.", "Deny. If an agent signs in again, the person is asked again."],
                [<C key="8">assentry_unavailable</C>, "Assentry couldn't be reached, or rejected your API key (SDK only).", "Deny for now and check your API key."],
              ]}
            />
            <P>
              In every case, fall back to however your site normally treats an unauthenticated visitor.
            </P>
            <Note>
              Managing keys: if a key leaks, <b>rotate</b> it in the{" "}
              <Link href="/developers/console" className="underline">
                console
              </Link>
              . The old key stops working on the very next request. <b>Revoking</b> an app disables its key
              permanently.
            </Note>
          </div>
    </>
  );
}
