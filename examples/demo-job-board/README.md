# Demo job board

A minimal partner site integrating `@hapi-id/sdk`, used to exercise the SDK end-to-end and as a reference for design partners.

```bash
npm install
HAPI_API_KEY=<key from `npm run seed:partner`> HAPI_PARTNER_PUBLIC_ID=<printed by the same command> npm run dev   # http://localhost:4100
```

- `POST /apply` is gated by `requireGrant(hapi, "job_application:submit")` — present a credential (issued via the personal app or `POST /grants` on the backend) in the `x-hapi-grant` header to simulate an authorised agent applying for a job. (Case 1 — a new flow built for agents.)
- `GET /link/start?accountId=<anything>` simulates an already-logged-in user here clicking "Link your HAPI account" — `accountId` stands in for this site's own session, since there's no real login in this demo. Walks through HAPI's login/confirm pages and back to `/link/callback`, which exchanges the code and stores the mapping. Check it with `GET /link/status?accountId=<same value>`. (Case 2 — linking an existing account.)
