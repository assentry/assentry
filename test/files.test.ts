import { beforeEach, describe, expect, it } from "vitest";
import {
  api,
  connectAgent,
  createSite,
  grantAgent,
  PNG_BYTES,
  profile,
  resetDb,
  signIn,
  signUpDeveloper,
  signUpUser,
} from "./helpers";

beforeEach(resetDb);

/** Upload path from the signed upload URL Assentry hands out. */
function uploadPath(url: string) {
  return new URL(url).pathname;
}

async function startUpload(token: string, bytes: Buffer, contentType = "image/png", fieldKey = "photo") {
  const res = await api()
    .post("/me/files")
    .set("Authorization", `Bearer ${token}`)
    .send({ fieldKey, filename: "me.png", contentType, size: bytes.length });
  return res;
}

async function upload(token: string, bytes: Buffer, contentType = "image/png") {
  const started = await startUpload(token, bytes, contentType);
  expect(started.status).toBe(201);
  const put = await api().put(uploadPath(started.body.upload.url)).set("Content-Type", contentType).send(bytes);
  expect(put.status).toBe(200);
  const done = await api().post(`/me/files/${started.body.fileId}/complete`).set("Authorization", `Bearer ${token}`);
  return { started, done };
}

describe("files", () => {
  it("accepts a real image and rejects a file pretending to be one", async () => {
    const user = await signUpUser();
    expect((await upload(user.token, PNG_BYTES)).done.status).toBe(200);
    const fake = Buffer.from("<html><script>alert(1)</script></html>");
    expect((await upload(user.token, fake)).done.status).toBe(422);
  });

  it("refuses types a detail doesn't take", async () => {
    const user = await signUpUser();
    expect((await startUpload(user.token, PNG_BYTES, "text/html")).status).toBe(400);
    expect((await startUpload(user.token, PNG_BYTES, "image/png", "email")).status).toBe(400);
  });

  it("can't be swapped for other bytes through the same upload link after it's checked", async () => {
    const user = await signUpUser();
    const { started, done } = await upload(user.token, PNG_BYTES);
    expect(done.status).toBe(200);
    const swap = Buffer.alloc(PNG_BYTES.length, 0x41);
    const again = await api().put(uploadPath(started.body.upload.url)).set("Content-Type", "image/png").send(swap);
    expect(again.status).toBe(409);
  });

  it("rejects tampered upload links and uploads that don't match what was declared", async () => {
    const user = await signUpUser();
    const started = await startUpload(user.token, PNG_BYTES);
    const path = uploadPath(started.body.upload.url);
    expect((await api().put(`${path}x`).set("Content-Type", "image/png").send(PNG_BYTES)).status).toBe(403);
    expect((await api().put(path).set("Content-Type", "image/png").send(Buffer.concat([PNG_BYTES, PNG_BYTES]))).status).toBe(400);
  });

  it("reach a site through a single-use link that only that site's key can open", async () => {
    const user = await signUpUser();
    await upload(user.token, PNG_BYTES);
    const dev = await signUpDeveloper();
    const site = await createSite(dev.token, undefined, [{ key: "photo" }]);
    const otherSite = await createSite(dev.token);
    const agent = await connectAgent(user.id);
    await grantAgent(user.token, agent.id, ["photo"]);
    const { credential } = await signIn(site, agent.id);

    const { profile: data } = await profile(site.apiKey, credential, ["photo"]);
    const path = new URL(data.photo.url).pathname;

    expect((await api().get(path)).status).toBe(401);
    expect((await api().get(path).set("x-assentry-api-key", otherSite.apiKey)).status).toBe(404);

    const download = await api().get(path).set("x-assentry-api-key", site.apiKey).buffer(true);
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(download.body as Buffer, PNG_BYTES)).toBe(0);

    expect((await api().get(path).set("x-assentry-api-key", site.apiKey)).status).toBe(404);
  });

  it("are private to their owner", async () => {
    const owner = await signUpUser();
    const { started } = await upload(owner.token, PNG_BYTES);
    const stranger = await signUpUser();
    expect((await api().get(`/me/files/${started.body.fileId}`).set("Authorization", `Bearer ${stranger.token}`)).status).toBe(404);
    expect((await api().get(`/me/files/${started.body.fileId}`).set("Authorization", `Bearer ${owner.token}`)).status).toBe(200);
  });
});
