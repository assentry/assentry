import { beforeEach, describe, expect, it } from "vitest";
import { approveSignIn } from "../src/lib/signIn";
import {
  allowPendingSite,
  api,
  callTool,
  collect,
  connectAgent,
  createSite,
  grantAgent,
  prisma,
  resetDb,
  signUpDeveloper,
  signUpUser,
  startCode,
} from "./helpers";

beforeEach(resetDb);

async function setup() {
  const user = await signUpUser();
  const dev = await signUpDeveloper();
  const site = await createSite(dev.token);
  const agent = await connectAgent(user.id);
  const grant = await grantAgent(user.token, agent.id);
  return { user, dev, site, agent, grant };
}

describe("browser sign-in codes", () => {
  it("issues long random codes and stores only their fingerprint", async () => {
    const { site } = await setup();
    const a = await startCode(site.apiKey);
    const b = await startCode(site.apiKey);
    expect(a.code).toMatch(/^asq_[2-9A-HJ-NP-Z]{52}$/);
    expect(a.code).not.toBe(b.code);
    const row = await prisma.signInRequest.findUniqueOrThrow({ where: { id: a.requestId } });
    expect(JSON.stringify(row)).not.toContain(a.code.slice(4));
  });

  it("won't issue codes for a site whose domain isn't verified", async () => {
    const { site } = await setup();
    await prisma.partner.update({ where: { id: site.id }, data: { domainVerifiedAt: null } });
    expect((await api().post("/sign-in-requests").set("x-assentry-api-key", site.apiKey)).status).toBe(403);
  });

  it("needs the site's API key", async () => {
    expect((await api().post("/sign-in-requests")).status).toBe(401);
    expect((await api().post("/sign-in-requests").set("x-assentry-api-key", "assentry_wrong")).status).toBe(401);
  });

  it("signs the agent in end to end", async () => {
    const { site, agent } = await setup();
    const { requestId, code } = await startCode(site.apiKey);
    expect((await collect(site.apiKey, requestId)).status).toBe("pending");
    expect(await approveSignIn(agent.id, code, site.domain)).toMatchObject({ ok: true, awaitingPerson: true });
    expect(await collect(site.apiKey, requestId)).toMatchObject({ status: "pending", waitingFor: "person" });
    await allowPendingSite(site.domain);
    const collected = await collect(site.apiKey, requestId);
    expect(collected.status).toBe("approved");
    expect(collected.credential).toBeTypeOf("string");
  });

  it("refuses a code approved for a different domain than the one it was issued to", async () => {
    const { site, agent, dev } = await setup();
    const other = await createSite(dev.token);
    const { code } = await startCode(site.apiKey);
    const outcome = await approveSignIn(agent.id, code, other.domain);
    expect(outcome).toMatchObject({ ok: false, error: "domain_mismatch", codeDomain: site.domain });
  });

  it("accepts the domain however the agent writes it (scheme, path, case)", async () => {
    const { site, agent } = await setup();
    const { code } = await startCode(site.apiKey);
    expect((await approveSignIn(agent.id, code, `https://${site.domain.toUpperCase()}/login?x=1`)).ok).toBe(true);
  });

  it("can be approved only once, even by two agents at the same moment", async () => {
    const { site, agent } = await setup();
    const other = await signUpUser();
    const otherAgent = await connectAgent(other.id);
    await grantAgent(other.token, otherAgent.id);
    const { code } = await startCode(site.apiKey);
    const results = await Promise.all([approveSignIn(agent.id, code, site.domain), approveSignIn(otherAgent.id, code, site.domain)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: "code_already_used" });
  });

  it("hands the credential over once only", async () => {
    const { site, agent } = await setup();
    const { requestId, code } = await startCode(site.apiKey);
    await approveSignIn(agent.id, code, site.domain);
    await allowPendingSite(site.domain);
    const [a, b] = await Promise.all([collect(site.apiKey, requestId), collect(site.apiKey, requestId)]);
    expect([a.status, b.status].sort()).toEqual(["already_collected", "approved"]);
  });

  it("expires codes after 5 minutes", async () => {
    const { site, agent } = await setup();
    const { requestId, code } = await startCode(site.apiKey);
    await prisma.signInRequest.update({ where: { id: requestId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await approveSignIn(agent.id, code, site.domain)).toMatchObject({ ok: false, error: "code_expired" });
    expect((await collect(site.apiKey, requestId)).status).toBe("expired");
  });

  it("doesn't let another site collect a sign-in", async () => {
    const { site, agent, dev } = await setup();
    const other = await createSite(dev.token);
    const { requestId, code } = await startCode(site.apiKey);
    await approveSignIn(agent.id, code, site.domain);
    await allowPendingSite(site.domain);
    expect((await collect(other.apiKey, requestId)).status).toBe("not_found");
    expect((await collect(site.apiKey, requestId)).status).toBe("approved");
  });

  it("rejects unknown and guessed codes", async () => {
    const { agent, site } = await setup();
    await startCode(site.apiKey);
    expect(await approveSignIn(agent.id, `asq_${"A".repeat(52)}`, site.domain)).toMatchObject({ error: "code_not_found" });
    expect(await approveSignIn(agent.id, "", site.domain)).toMatchObject({ error: "code_not_found" });
  });

  it("refuses when the person's permission is withdrawn before the site collects", async () => {
    const { site, agent, user, grant } = await setup();
    const { requestId, code } = await startCode(site.apiKey);
    await approveSignIn(agent.id, code, site.domain);
    await api().post(`/grants/${grant.id}/revoke`).set("Authorization", `Bearer ${user.token}`);
    expect(await collect(site.apiKey, requestId)).toMatchObject({ status: "denied", reason: "grant_revoked" });
  });

  it("asks which permission to use when there's more than one, and won't use someone else's", async () => {
    const { site, agent, user } = await setup();
    await grantAgent(user.token, agent.id);
    const { code } = await startCode(site.apiKey);
    expect(await approveSignIn(agent.id, code, site.domain)).toMatchObject({ error: "choose_grant" });

    const stranger = await signUpUser();
    const strangerAgent = await connectAgent(stranger.id);
    const strangerGrant = await grantAgent(stranger.token, strangerAgent.id);
    expect(await approveSignIn(agent.id, code, site.domain, strangerGrant.id)).toMatchObject({ error: "grant_not_found" });
  });

  it("works through the agent connector, and refuses unknown or revoked agent tokens", async () => {
    const { site, agent, user } = await setup();
    const { requestId, code } = await startCode(site.apiKey);
    const res = await callTool(agent.token, "approve_sign_in", { code, siteDomain: site.domain });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBeFalsy();
    expect(res.body.result.content[0].text).toContain("allow this site");
    await allowPendingSite(site.domain);
    expect((await collect(site.apiKey, requestId)).status).toBe("approved");

    expect((await callTool("agent_not-a-real-token", "list_my_authorizations", {})).status).toBe(401);
    await api().post(`/agents/${agent.id}/revoke`).set("Authorization", `Bearer ${user.token}`);
    expect((await callTool(agent.token, "list_my_authorizations", {})).status).toBe(401);
  });
});
