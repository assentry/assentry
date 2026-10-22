// Simulates what a real MCP client (Claude, etc.) does end-to-end: dynamic
// client registration, the OAuth authorization-code+PKCE dance (including
// the login/consent HTML pages a human would actually see and submit), a
// token exchange, then real MCP tool calls over the remote HTTP transport.
// No secrets are ever typed by a human in this flow — only email+password,
// same as any normal login.
import crypto from "crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = "http://localhost:4000";
const REDIRECT_URI = "http://localhost:9999/callback";

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function main() {
  console.log("== 1. dynamic client registration ==");
  const regRes = await fetch(`${BASE}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIRECT_URI], client_name: "Test MCP Client" }),
  });
  const { client_id } = await regRes.json();
  console.log("client_id:", client_id);

  const { verifier, challenge } = pkcePair();
  const state = crypto.randomBytes(8).toString("hex");
  const oauthParams = new URLSearchParams({
    client_id,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  console.log("\n== 2. log in (this is the only thing the person types) ==");
  const loginRes = await fetch(`${BASE}/oauth/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: "jane@example.com",
      password: "password123",
      ...Object.fromEntries(oauthParams),
    }),
  });
  const sessionCookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  if (!sessionCookie) throw new Error("login did not set a session cookie");
  console.log("logged in, session established");

  console.log("\n== 3. approve the consent screen ==");
  const consentRes = await fetch(`${BASE}/oauth/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({
      decision: "approve",
      platform: "claude",
      label: "OAuth test agent",
      ...Object.fromEntries(oauthParams),
    }),
  });
  const redirectLocation = consentRes.headers.get("location");
  if (!redirectLocation) throw new Error("consent did not redirect back");
  const code = new URL(redirectLocation).searchParams.get("code");
  console.log("authorization code received:", code);

  console.log("\n== 4. exchange code for an access token ==");
  const tokenRes = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id,
      code_verifier: verifier,
    }),
  });
  const { access_token } = await tokenRes.json();
  console.log("access_token:", access_token.slice(0, 20) + "...");

  console.log("\n== 5. (test setup) authorise the newly connected agent via the normal app ==");
  const userToken = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "jane@example.com", password: "password123" }),
  })
    .then((r) => r.json())
    .then((d) => d.token);

  const agents = await fetch(`${BASE}/agents`, { headers: { Authorization: `Bearer ${userToken}` } }).then((r) =>
    r.json()
  );
  const agent = agents.agents.find((a) => a.label === "OAuth test agent");
  console.log("OAuth-connected agent id:", agent.id);

  await fetch(`${BASE}/grants`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      agentId: agent.id,
      scope: "job_application:submit",
      consentedFields: ["name", "email", "resume"],
      expiresInMinutes: 60,
    }),
  });

  console.log("\n== 6. real MCP calls over the remote HTTP transport, using only the bearer token ==");
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${access_token}` } },
  });
  const client = new Client({ name: "oauth-test-host", version: "0.0.0" });
  await client.connect(transport);

  const listResult = await client.callTool({ name: "list_my_authorizations", arguments: {} });
  console.log(listResult.content[0].text);
  const grants = JSON.parse(listResult.content[0].text);
  const grantId = grants[0].id;

  const credResult = await client.callTool({ name: "get_credential", arguments: { grantId } });
  const { credential } = JSON.parse(credResult.content[0].text);

  console.log("\n== 7. present that credential to the real demo job board ==");
  const applyRes = await fetch("http://localhost:4100/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hapi-grant": credential },
    body: "{}",
  });
  console.log(await applyRes.json());

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
