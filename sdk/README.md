# @hapi-id/sdk

Server-side SDK for partner sites that accept authorised HAPI agent traffic. Wraps the `/verify` and `/profile` handshake described in the root `README.md` — install this instead of calling the raw API yourself.

Not published to a registry yet; install locally during development:

```bash
npm install file:../path/to/hapi/sdk
```

## Usage

```ts
import { HAPI, requireGrant, HAPIRequest } from "@hapi-id/sdk";
import express from "express";

const hapi = new HAPI({ apiKey: process.env.HAPI_API_KEY! });

const app = express();
app.use(express.json());

app.post("/apply", requireGrant(hapi, "job_application:submit"), async (req: HAPIRequest, res) => {
  const profile = await hapi.getProfile(req.hapiCredential!, ["name", "email", "resume"]);
  if (!profile.valid) return res.status(403).json({ error: profile.reason });

  // req.hapiGrant has { userId, agentId, scope, expiresAt }; profile.profile
  // has only the fields the user actually consented to disclose for this grant.
  res.json({ status: "submitted", applicant: profile.profile });
});
```

If you'd rather not use the Express middleware, call `hapi.verify(credential, action)` and `hapi.getProfile(credential, fields)` directly — `requireGrant` is a thin convenience wrapper over both.

## Linking an existing account

`verify`/`getProfile` cover agents acting on *new* flows your site builds for them. If a user already has an account with you from before they connected HAPI, a credential alone doesn't tell you which of your accounts it belongs to — you need a one-time confirmation first:

```ts
const hapi = new HAPI({
  apiKey: process.env.HAPI_API_KEY!,
  partnerId: process.env.HAPI_PARTNER_PUBLIC_ID!, // safe to expose, unlike the API key
});

// 1. An already-logged-in user on your site clicks "Link your HAPI account"
app.get("/link/start", (req, res) => {
  res.redirect(hapi.getAccountLinkUrl({ redirectUri: "https://yoursite.com/link/callback" }));
});

// 2. HAPI sends them back here after they log in and confirm
app.get("/link/callback", async (req, res) => {
  const { userId } = await hapi.exchangeLinkCode(String(req.query.code));
  // store userId against the current user's existing account record
  res.send("Linked!");
});
```

After that, any credential that resolves to that `userId` is proof of *this specific* existing account — still no password at any point. See `../examples/demo-job-board`'s `/link/*` routes for a complete runnable version, and `scripts/test-account-link.mjs` in the repo root for an end-to-end test of the whole flow.

See `../examples/demo-job-board` for a complete runnable partner site built against this SDK.
