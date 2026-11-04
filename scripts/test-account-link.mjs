// Drives case 2 end-to-end exactly as a real browser would: the partner
// site (demo-job-board) sends an "already logged in" user to Assentry, the user
// logs into Assentry and confirms, Assentry redirects back with a code, and the
// partner's own backend exchanges that code (server-to-server, with its own
// API key) for the Assentry userId to store against its existing account.
const JOB_BOARD = "http://localhost:4100";
const DEMO_ACCOUNT_ID = "acme-user-1";

async function main() {
  console.log("== 1. partner site sends its logged-in user to Assentry ==");
  const start = await fetch(`${JOB_BOARD}/link/start?accountId=${DEMO_ACCOUNT_ID}`, { redirect: "manual" });
  const authorizeUrl = start.headers.get("location");
  if (!authorizeUrl) throw new Error("expected a redirect to Assentry's /link/authorize");
  console.log("redirected to:", authorizeUrl);

  console.log("\n== 2. GET /link/authorize (no session) — should render a login form ==");
  const firstVisit = await fetch(authorizeUrl, { redirect: "manual" });
  const loginHtml = await firstVisit.text();
  if (!firstVisit.ok || !loginHtml.includes("Log in to Assentry")) {
    throw new Error(`expected a login form, got: ${loginHtml.slice(0, 200)}`);
  }

  console.log("\n== 3. log in (the only thing the human types) ==");
  const parsedAuthorizeUrl = new URL(authorizeUrl);
  const loginRes = await fetch(`${parsedAuthorizeUrl.origin}/link/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: "jane@example.com",
      password: "password123",
      partner_id: parsedAuthorizeUrl.searchParams.get("partner_id"),
      redirect_uri: parsedAuthorizeUrl.searchParams.get("redirect_uri"),
      state: parsedAuthorizeUrl.searchParams.get("state"),
    }),
  });
  const sessionCookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  if (!sessionCookie) throw new Error("login did not set a session cookie");
  const postLoginLocation = loginRes.headers.get("location");

  console.log("\n== 4. follow that redirect — should render the confirm screen ==");
  const confirmPage = await fetch(`${parsedAuthorizeUrl.origin}${postLoginLocation}`, {
    redirect: "manual",
    headers: { Cookie: sessionCookie },
  });
  const confirmHtml = await confirmPage.text();
  if (!confirmPage.ok || !confirmHtml.includes("Confirm your identity")) {
    throw new Error(`expected the confirm screen, got: ${confirmHtml.slice(0, 200)}`);
  }

  console.log("\n== 5. approve ==");
  const confirmRes = await fetch(`${parsedAuthorizeUrl.origin}/link/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({
      decision: "approve",
      partner_id: parsedAuthorizeUrl.searchParams.get("partner_id"),
      redirect_uri: parsedAuthorizeUrl.searchParams.get("redirect_uri"),
      state: parsedAuthorizeUrl.searchParams.get("state"),
    }),
  });
  const callbackUrl = confirmRes.headers.get("location");
  if (!callbackUrl) throw new Error("confirm did not redirect back to the partner");
  console.log("redirected back to partner:", callbackUrl);

  console.log("\n== 6. partner's callback exchanges the code server-to-server ==");
  const callbackRes = await fetch(callbackUrl);
  console.log(await callbackRes.text());

  console.log("\n== 7. confirm the link actually stuck ==");
  const status = await fetch(`${JOB_BOARD}/link/status?accountId=${DEMO_ACCOUNT_ID}`).then((r) => r.json());
  console.log(status);

  console.log("\n== 8. a stale/reused code must fail ==");
  const replay = await fetch(callbackUrl);
  console.log(replay.status, await replay.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
