# Demo site

A minimal partner site integrating `@assentry/sdk`, used to exercise the SDK end-to-end and as a reference for design partners.

```bash
npm install
ASSENTRY_API_KEY=<key from `npm run seed:partner`> ASSENTRY_PARTNER_PUBLIC_ID=<printed by the same command> npm run dev   # http://localhost:4100
```

- `GET /dashboard` is the protected page. An agent reaches it by presenting a credential (issued through the personal app) as `Authorization: Bearer <credential>`. It's listed in the site's discovery document at `/.well-known/assentry.json`, so an agent can find it without being told the URL. **It also demonstrates implicit account matching**: it checks its own `accountsByEmail` map for the disclosed email, reporting `created` the first time and `matched` on any later visit with the same email. That's ordinary application logic, with no second Assentry-mediated step, and it's the primary intended way to handle existing accounts (see STRATEGY.md). Known caveat: Assentry doesn't verify email yet, so this means trusting an unverified claim for now.
- The same `/dashboard` page shows the credential (same `Authorization: Bearer` convention, via the SDK's `getCredentialFromRequest`) working for an agent *alongside* an entirely separate, ordinary traditional login (`/signup` + `/login`, real bcrypt-hashed passwords) for a human. Neither path knows the other exists — that's the point: Assentry coexists with a site's existing login rather than replacing it.
- `GET /link/start?accountId=<anything>` simulates an already-logged-in user here clicking "Link your Assentry account" — `accountId` stands in for this site's own session, since there's no real login in this demo. Walks through Assentry's login/confirm pages and back to `/link/callback`, which exchanges the code and stores the mapping. Check it with `GET /link/status?accountId=<same value>`. (Case 2's *explicit*, stronger-assurance alternative — linking an existing account via a one-time human confirmation.)
