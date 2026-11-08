import crypto from "crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { api, resetDb, signUpDeveloper, signUpUser } from "./helpers";

beforeEach(resetDb);

const randomIp = () => `203.0.113.${crypto.randomInt(1, 254)}`;

describe("log out everywhere", () => {
  it("ends every session a person has, at once", async () => {
    const user = await signUpUser();
    const other = (await api().post("/auth/login").send({ email: user.email, password: user.password })).body.token;
    const me = (token: string) => api().get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect((await me(other)).status).toBe(200);

    expect((await api().post("/auth/logout-everywhere").set("Authorization", `Bearer ${user.token}`)).status).toBe(200);
    expect((await me(user.token)).status).toBe(401);
    expect((await me(other)).status).toBe(401);

    const fresh = (await api().post("/auth/login").send({ email: user.email, password: user.password })).body.token;
    expect((await me(fresh)).status).toBe(200);
  });

  it("also ends the browser session used for connecting an AI and linking accounts", async () => {
    const user = await signUpUser();
    const clientId = (await api().post("/oauth/register").send({ redirect_uris: ["https://claude.ai/cb"], client_name: "Claude" })).body
      .client_id;
    const params = {
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://claude.ai/cb",
      code_challenge: crypto.createHash("sha256").update("v".repeat(43)).digest("base64url"),
      code_challenge_method: "S256",
    };
    const browser = request.agent(app);
    const loginPage = await browser.get("/oauth/authorize").query(params);
    const csrf = loginPage.text.match(/name="csrf" value="([^"]+)"/)![1];
    await browser.post("/oauth/login").type("form").send({ ...params, email: user.email, password: user.password, csrf });
    expect((await browser.get("/oauth/authorize").query(params)).text).toContain("Signed in as");

    await api().post("/auth/logout-everywhere").set("Authorization", `Bearer ${user.token}`);
    expect((await browser.get("/oauth/authorize").query(params)).text).not.toContain("Signed in as");
  });

  it("ends every developer console session, at once", async () => {
    const dev = await signUpDeveloper();
    const me = () => api().get("/developer/auth/me").set("Authorization", `Bearer ${dev.token}`);
    expect((await me()).status).toBe(200);
    await api().post("/developer/auth/logout-everywhere").set("Authorization", `Bearer ${dev.token}`);
    expect((await me()).status).toBe(401);
  });
});

describe("sign-up and login don't help anyone check emails in bulk", () => {
  it("limits sign-ups per IP address", async () => {
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await api()
        .post("/auth/signup")
        .set("x-real-ip", ip)
        .send({ email: `bulk-${i}-${crypto.randomUUID()}@example.com`, password: "correct-horse-battery" });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
    // Someone else isn't affected.
    const other = await api().post("/auth/signup").set("x-real-ip", randomIp()).send({ email: `x-${crypto.randomUUID()}@example.com`, password: "correct-horse-battery" });
    expect(other.status).toBe(201);
  }, 60_000);

  it("limits developer sign-ups per IP address too", async () => {
    const ip = randomIp();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (
        await api()
          .post("/developer/auth/signup")
          .set("x-real-ip", ip)
          .send({ email: `dev-bulk-${i}-${crypto.randomUUID()}@example.com`, password: "correct-horse-battery" })
      ).status;
    }
    expect(last).toBe(429);
  }, 60_000);

  it("takes as long to refuse an unknown email as a wrong password", async () => {
    const user = await signUpUser();
    const time = async (email: string) => {
      const start = Date.now();
      const res = await api().post("/auth/login").set("x-real-ip", randomIp()).send({ email, password: "wrong-password-here" });
      expect(res.status).toBe(401);
      return Date.now() - start;
    };
    const unknown = await time(`nobody-${crypto.randomUUID()}@example.com`);
    const wrong = await time(user.email);
    // Both run a full password check (cost 12); without it, unknown emails return almost at once.
    expect(unknown).toBeGreaterThan(wrong / 3);
  });
});
