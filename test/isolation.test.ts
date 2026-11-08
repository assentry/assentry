import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { isPublicAddress, normaliseDomain } from "../src/lib/domain";
import { api, connectAgent, createSite, grantAgent, prisma, resetDb, signIn, signUpDeveloper, signUpUser, verify } from "./helpers";

beforeEach(resetDb);

describe("people can't touch each other's things", () => {
  it("grants, agents and sign-ins belong to their owner only", async () => {
    const alice = await signUpUser();
    const bob = await signUpUser();
    const agent = await connectAgent(alice.id);
    const grant = await grantAgent(alice.token, agent.id);
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    const session = await signIn(site, agent.id);
    const signInId = (await api().get("/me/sign-ins").set("Authorization", `Bearer ${alice.token}`)).body.signIns[0].id;
    const asBob = (path: string) => api().post(path).set("Authorization", `Bearer ${bob.token}`);

    expect((await asBob(`/grants/${grant.id}/revoke`)).status).toBe(404);
    expect((await asBob(`/agents/${agent.id}/revoke`)).status).toBe(404);
    expect((await asBob(`/me/sign-ins/${signInId}/end`)).status).toBe(404);
    expect((await api().post("/grants").set("Authorization", `Bearer ${bob.token}`).send({ agentId: agent.id, expiresInMinutes: 5 })).status).toBe(404);
    expect((await api().get("/grants").set("Authorization", `Bearer ${bob.token}`)).body.grants).toEqual([]);
    expect((await verify(site.apiKey, session.credential)).valid).toBe(true);
  });

  it("the activity log shows no keys, hashes or tokens", async () => {
    const user = await signUpUser();
    const agent = await connectAgent(user.id);
    await grantAgent(user.token, agent.id);
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    await signIn(site, agent.id);
    const log = await api().get("/audit").set("Authorization", `Bearer ${user.token}`);
    expect(log.body.logs.length).toBeGreaterThan(0);
    const text = JSON.stringify(log.body);
    for (const leak of ["secretHash", "apiKeyHash", "domainVerificationToken", "developerId", "passwordHash"]) {
      expect(text).not.toContain(leak);
    }
  });
});

describe("developers can't touch each other's apps", () => {
  it("rotate, revoke, edit and verify are scoped to the owner", async () => {
    const owner = await signUpDeveloper();
    const intruder = await signUpDeveloper();
    const site = await createSite(owner.token);
    const asIntruder = api();
    for (const [method, path] of [
      ["post", `/developer/apps/${site.id}/rotate`],
      ["post", `/developer/apps/${site.id}/revoke`],
      ["patch", `/developer/apps/${site.id}`],
      ["put", `/developer/apps/${site.id}/fields`],
      ["post", `/developer/apps/${site.id}/verify-domain`],
    ] as const) {
      const res = await asIntruder[method](path).set("Authorization", `Bearer ${intruder.token}`).send({ fields: [] });
      expect(res.status).toBe(404);
    }
    expect((await api().get("/developer/apps").set("Authorization", `Bearer ${intruder.token}`)).body.apps).toEqual([]);
  });

  it("a rotated or revoked key stops working at once", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    const rotated = await api().post(`/developer/apps/${site.id}/rotate`).set("Authorization", `Bearer ${dev.token}`);
    expect((await api().post("/verify").set("x-assentry-api-key", site.apiKey).send({ credential: "x" })).status).toBe(401);
    expect((await api().post("/verify").set("x-assentry-api-key", rotated.body.apiKey).send({ credential: "x" })).status).toBe(200);
    await api().post(`/developer/apps/${site.id}/revoke`).set("Authorization", `Bearer ${dev.token}`);
    expect((await api().post("/verify").set("x-assentry-api-key", rotated.body.apiKey).send({ credential: "x" })).status).toBe(401);
  });

  it("API keys are stored only as hashes", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    const row = await prisma.partner.findUniqueOrThrow({ where: { id: site.id } });
    expect(JSON.stringify(row)).not.toContain(site.apiKey);
  });

  it("changing an app's domain drops its verification", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    const res = await api().patch(`/developer/apps/${site.id}`).set("Authorization", `Bearer ${dev.token}`).send({ domain: "elsewhere.example.com" });
    expect(res.body.app.domainVerifiedAt).toBeNull();
  });
});

describe("account linking", () => {
  async function linkCode() {
    const user = await signUpUser();
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    await prisma.partner.update({ where: { id: site.id }, data: { linkRedirectUris: ["https://shop.example.com/link/callback"] } });
    const browser = request.agent(app);
    const params = { partner_id: site.publicId, redirect_uri: "https://shop.example.com/link/callback", state: "s".repeat(32) };
    const loginPage = await browser.get("/link/authorize").query(params);
    const csrf = loginPage.text.match(/name="csrf" value="([^"]+)"/)![1];
    await browser.post("/link/login").type("form").send({ ...params, email: user.email, password: user.password, csrf });
    const confirmPage = await browser.get("/link/authorize").query(params);
    expect(confirmPage.text).toContain(user.email);
    const confirm = await browser
      .post("/link/authorize")
      .type("form")
      .send({ ...params, decision: "approve", csrf: confirmPage.text.match(/name="csrf" value="([^"]+)"/)![1] });
    const code = new URL(confirm.headers.location).searchParams.get("code")!;
    return { site, code, dev };
  }

  it("gives the site a one-time code only it can exchange, once", async () => {
    const { site, code, dev } = await linkCode();
    const other = await createSite(dev.token);
    expect((await api().post("/link/token").set("x-assentry-api-key", other.apiKey).send({ code })).status).toBe(400);
    const [a, b] = await Promise.all([1, 2].map(() => api().post("/link/token").set("x-assentry-api-key", site.apiKey).send({ code })));
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it("refuses a login form posted from another site", async () => {
    const user = await signUpUser();
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    await prisma.partner.update({ where: { id: site.id }, data: { linkRedirectUris: ["https://shop.example.com/cb"] } });
    const res = await api()
      .post("/link/login")
      .type("form")
      .send({ partner_id: site.publicId, redirect_uri: "https://shop.example.com/cb", email: user.email, password: user.password });
    expect(res.status).toBe(403);
  });
});

describe("general protections", () => {
  it("sends security headers and hides the server's internals", async () => {
    const res = await api().get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("answers malformed and oversized requests without details", async () => {
    const malformed = await api().post("/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: "bad request" });
    const huge = await api().post("/auth/login").send({ email: "a@example.com", password: "x".repeat(200_000) });
    expect(huge.status).toBe(413);
  });

  it("only accepts real public domains for sites", () => {
    expect(normaliseDomain("https://Shop.Example.com/login")).toBe("shop.example.com");
    for (const bad of ["10.0.0.1", "http://192.168.1.1", "nodots", "exa mple.com"]) {
      expect(normaliseDomain(bad)).toBeNull();
    }
  });

  it("treats private, loopback and link-local addresses as internal", () => {
    for (const internal of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicAddress(internal), internal).toBe(false);
    }
    for (const external of ["8.8.8.8", "216.198.79.1", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(external), external).toBe(true);
    }
  });
});
