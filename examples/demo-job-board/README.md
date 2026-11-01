# Demo job board

A minimal partner site integrating `@hapi-id/sdk`, used to exercise the SDK end-to-end and as a reference for design partners.

```bash
npm install
HAPI_API_KEY=<key from `npm run seed:partner`> HAPI_PARTNER_PUBLIC_ID=<printed by the same command> npm run dev   # http://localhost:4100
```

- `POST /apply` is gated by `requireGrant(hapi, "job_application:submit")` — present a credential (issued via the personal app or `POST /grants` on the backend) as `Authorization: Bearer <credential>` to simulate an authorised agent applying for a job. (Case 1 — a new flow built for agents.) **It also demonstrates implicit account matching**: it checks its own `accountsByEmail` map for the disclosed email, reporting `accountStatus: "created"` the first time and `"matched"` on any later call with the same email — entirely ordinary application logic, no second HAPI-mediated step. This is the primary intended way to handle case 2 (see STRATEGY.md); known caveat: HAPI doesn't verify email yet, so this means trusting an unverified claim for now.
- `GET /dashboard` demonstrates the same credential (same `Authorization: Bearer` convention, via the SDK's `getCredentialFromRequest`) working for an agent *alongside* an entirely separate, ordinary traditional login (`/signup` + `/login`, real bcrypt-hashed passwords) for a human. Neither path knows the other exists — that's the point: HAPI coexists with a site's existing login rather than replacing it.
- `GET /link/start?accountId=<anything>` simulates an already-logged-in user here clicking "Link your HAPI account" — `accountId` stands in for this site's own session, since there's no real login in this demo. Walks through HAPI's login/confirm pages and back to `/link/callback`, which exchanges the code and stores the mapping. Check it with `GET /link/status?accountId=<same value>`. (Case 2's *explicit*, stronger-assurance alternative — linking an existing account via a one-time human confirmation.)
