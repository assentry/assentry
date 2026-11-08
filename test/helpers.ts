import crypto from "crypto";
import request from "supertest";
import { app } from "../src/app";
import { approveSignIn } from "../src/lib/signIn";
import { prisma } from "../src/lib/prisma";
import { generateSecret, hashSecret } from "../src/lib/secrets";

export const api = () => request(app);
export { prisma };

/** Empties every table except the signing keys (cached in memory) and migration history. */
export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename NOT IN ('_prisma_migrations', 'SigningKey')`;
  if (rows.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
  }
}

const unique = () => crypto.randomBytes(5).toString("hex");

export async function signUpUser(email = `person-${unique()}@example.com`, password = "correct-horse-battery") {
  const res = await api().post("/auth/signup").send({ email, password, name: "Test Person" });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, id: res.body.user.id as string, email, password };
}

export async function signUpDeveloper(email = `dev-${unique()}@example.com`, password = "correct-horse-battery") {
  const res = await api().post("/developer/auth/signup").send({ email, password });
  if (res.status !== 201) throw new Error(`developer signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, id: res.body.developer.id as string, email, password };
}

export interface DeclaredField {
  key: string;
  required?: boolean;
  custom?: { label: string; type: string; options?: string[] };
}

/** Creates an app and marks its domain verified (the real check fetches from the live site). */
export async function createSite(developerToken: string, domain = `shop-${unique()}.example.com`, fields: DeclaredField[] = []) {
  const res = await api()
    .post("/developer/apps")
    .set("Authorization", `Bearer ${developerToken}`)
    .send({ name: `Site ${domain}`, domain, fields });
  if (res.status !== 201) throw new Error(`create app failed: ${res.status} ${JSON.stringify(res.body)}`);
  await prisma.partner.update({ where: { id: res.body.app.id }, data: { domainVerifiedAt: new Date() } });
  return { id: res.body.app.id as string, publicId: res.body.app.publicId as string, apiKey: res.body.apiKey as string, domain };
}

/** An agent connection as the OAuth flow leaves it (tested end to end in oauth.test.ts). */
export async function connectAgent(userId: string) {
  const token = generateSecret("agent");
  const agent = await prisma.agent.create({ data: { userId, platform: "claude", secretHash: hashSecret(token) } });
  return { id: agent.id, token };
}

export async function grantAgent(userToken: string, agentId: string, consentedFields: string[] = [], expiresInMinutes = 60) {
  const res = await api()
    .post("/grants")
    .set("Authorization", `Bearer ${userToken}`)
    .send({ agentId, consentedFields, expiresInMinutes });
  if (res.status !== 201) throw new Error(`grant failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.grant as { id: string };
}

export async function startCode(apiKey: string) {
  const res = await api().post("/sign-in-requests").set("x-assentry-api-key", apiKey);
  if (res.status !== 201) throw new Error(`start sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { requestId: string; code: string; expiresAt: string };
}

export async function collect(apiKey: string, requestId: string) {
  return (await api().post("/sign-in-requests/collect").set("x-assentry-api-key", apiKey).send({ requestId })).body;
}

/** The whole browser sign-in: the site shows a code, the agent approves it, the site collects. */
export async function signIn(site: { apiKey: string; domain: string }, agentId: string, grantId?: string) {
  const { requestId, code } = await startCode(site.apiKey);
  const approved = await approveSignIn(agentId, code, site.domain, grantId);
  if (!approved.ok) throw new Error(`approve failed: ${JSON.stringify(approved)}`);
  const collected = await collect(site.apiKey, requestId);
  if (collected.status !== "approved") throw new Error(`collect failed: ${JSON.stringify(collected)}`);
  return collected as { status: "approved"; credential: string; userId: string; agentId: string };
}

export async function verify(apiKey: string, credential: string) {
  return (await api().post("/verify").set("x-assentry-api-key", apiKey).send({ credential })).body;
}

export async function profile(apiKey: string, credential: string, fields: string[]) {
  return (await api().post("/profile").set("x-assentry-api-key", apiKey).send({ credential, fields })).body;
}

export async function setDetail(userToken: string, key: string, value: unknown) {
  const res = await api()
    .put(`/me/profile/values/${encodeURIComponent(key)}`)
    .set("Authorization", `Bearer ${userToken}`)
    .send({ value });
  if (res.status !== 200) throw new Error(`set ${key} failed: ${res.status} ${JSON.stringify(res.body)}`);
}

/** Calls one of the agent connector's tools the way an AI client does (JSON-RPC over HTTP). */
export async function callTool(agentToken: string, name: string, args: Record<string, unknown>) {
  const res = await api()
    .post("/mcp")
    .set("Authorization", `Bearer ${agentToken}`)
    .set("Accept", "application/json, text/event-stream")
    .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  return res;
}

/** A minimal valid PNG (1x1 pixel). */
export const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex"
);
