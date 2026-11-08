import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";
import { api, prisma, resetDb, signUpDeveloper, signUpUser } from "./helpers";

beforeEach(resetDb);

describe("accounts and sessions", () => {
  it("signs up and logs in a person", async () => {
    const user = await signUpUser();
    const res = await api().post("/auth/login").send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    const me = await api().get("/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.user.email).toBe(user.email);
  });

  it("stores passwords only as bcrypt hashes", async () => {
    const user = await signUpUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toContain(user.password);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("refuses a wrong password with the same message as an unknown email", async () => {
    const user = await signUpUser();
    const wrong = await api().post("/auth/login").send({ email: user.email, password: "not-the-password" });
    const unknown = await api().post("/auth/login").send({ email: "nobody@example.com", password: "not-the-password" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("locks an email after 10 failed logins, even with the right password", async () => {
    const user = await signUpUser();
    for (let i = 0; i < 10; i++) {
      expect((await api().post("/auth/login").send({ email: user.email, password: "wrong-password" })).status).toBe(401);
    }
    const locked = await api().post("/auth/login").send({ email: user.email, password: user.password });
    expect(locked.status).toBe(429);
  });

  it("throttles developer logins separately", async () => {
    const dev = await signUpDeveloper();
    for (let i = 0; i < 10; i++) {
      await api().post("/developer/auth/login").send({ email: dev.email, password: "wrong-password" });
    }
    expect((await api().post("/developer/auth/login").send({ email: dev.email, password: dev.password })).status).toBe(429);
  });

  it("answers 409, not an error, when the same email signs up twice at once", async () => {
    const email = "twice@example.com";
    const results = await Promise.all([1, 2].map(() => api().post("/auth/signup").send({ email, password: "correct-horse-battery" })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("never accepts a developer session as a person's session, or the reverse", async () => {
    const user = await signUpUser();
    const dev = await signUpDeveloper();
    expect((await api().get("/grants").set("Authorization", `Bearer ${dev.token}`)).status).toBe(401);
    expect((await api().get("/developer/apps").set("Authorization", `Bearer ${user.token}`)).status).toBe(401);
  });

  it("rejects forged and tampered session tokens", async () => {
    const user = await signUpUser();
    const [header, payload, signature] = user.token.split(".");
    const tampered = `${header}.${Buffer.from(JSON.stringify({ sub: "someone-else" })).toString("base64url")}.${signature}`;
    const unsigned = jwt.sign({ sub: user.id }, "", { algorithm: "none" });
    const wrongKey = jwt.sign({ sub: user.id }, "guessed-secret");
    for (const token of [tampered, unsigned, wrongKey, `${header}.${payload}.`]) {
      expect((await api().get("/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    }
  });
});
