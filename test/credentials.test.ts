import crypto from "crypto";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";
import {
  api,
  callTool,
  connectAgent,
  createSite,
  grantAgent,
  prisma,
  resetDb,
  signIn,
  signUpDeveloper,
  signUpUser,
  verify,
} from "./helpers";

beforeEach(resetDb);

async function setup() {
  const user = await signUpUser();
  const dev = await signUpDeveloper();
  const site = await createSite(dev.token);
  const agent = await connectAgent(user.id);
  const grant = await grantAgent(user.token, agent.id);
  const session = await signIn(site, agent.id);
  return { user, dev, site, agent, grant, session };
}

describe("credentials", () => {
  it("are valid on the site they were issued for", async () => {
    const { site, session } = await setup();
    expect(await verify(site.apiKey, session.credential)).toMatchObject({ valid: true, userId: session.userId });
  });

  it("carry no personal data or internal IDs", async () => {
    const { session, user, agent } = await setup();
    const decoded = JSON.stringify(jwt.decode(session.credential, { complete: true }));
    for (const secret of [user.id, user.email, agent.id]) expect(decoded).not.toContain(secret);
  });

  it("are refused by any other site, even one owned by the same developer", async () => {
    const { session, dev } = await setup();
    const otherSite = await createSite(dev.token);
    const strangerSite = await createSite((await signUpDeveloper()).token);
    expect(await verify(otherSite.apiKey, session.credential)).toMatchObject({ valid: false, reason: "wrong_site" });
    expect(await verify(strangerSite.apiKey, session.credential)).toMatchObject({ valid: false, reason: "wrong_site" });
  });

  it("stop working the moment the person withdraws the permission", async () => {
    const { site, session, user, grant } = await setup();
    await api().post(`/grants/${grant.id}/revoke`).set("Authorization", `Bearer ${user.token}`);
    expect(await verify(site.apiKey, session.credential)).toMatchObject({ valid: false, reason: "revoked" });
  });

  it("stop working when the agent is disconnected", async () => {
    const { site, session, user, agent } = await setup();
    await api().post(`/agents/${agent.id}/revoke`).set("Authorization", `Bearer ${user.token}`);
    // Disconnecting an agent also withdraws its permissions.
    const result = await verify(site.apiKey, session.credential);
    expect(result.valid).toBe(false);
    expect(["revoked", "agent_revoked"]).toContain(result.reason);
  });

  it("stop working when the person ends that one sign-in", async () => {
    const { site, session, user } = await setup();
    const list = await api().get("/me/sign-ins").set("Authorization", `Bearer ${user.token}`);
    expect(list.body.signIns).toHaveLength(1);
    await api().post(`/me/sign-ins/${list.body.signIns[0].id}/end`).set("Authorization", `Bearer ${user.token}`);
    expect(await verify(site.apiKey, session.credential)).toMatchObject({ valid: false, reason: "sign_in_ended" });
  });

  it("stop working when the permission expires", async () => {
    const { site, session, grant } = await setup();
    await prisma.grant.update({ where: { id: grant.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await verify(site.apiKey, session.credential)).toMatchObject({ valid: false, reason: "expired" });
  });

  it("can't be forged or altered", async () => {
    const { site, session } = await setup();
    const [header, payload, signature] = session.credential.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());

    const otherGrantPayload = Buffer.from(JSON.stringify({ ...claims, gid: crypto.randomUUID() })).toString("base64url");
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = JSON.parse(Buffer.from(header, "base64url").toString()).kid;
    const selfSigned = jwt.sign(claims, privateKey, { algorithm: "ES256", keyid: kid, header: { alg: "ES256", kid, typ: "assentry-credential+jwt" } });
    const none = jwt.sign(claims, "", { algorithm: "none", header: { alg: "none", kid, typ: "assentry-credential+jwt" } as jwt.JwtHeader });
    const hmacWithPublicKey = jwt.sign(claims, JSON.stringify((await api().get("/.well-known/jwks.json")).body.keys[0]), {
      algorithm: "HS256",
      header: { alg: "HS256", kid, typ: "assentry-credential+jwt" } as jwt.JwtHeader,
    });

    for (const forged of [`${header}.${otherGrantPayload}.${signature}`, selfSigned, none, hmacWithPublicKey, "not-a-jwt", ""]) {
      const result = await verify(site.apiKey, forged);
      expect(result.valid).not.toBe(true);
    }
  });

  it("publishes only public keys", async () => {
    await setup();
    const { keys } = (await api().get("/.well-known/jwks.json")).body;
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toHaveProperty("d");
  });

  it("are issued over the connector only for verified, active sites", async () => {
    const { agent, grant, site } = await setup();
    const ok = await callTool(agent.token, "get_credential", { grantId: grant.id, siteDomain: site.domain });
    expect(ok.body.result.isError).toBeFalsy();
    const unknown = await callTool(agent.token, "get_credential", { grantId: grant.id, siteDomain: "not-a-site.example.com" });
    expect(unknown.body.result.isError).toBe(true);

    const stranger = await signUpUser();
    const strangerAgent = await connectAgent(stranger.id);
    const theirs = await callTool(strangerAgent.token, "get_credential", { grantId: grant.id, siteDomain: site.domain });
    expect(theirs.body.result.isError).toBe(true);
  });
});

describe("credentials an agent carries itself (connector)", () => {
  async function fetchCredential(expiresInMinutes: number) {
    const user = await signUpUser();
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token);
    const agent = await connectAgent(user.id);
    const grant = await grantAgent(user.token, agent.id, [], expiresInMinutes);
    await signIn(site, agent.id); // the person allows the site once
    const res = await callTool(agent.token, "get_credential", { grantId: grant.id, siteDomain: site.domain });
    expect(res.body.result.isError).toBeFalsy();
    const body = JSON.parse(res.body.result.content[0].text);
    const exp = (jwt.decode(body.credential) as { exp: number }).exp * 1000;
    return { site, body, exp };
  }

  it("expire after 15 minutes, even when the permission lasts much longer", async () => {
    const before = Date.now();
    const { site, body, exp } = await fetchCredential(60 * 24 * 30);
    expect(exp).toBeLessThanOrEqual(before + 15 * 60 * 1000 + 2000);
    expect(exp).toBeGreaterThan(before + 14 * 60 * 1000);
    expect(new Date(body.expiresAt).getTime()).toBeLessThanOrEqual(before + 15 * 60 * 1000 + 2000);
    expect(await verify(site.apiKey, body.credential)).toMatchObject({ valid: true });
  });

  it("never outlive the permission itself", async () => {
    const before = Date.now();
    const { exp } = await fetchCredential(5);
    expect(exp).toBeLessThanOrEqual(before + 5 * 60 * 1000 + 2000);
  });
});

describe("per-site IDs", () => {
  it("are stable for one developer and different for another, so sites can't match people up", async () => {
    const user = await signUpUser();
    const agent = await connectAgent(user.id);
    await grantAgent(user.token, agent.id);
    const devA = await signUpDeveloper();
    const devB = await signUpDeveloper();
    const a1 = await createSite(devA.token);
    const a2 = await createSite(devA.token);
    const b = await createSite(devB.token);

    const first = await signIn(a1, agent.id);
    const again = await signIn(a1, agent.id);
    const sameDeveloper = await signIn(a2, agent.id);
    const otherDeveloper = await signIn(b, agent.id);

    expect(again.userId).toBe(first.userId);
    expect(sameDeveloper.userId).toBe(first.userId);
    expect(otherDeveloper.userId).not.toBe(first.userId);
    expect(otherDeveloper.agentId).not.toBe(first.agentId);
    for (const id of [first.userId, otherDeveloper.userId]) expect(id).not.toContain(user.id);
  });
});
