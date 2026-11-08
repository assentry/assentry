import crypto from "crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { api, callTool, prisma, resetDb, signUpUser } from "./helpers";

beforeEach(resetDb);

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function register(redirectUris = [REDIRECT], clientName = "Claude") {
  const res = await api().post("/oauth/register").send({ redirect_uris: redirectUris, client_name: clientName });
  expect(res.status).toBe(201);
  return res.body.client_id as string;
}

function csrfFrom(html: string): string {
  const match = html.match(/name="csrf" value="([^"]+)"/);
  if (!match) throw new Error("no csrf field on the page");
  return match[1];
}

/** Runs the browser part of connecting an AI: log in, then approve. Returns the authorization code. */
async function connect(clientId: string, user: { email: string; password: string }, challenge: string) {
  const browser = request.agent(app);
  const params = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    state: "xyz",
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  const loginPage = await browser.get("/oauth/authorize").query(params);
  expect(loginPage.status).toBe(200);
  const login = await browser
    .post("/oauth/login")
    .type("form")
    .send({ ...params, email: user.email, password: user.password, csrf: csrfFrom(loginPage.text) });
  expect(login.status).toBe(302);

  const consentPage = await browser.get("/oauth/authorize").query(params);
  const approve = await browser
    .post("/oauth/authorize")
    .type("form")
    .send({ ...params, decision: "approve", platform: "claude", csrf: csrfFrom(consentPage.text) });
  expect(approve.status).toBe(302);
  const location = new URL(approve.headers.location);
  expect(`${location.origin}${location.pathname}`).toBe(REDIRECT);
  expect(location.searchParams.get("state")).toBe("xyz");
  return { code: location.searchParams.get("code")!, browser, params, consentPage };
}

async function exchange(clientId: string, code: string, verifier: string, redirectUri = REDIRECT) {
  return api()
    .post("/oauth/token")
    .type("form")
    .send({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier });
}

describe("connecting an AI (OAuth 2.1 + PKCE)", () => {
  it("works end to end and gives a token the connector accepts", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const { code } = await connect(clientId, user, challenge);
    const token = await exchange(clientId, code, verifier);
    expect(token.status).toBe(200);
    const tools = await callTool(token.body.access_token, "list_my_authorizations", {});
    expect(tools.status).toBe(200);
  });

  it("stores authorization codes only as fingerprints", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const { code } = await connect(clientId, user, pkce().challenge);
    expect(await prisma.oAuthAuthorizationCode.findFirst({ where: { code } })).toBeNull();
  });

  it("refuses the wrong PKCE verifier, a reused code, and a different redirect address", async () => {
    const user = await signUpUser();
    const clientId = await register([REDIRECT, "https://claude.ai/other"]);
    const { verifier, challenge } = pkce();
    const { code } = await connect(clientId, user, challenge);
    expect((await exchange(clientId, code, "wrong-verifier")).body.error).toBe("invalid_grant");
    expect((await exchange(clientId, code, verifier, "https://claude.ai/other")).body.error).toBe("invalid_grant");
    expect((await exchange(clientId, code, verifier)).status).toBe(200);
    expect((await exchange(clientId, code, verifier)).body.error).toBe("invalid_grant");
  });

  it("lets a code be exchanged only once, even twice at the same moment", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const { code } = await connect(clientId, user, challenge);
    const results = await Promise.all([exchange(clientId, code, verifier), exchange(clientId, code, verifier)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it("only redirects to addresses the client registered", async () => {
    const clientId = await register();
    const res = await api().get("/oauth/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://evil.example.com/cb",
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
    });
    expect(res.status).toBe(400);
  });

  it("requires S256 PKCE", async () => {
    const clientId = await register();
    const res = await api().get("/oauth/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: "plain-challenge",
      code_challenge_method: "plain",
    });
    expect(res.status).toBe(400);
  });

  it("rejects form posts that didn't come from Assentry's own pages", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const params = {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      state: "",
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
    };
    const login = await api().post("/oauth/login").type("form").send({ ...params, email: user.email, password: user.password });
    expect(login.status).toBe(403);
    const forged = await api()
      .post("/oauth/login")
      .set("Cookie", "assentry_csrf=" + "a".repeat(43))
      .type("form")
      .send({ ...params, email: user.email, password: user.password, csrf: "b".repeat(43) });
    expect(forged.status).toBe(403);
  });

  it("shows who is signed in and where the connection goes, and doesn't pre-select replacing a connection", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const first = await connect(clientId, user, pkce().challenge);
    await exchange(clientId, first.code, "x").catch(() => {});
    // Make the first connection active so the page offers to replace it.
    await prisma.agent.updateMany({ where: { userId: user.id }, data: { secretHash: crypto.randomBytes(8).toString("hex") } });
    const page = await first.browser.get("/oauth/authorize").query(first.params);
    expect(page.text).toContain(user.email);
    expect(page.text).toContain("claude.ai");
    expect(page.text).toMatch(/name="replace_agent" value="" checked/);
    expect(page.text).not.toMatch(/name="replace_agent" value="[0-9a-f-]{36}" checked/);
  });

  it("serves its pages so they can't be framed by another site", async () => {
    const clientId = await register();
    const res = await api().get("/oauth/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
    });
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("gives short-lived access tokens and single-use refresh tokens", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const { code } = await connect(clientId, user, challenge);
    const first = (await exchange(clientId, code, verifier)).body;
    expect(first.expires_in).toBe(3600);
    expect(first.refresh_token).toBeTypeOf("string");

    const renew = (refreshToken: string, client = clientId) =>
      api().post("/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: client });
    expect((await renew(first.refresh_token, await register())).body.error).toBe("invalid_grant"); // another app
    const second = await renew(first.refresh_token);
    expect(second.status).toBe(200);
    expect((await renew(first.refresh_token)).body.error).toBe("invalid_grant"); // used already
    expect((await callTool(first.access_token, "list_my_authorizations", {})).status).toBe(401); // replaced
    expect((await callTool(second.body.access_token, "list_my_authorizations", {})).status).toBe(200);

    const both = await Promise.all([renew(second.body.refresh_token), renew(second.body.refresh_token)]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it("refuses an expired access token and tells the app to renew it", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const { code } = await connect(clientId, user, challenge);
    const token = (await exchange(clientId, code, verifier)).body;
    await prisma.agent.updateMany({ where: { userId: user.id }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
    const res = await callTool(token.access_token, "list_my_authorizations", {});
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain('error="invalid_token"');
    expect(res.headers["www-authenticate"]).toContain("/.well-known/oauth-protected-resource");
  });

  it("can't renew a connection the person disconnected", async () => {
    const user = await signUpUser();
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const { code } = await connect(clientId, user, challenge);
    const token = (await exchange(clientId, code, verifier)).body;
    await prisma.agent.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    const res = await api()
      .post("/oauth/token")
      .type("form")
      .send({ grant_type: "refresh_token", refresh_token: token.refresh_token, client_id: clientId });
    expect(res.body.error).toBe("invalid_grant");
  });
});
