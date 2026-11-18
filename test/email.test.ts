import { beforeEach, describe, expect, it } from "vitest";
import { sentEmails } from "../src/lib/mailer";
import { approveSignIn } from "../src/lib/signIn";
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
  verifyEmail,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
  sentEmails.length = 0;
});

async function setup() {
  const user = await signUpUser();
  const agent = await connectAgent(user.id);
  await grantAgent(user.token, agent.id, ["email"]);
  const dev = await signUpDeveloper();
  const site = await createSite(dev.token, undefined, [{ key: "email", required: true }]);
  await setDetail(user.token, "email", "ada@example.com");
  const as = (method: "get" | "post", path: string, body?: object) =>
    api()[method](path).set("Authorization", `Bearer ${user.token}`).send(body);
  const lastCode = () => /\b(\d{6})\b/.exec(sentEmails[sentEmails.length - 1].text)![1];
  return { user, agent, site, as, lastCode };
}

describe("email verification", () => {
  it("an unverified email is never shared; the site sees it as missing", async () => {
    const { agent, site } = await setup();
    const { credential } = await signIn(site, agent.id);
    const result = await profile(site.apiKey, credential, ["email"]);
    expect(result.profile).toEqual({});
    expect(result.missing).toEqual(["email"]);
  });

  it("tells the agent the person still needs to verify it", async () => {
    const { agent, site } = await setup();
    await signIn(site, agent.id); // the person allows the site
    const { code } = await startCode(site.apiKey);
    const approved = await approveSignIn(agent.id, code, site.domain);
    expect(approved.ok && !approved.awaitingPerson && approved.missing).toEqual([
      expect.objectContaining({ key: "email", reason: "unverified" }),
    ]);
  });

  it("once verified, the email is shared and marked verified", async () => {
    const { user, agent, site, as } = await setup();
    await verifyEmail(user.token);
    expect((await as("get", "/me/profile")).body.emailVerification).toEqual({ email: "ada@example.com", verified: true });
    const { credential } = await signIn(site, agent.id);
    const result = await profile(site.apiKey, credential, ["email"]);
    expect(result.profile).toEqual({ email: "ada@example.com" });
    expect(result.meta.email).toMatchObject({ verified: true });
  });

  it("sends the code to the address being verified, and stores only a keyed hash of it", async () => {
    const { as, lastCode } = await setup();
    expect((await as("post", "/me/email-verification/start")).status).toBe(200);
    expect(sentEmails.at(-1)!.to).toBe("ada@example.com");
    const row = await prisma.emailVerification.findFirstOrThrow({});
    expect(row.codeHash).not.toContain(lastCode());
    expect(JSON.stringify(row)).not.toContain(lastCode());
  });

  it("changing the email makes it unverified again", async () => {
    const { user, agent, site, as } = await setup();
    await verifyEmail(user.token);
    await setDetail(user.token, "email", "someone-else@example.com");
    expect((await as("get", "/me/profile")).body.emailVerification).toEqual({ email: "someone-else@example.com", verified: false });
    const { credential } = await signIn(site, agent.id);
    expect((await profile(site.apiKey, credential, ["email"])).profile).toEqual({});
  });

  it("a code sent for an old address can't verify a new one", async () => {
    const { user, as, lastCode } = await setup();
    await as("post", "/me/email-verification/start");
    const code = lastCode();
    await setDetail(user.token, "email", "attacker@example.com");
    expect((await as("post", "/me/email-verification/confirm", { code })).body.error).toBe("email_changed");
    expect((await as("get", "/me/profile")).body.emailVerification.verified).toBe(false);
  });

  it("refuses wrong codes, and locks the code after 5 wrong attempts", async () => {
    const { as, lastCode } = await setup();
    await as("post", "/me/email-verification/start");
    const right = lastCode();
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      expect((await as("post", "/me/email-verification/confirm", { code: wrong })).body.error).toBe("wrong_code");
    }
    const locked = await as("post", "/me/email-verification/confirm", { code: right });
    expect(locked.status).toBe(429);
  });

  it("codes expire after 15 minutes and work only once", async () => {
    const { as, lastCode } = await setup();
    await as("post", "/me/email-verification/start");
    const code = lastCode();
    await prisma.emailVerification.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await as("post", "/me/email-verification/confirm", { code })).body.error).toBe("code_expired");

    await as("post", "/me/email-verification/start");
    const fresh = lastCode();
    expect((await as("post", "/me/email-verification/confirm", { code: fresh })).status).toBe(200);
    expect((await as("post", "/me/email-verification/confirm", { code: fresh })).body.error).toBe("no_pending_code");
  });

  it("a new code replaces the previous one", async () => {
    const { as, lastCode } = await setup();
    await as("post", "/me/email-verification/start");
    const first = lastCode();
    await as("post", "/me/email-verification/start");
    const second = lastCode();
    if (first !== second) {
      expect((await as("post", "/me/email-verification/confirm", { code: first })).body.error).toBe("wrong_code");
    }
    expect((await as("post", "/me/email-verification/confirm", { code: second })).status).toBe(200);
  });

  it("limits how many codes can be sent in an hour", async () => {
    const { as } = await setup();
    for (let i = 0; i < 5; i++) expect((await as("post", "/me/email-verification/start")).status).toBe(200);
    expect((await as("post", "/me/email-verification/start")).status).toBe(429);
  });

  it("one person's verification never counts for another", async () => {
    const { user } = await setup();
    await verifyEmail(user.token);
    const other = await signUpUser();
    await setDetail(other.token, "email", "ada@example.com");
    const res = await api().get("/me/profile").set("Authorization", `Bearer ${other.token}`);
    expect(res.body.emailVerification).toEqual({ email: "ada@example.com", verified: false });
  });
});
