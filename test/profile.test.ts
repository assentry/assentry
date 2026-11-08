import { beforeEach, describe, expect, it } from "vitest";
import { approveSignIn } from "../src/lib/signIn";
import { suggestDetail } from "../src/lib/agentDetails";
import {
  api,
  connectAgent,
  createSite,
  grantAgent,
  prisma,
  profile,
  resetDb,
  setDetail,
  signIn,
  signUpDeveloper,
  signUpUser,
  startCode,
} from "./helpers";

beforeEach(resetDb);

async function person(consentedFields: string[]) {
  const user = await signUpUser();
  const agent = await connectAgent(user.id);
  const grant = await grantAgent(user.token, agent.id, consentedFields);
  return { user, agent, grant };
}

describe("what a site receives", () => {
  it("only details the person consented to, and only ones the site declared", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token, undefined, [{ key: "name" }, { key: "email" }, { key: "phone_number" }]);
    const { user, agent } = await person(["name", "email"]);
    await setDetail(user.token, "name", "Ada Lovelace");
    await setDetail(user.token, "email", "ada@example.com");
    await setDetail(user.token, "phone_number", "+14155552671");
    await setDetail(user.token, "birthdate", "1990-12-10");

    const { credential } = await signIn(site, agent.id);
    const result = await profile(site.apiKey, credential, ["name", "email", "phone_number", "birthdate"]);
    expect(result.profile).toEqual({ name: "Ada Lovelace", email: "ada@example.com" });
    expect(result.undeclaredFields).toEqual(["birthdate"]);
  });

  it("nothing at all with an invalid credential", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token, undefined, [{ key: "name" }]);
    expect(await profile(site.apiKey, "bogus", ["name"])).toEqual({ valid: false, reason: "invalid_credential" });
  });

  it("never another site's custom details or the person's private ones", async () => {
    const dev = await signUpDeveloper();
    const custom = { key: "member_number", custom: { label: "Member number", type: "text" } };
    const siteA = await createSite(dev.token, undefined, [custom]);
    const siteB = await createSite(dev.token, undefined, [custom]);
    const { user, agent } = await person([]);

    // Answered for site A only.
    const a = await signIn(siteA, agent.id);
    await setDetail(user.token, `site:${siteA.id}:member_number`, "A-123");
    await setDetail(user.token, "my:secret_note", "x").catch(() => {});

    const b = await signIn(siteB, agent.id);
    expect((await profile(siteA.apiKey, a.credential, ["member_number"])).profile).toEqual({ member_number: "A-123" });
    expect((await profile(siteB.apiKey, b.credential, ["member_number"])).profile).toEqual({});
    expect((await profile(siteB.apiKey, b.credential, ["my:secret_note", `site:${siteA.id}:member_number`])).profile).toEqual({});
  });

  it("doesn't share a detail with a site just because the person later edits it", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token, undefined, [{ key: "phone_number" }]);
    const { user, agent } = await person([]); // phone not in the permission
    await setDetail(user.token, "phone_number", "+14155552671");

    const { credential } = await signIn(site, agent.id); // site asks; the person is asked to share
    expect((await profile(site.apiKey, credential, ["phone_number"])).profile).toEqual({});

    await setDetail(user.token, "phone_number", "+14155550000"); // an unrelated edit
    expect((await profile(site.apiKey, credential, ["phone_number"])).profile).toEqual({});

    // Pressing "Share" for that site does share it.
    const request = await prisma.fieldRequest.findFirstOrThrow({ where: { userId: user.id, partnerId: site.id } });
    expect((await api().post(`/me/requests/${request.id}/share`).set("Authorization", `Bearer ${user.token}`)).status).toBe(200);
    expect((await profile(site.apiKey, credential, ["phone_number"])).profile).toEqual({ phone_number: "+14155550000" });
  });

  it("filling in a missing detail a site asked for shares it with that site (as the app says)", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token, undefined, [{ key: "job_title" }]);
    const { user, agent } = await person([]);
    const { credential } = await signIn(site, agent.id);
    expect((await profile(site.apiKey, credential, ["job_title"])).profile).toEqual({});
    await setDetail(user.token, "job_title", "Engineer");
    expect((await profile(site.apiKey, credential, ["job_title"])).profile).toEqual({ job_title: "Engineer" });
  });

  it("never an agent's suggestion the person hasn't confirmed", async () => {
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token, undefined, [{ key: "employer" }]);
    const { user, agent } = await person(["employer"]);
    const { requestId, code } = await startCode(site.apiKey);
    await approveSignIn(agent.id, code, site.domain);
    const collected = (await api().post("/sign-in-requests/collect").set("x-assentry-api-key", site.apiKey).send({ requestId })).body;

    expect((await suggestDetail(agent.id, "employer", "Acme")).ok).toBe(true);
    expect((await profile(site.apiKey, collected.credential, ["employer"])).profile).toEqual({});

    await api().post("/me/profile/values/employer/confirm").set("Authorization", `Bearer ${user.token}`);
    expect((await profile(site.apiKey, collected.credential, ["employer"])).profile).toEqual({ employer: "Acme" });
  });

  it("validates and normalises values to their published type", async () => {
    const { user } = await person([]);
    const bad = await api().put("/me/profile/values/email").set("Authorization", `Bearer ${user.token}`).send({ value: "not an email" });
    expect(bad.status).toBe(400);
    await setDetail(user.token, "email", "  Ada@Example.COM ");
    const row = await prisma.profileValue.findFirstOrThrow({ where: { userId: user.id, key: "email" } });
    expect(row.value).toBe("ada@example.com");
  });
});
