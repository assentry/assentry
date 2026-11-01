import { HAPI, HAPIRequest, HAPIRequestError, requireGrant } from "@hapi-id/sdk";
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
