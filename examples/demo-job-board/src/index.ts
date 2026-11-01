import { HAPI, HAPIRequest, HAPIRequestError, requireGrant } from "@hapi-id/sdk";
import cookieParser from "cookie-parser";
import express from "express";

const hapi = new HAPI({
  apiKey: process.env.HAPI_API_KEY ?? "",
  baseUrl: process.env.HAPI_BASE_URL ?? "http://localhost:4000",
  partnerId: process.env.HAPI_PARTNER_PUBLIC_ID,
});

const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4100}`;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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
// email/password, nothing HAPI-aware about it at all. Fake-validated for
// this demo (any password is accepted) since the point is to show HAPI
// coexisting with a normal login, not to build a real auth system twice.
const traditionalAccounts = new Set<string>();

function matchOrCreateAccount(email: string | undefined, hapiUserId: string): "matched" | "created" | "unknown" {
  if (!email) return "unknown";
  if (accountsByEmail.has(email)) return "matched";
  accountsByEmail.set(email, { hapiUserId, createdAt: new Date() });
  return "created";
}

// This is the only HAPI-specific code a partner site needs: gate the route,
// then use whatever the grant proves to decide what to skip (here, there's
// no separate signup/OTP step at all for an authorised agent). Account
// matching/creation below is ordinary application logic, not anything HAPI
// mediates — HAPI's job stopped the moment requireGrant and getProfile
// returned.
app.post("/apply", requireGrant(hapi, "job_application:submit"), async (req: HAPIRequest, res) => {
  const profile = await hapi.getProfile(req.hapiCredential!, ["name", "email", "resume"]);
  if (!profile.valid) {
    return res.status(403).json({ error: "could not read applicant profile", reason: profile.reason });
  }

  const accountStatus = matchOrCreateAccount(profile.profile.email as string | undefined, req.hapiGrant!.userId);

  res.json({
    status: "submitted",
    accountStatus,
    applicant: profile.profile,
    authorisedUntil: req.hapiGrant!.expiresAt,
  });
});

// This site's own, completely ordinary login — exactly what it would look
// like with no HAPI integration at all. A human (not an agent) uses this.
// Fake-validated for the demo: any email/password combination works, since
// there's no real account system here — the point is to show this
// coexisting unchanged alongside the HAPI path below, not to build a second
// real auth system.
app.get("/login", (_req, res) => {
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Demo Job Board — log in</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:360px;margin:80px auto;padding:0 16px}
input{width:100%;padding:8px;margin-top:4px;box-sizing:border-box}
label{display:block;margin-top:12px;font-size:0.85rem;color:#475569}
button{margin-top:16px;padding:8px 16px}</style></head>
<body>
  <h2>Demo Job Board</h2>
  <p>Sign in to your account.</p>
  <form method="post" action="/login">
    <label>Email</label>
    <input name="email" type="email" required>
    <label>Password</label>
    <input name="password" type="password" required>
    <button type="submit">Log in</button>
  </form>
</body></html>`);
});

app.post("/login", (req, res) => {
  const email = String(req.body.email ?? "");
  if (!email) return res.status(400).send("missing email");
  traditionalAccounts.add(email);
  res.cookie("session_email", email, { httpOnly: true, sameSite: "lax" });
  res.redirect("/dashboard");
});

// Protected content, reachable two completely independent ways: a human
// who logged in the ordinary way (session cookie), or an agent presenting
// a HAPI credential (query param — no session, no password, re-verified
// live on every visit). Neither path knows or cares that the other exists;
// that's the point of HAPI coexisting with a site's existing login rather
// than replacing it.
app.get("/dashboard", async (req, res) => {
  const sessionEmail = req.cookies?.session_email as string | undefined;
  if (sessionEmail && traditionalAccounts.has(sessionEmail)) {
    return res.send(renderDashboard({ name: sessionEmail, accountStatus: null, via: "your account login" }));
  }

  const credential = String(req.query.credential ?? "");
  if (!credential) return res.redirect("/login");

  const verification = await hapi.verify(credential, "job_application:submit");
  if (!verification.valid) {
    return res.status(403).send(`Access denied: ${verification.reason}. <a href="/login">Back to login</a>`);
  }

  const profile = await hapi.getProfile(credential, ["name", "email"]);
  const name = profile.valid ? (profile.profile.name as string | undefined) : undefined;
  const email = profile.valid ? (profile.profile.email as string | undefined) : undefined;
  const accountStatus = matchOrCreateAccount(email, verification.userId);

  res.send(renderDashboard({ name, accountStatus, via: "an authorised HAPI agent" }));
});

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
  <div class="secret">🔒 Secret content only visible after login: the janitor's closet code is 4821.</div>
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
