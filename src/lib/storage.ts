import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

// Where uploaded files live. S3-compatible object storage (Cloudflare R2,
// Amazon S3, …) when S3_BUCKET is set; otherwise a local folder, for
// development. Browsers upload straight to storage through a short-lived
// signed URL, so file bytes never pass through Assentry on the way in.

export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface Storage {
  kind: "s3" | "local";
  presignUpload(key: string, contentType: string, size: number, baseUrl: string): Promise<UploadTarget>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const UPLOAD_URL_TTL_SECONDS = 10 * 60;

function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return {
    kind: "s3",
    async presignUpload(key, contentType, size) {
      // Content type and exact length are part of the signature, so the
      // upload must be exactly what was declared and checked.
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(["content-type", "content-length"]) }
      );
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async read(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null;
      } catch (err) {
        if ((err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

// ---- Local development storage ----

const LOCAL_DIR = path.resolve(process.env.FILE_STORAGE_DIR || ".uploads");
const localSigningKey = Buffer.from(
  crypto.hkdfSync("sha256", process.env.JWT_SECRET!, "assentry-keys-v1", "local-upload-urls", 32)
);

function localPath(key: string): string {
  const p = path.resolve(LOCAL_DIR, key);
  if (!p.startsWith(LOCAL_DIR + path.sep)) throw new Error("bad storage key");
  return p;
}

/** Signed token standing in for a presigned URL in local development. */
export function signLocalUpload(key: string, contentType: string, size: number): string {
  const body = Buffer.from(JSON.stringify({ key, contentType, size, exp: Date.now() + UPLOAD_URL_TTL_SECONDS * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", localSigningKey).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyLocalUpload(token: string): { key: string; contentType: string; size: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", localSigningKey).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as { key: string; contentType: string; size: number; exp: number };
  return data.exp > Date.now() ? data : null;
}

export async function writeLocal(key: string, bytes: Buffer): Promise<void> {
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, bytes);
}

function localStorage(): Storage {
  return {
    kind: "local",
    async presignUpload(key, contentType, size, baseUrl) {
      return {
        url: `${baseUrl}/files/local-upload/${signLocalUpload(key, contentType, size)}`,
        method: "PUT",
        headers: { "Content-Type": contentType },
      };
    },
    async read(key) {
      try {
        return await fs.readFile(localPath(key));
      } catch {
        return null;
      }
    },
    async remove(key) {
      await fs.rm(localPath(key), { force: true });
    },
  };
}

export const storage: Storage = process.env.S3_BUCKET ? s3Storage() : localStorage();

/**
 * Checks a file's first bytes match the type it claims to be, so a renamed
 * file can't pass as a PDF or an image.
 */
export function contentMatchesType(bytes: Buffer, contentType: string): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (contentType) {
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
    case "application/pdf":
      return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
    case "application/msword":
      return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return starts(0x50, 0x4b, 0x03, 0x04);
    case "text/plain": {
      const head = bytes.subarray(0, 4096);
      return !head.includes(0) && Buffer.from(head.toString("utf8"), "utf8").length === head.length;
    }
    default:
      return false;
  }
}
