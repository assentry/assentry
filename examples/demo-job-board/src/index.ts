import { HAPI, HAPIRequest, requireGrant } from "@hapi-id/sdk";
import express from "express";

const hapi = new HAPI({
  apiKey: process.env.HAPI_API_KEY ?? "",
  baseUrl: process.env.HAPI_BASE_URL ?? "http://localhost:4000",
});

const app = express();
app.use(express.json());

// This is the only HAPI-specific code a partner site needs: gate the route,
// then use whatever the grant proves to decide what to skip (here, there's
// no separate signup/OTP step at all for an authorised agent).
app.post("/apply", requireGrant(hapi, "job_application:submit"), async (req: HAPIRequest, res) => {
  const profile = await hapi.getProfile(req.hapiCredential!, ["name", "email", "resume"]);
  if (!profile.valid) {
    return res.status(403).json({ error: "could not read applicant profile", reason: profile.reason });
  }

  res.json({
    status: "submitted",
    applicant: profile.profile,
    authorisedUntil: req.hapiGrant!.expiresAt,
  });
});

const port = Number(process.env.PORT) || 4100;
app.listen(port, () => {
  console.log(`Demo job board listening on http://localhost:${port}`);
});
