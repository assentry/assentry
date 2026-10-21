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

See `../examples/demo-job-board` for a complete runnable partner site built against this SDK.
