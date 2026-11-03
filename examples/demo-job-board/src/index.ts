import { declareDiscoverableRoute, getCredentialFromRequest, HAPI, HAPIRequestError, hapiDiscovery } from "@hapi-id/sdk";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import express from "express";

const hapi = new HAPI({
  apiKey: process.env.HAPI_API_KEY ?? "",
  baseUrl: process.env.HAPI_BASE_URL ?? "http://localhost:4000",
  partnerId: process.env.HAPI_PARTNER_PUBLIC_ID,
});

// RENDER_EXTERNAL_URL is injected automatically by Render into every web
// service — no manual config needed in production.
const publicBaseUrl =
  process.env.RENDER_EXTERNAL_URL ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4100}`;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Makes this site discoverable to an agent the moment it reaches *any* page
// here — not just /login — so a generic instruction doesn't dead-end at the
// human login wall with no way through. See @hapi-id/sdk's README for what
// this adds to every response. No routes list to pass in here — each
// protected route declares itself where it's actually defined, below.
app.use(hapiDiscovery({ partnerName: "Demo Job Board" }));

// Stands in for this site's own user database. Keyed by the site's own
// account id, holding whatever HAPI userId has been linked to it (case 2 —
// see STRATEGY.md). A real site would have a column on its existing users
// table; this is an in-memory map purely so the demo has somewhere to put
// the result of exchangeLinkCode.
const accountLinks = new Map<string, { hapiUserId: string }>();

// A second, separate in-memory "database" for the *other* way of handling
// case 2 — no HAPI-hosted confirmation screen at all. The site decides for
// itself, using only data the /verify + /profile handshake already
// discloses, whether this is an existing account or a new one. This is the
// primary intended path per STRATEGY.md; explicit linking above is the
// stronger-assurance alternative, not a replacement for this.
//
// Known gap, accepted for this prototype: HAPI does not currently verify a
// user's email, so matching on it here means trusting an unverified claim.
// A real deployment needs HAPI to expose which fields are actually verified
// before a partner should treat a match as authoritative.
const accountsByEmail = new Map<string, { hapiUserId: string; createdAt: Date }>();

// This site's own, completely ordinary account database — traditional
// email/password, nothing HAPI-aware about it at all. A real account must
// exist (via /signup) before /login will accept it, same as any real site —
// this used to fake-accept any email, which didn't represent reality.
const traditionalAccounts = new Map<string, { passwordHash: string }>();

function matchOrCreateAccount(email: string | undefined, hapiUserId: string): "matched" | "created" | "unknown" {
  if (!email) return "unknown";
  if (accountsByEmail.has(email)) return "matched";
  accountsByEmail.set(email, { hapiUserId, createdAt: new Date() });
  return "created";
}

function authPage(opts: { title: string; action: string; cta: string; footer: string; error?: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Demo Job Board — ${opts.title}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:360px;margin:80px auto;padding:0 16px}
input{width:100%;padding:8px;margin-top:4px;box-sizing:border-box}
label{display:block;margin-top:12px;font-size:0.85rem;color:#475569}
button{margin-top:16px;padding:8px 16px}
.error{color:#dc2626;font-size:0.85rem;margin-top:8px}
.footer{margin-top:16px;font-size:0.85rem}</style></head>
<body>
  <h2>Demo Job Board</h2>
  <p>${opts.title === "log in" ? "Sign in to your account." : "Create an account."}</p>
  <form method="post" action="${opts.action}">
    <label>Email</label>
    <input name="email" type="email" required>
    <label>Password</label>
    <input name="password" type="password" required minlength="8">
    <button type="submit">${opts.cta}</button>
  </form>
  ${opts.error ? `<p class="error">${opts.error}</p>` : ""}
  <p class="footer">${opts.footer}</p>
</body></html>`;
}

// This site's own, completely ordinary account system — exactly what it
// would look like with no HAPI integration at all. A human (not an agent)
// uses this. An account must actually exist (created here) before /login
// will accept it, and the password must actually match — no fake-accepting
// any email, which doesn't represent how a real site behaves.
app.get("/signup", (_req, res) => {
  res.send(authPage({
    title: "sign up",
    action: "/signup",
    cta: "Create account",
    footer: `Already have an account? <a href="/login">Log in</a>`,
  }));
});

app.post("/signup", async (req, res) => {
  const email = String(req.body.email ?? "");
  const password = String(req.body.password ?? "");
  if (!email || !password) return res.status(400).send("missing email or password");
  if (traditionalAccounts.has(email)) {
    return res.status(409).send(
      authPage({
        title: "sign up",
        action: "/signup",
        cta: "Create account",
        footer: `Already have an account? <a href="/login">Log in</a>`,
        error: "An account with that email already exists.",
      })
    );
  }

  traditionalAccounts.set(email, { passwordHash: await bcrypt.hash(password, 12) });
  res.cookie("session_email", email, { httpOnly: true, sameSite: "lax" });
  res.redirect("/dashboard");
});

app.get("/login", (_req, res) => {
  res.send(authPage({
    title: "log in",
    action: "/login",
    cta: "Log in",
    footer: `Don't have an account? <a href="/signup">Sign up</a>`,
  }));
});

app.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "");
  const password = String(req.body.password ?? "");
  const account = traditionalAccounts.get(email);

  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    return res.status(401).send(
      authPage({
        title: "log in",
        action: "/login",
        cta: "Log in",
        footer: `Don't have an account? <a href="/signup">Sign up</a>`,
        error: "Incorrect email or password.",
      })
    );
  }

  res.cookie("session_email", email, { httpOnly: true, sameSite: "lax" });
  res.redirect("/dashboard");
});

// Protected content, reachable two completely independent ways: a human
// who logged in the ordinary way (session cookie), or an agent presenting
// a HAPI credential (the standard Authorization: Bearer header — no
// site-specific convention to guess). Neither path knows or cares that the
// other exists; that's the point of HAPI coexisting with a site's existing
// login rather than replacing it. Declared here, not via requireGrant's
// `discover` option, since this route can't use requireGrant directly —
// it has to accept a session as an alternative to a credential.
declareDiscoverableRoute({
  path: "/dashboard",
  method: "GET",
  description: "View the content behind this site's login, authorised via your HAPI credential",
});

app.get("/dashboard", async (req, res) => {
  const sessionEmail = req.cookies?.session_email as string | undefined;
  if (sessionEmail && traditionalAccounts.has(sessionEmail)) {
    return res.send(renderDashboard({ name: sessionEmail, accountStatus: null, via: "your account login" }));
  }

  const credential = getCredentialFromRequest(req);
  if (!credential) return res.redirect("/login");

  const verification = await hapi.verify(credential);
  if (!verification.valid) {
    return res.status(403).send(`Access denied: ${verification.reason}. <a href="/login">Back to login</a>`);
  }

  const profile = await hapi.getProfile(credential, ["name", "email"]);
  const name = profile.valid ? (profile.profile.name as string | undefined) : undefined;
  const email = profile.valid ? (profile.profile.email as string | undefined) : undefined;
  const accountStatus = matchOrCreateAccount(email, verification.userId);

  res.send(renderDashboard({ name, accountStatus, via: "an authorised HAPI agent" }));
});

// A fresh code every single visit — not cached, not session-sticky — so
// it's obvious (to a human or an agent reporting back what it saw) that
// this content is actually being read live each time, not reused.
function randomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function renderDashboard(params: {
  name: string | undefined;
  accountStatus: "matched" | "created" | "unknown" | null;
  via: string;
}): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Dashboard</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px}
.secret{background:#f1f5f9;border-radius:8px;padding:16px;margin-top:16px}</style></head>
<body>
  <h2>Welcome${params.name ? `, ${params.name}` : ""}.</h2>
  <p>You got here via <strong>${params.via}</strong>.</p>
  ${params.accountStatus ? `<p>Account on this site: <strong>${params.accountStatus}</strong></p>` : ""}
  <div class="secret">🔒 Secret content only visible after login: the janitor's closet code is ${randomCode()}.</div>
</body></html>`;
}

// Case 2 demo: an already-logged-in user on this site clicks "Link your
// HAPI account." `accountId` stands in for this site's own session —
// there's no real login here, just a query param, since the point is to
// prove the HAPI side of the handshake, not build a second auth system.
app.get("/link/start", (req, res) => {
  const accountId = String(req.query.accountId ?? "");
  if (!accountId) return res.status(400).send("missing accountId");

  const url = hapi.getAccountLinkUrl({
    redirectUri: `${publicBaseUrl}/link/callback`,
    state: accountId,
  });
  res.redirect(url);
});

app.get("/link/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const accountId = String(req.query.state ?? "");
  if (!code || !accountId) return res.status(400).send("missing code or state");

  let userId: string;
  try {
    ({ userId } = await hapi.exchangeLinkCode(code));
  } catch (err) {
    const message = err instanceof HAPIRequestError ? err.message : "link exchange failed";
    return res.status(400).send(`Could not link this account: ${message}`);
  }
  accountLinks.set(accountId, { hapiUserId: userId });

  res.send(
    `Linked! Account "${accountId}" on this site now maps to HAPI user ${userId}. ` +
      `Future credentials resolving to that user will be treated as this account — no password involved.`
  );
});

app.get("/link/status", (req, res) => {
  const accountId = String(req.query.accountId ?? "");
  res.json({ accountId, link: accountLinks.get(accountId) ?? null });
});

const port = Number(process.env.PORT) || 4100;
app.listen(port, () => {
  console.log(`Demo job board listening on http://localhost:${port}`);
});
