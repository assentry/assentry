import crypto from "crypto";
import { prisma } from "./prisma";

// Every kind of token gets its own key, so one can never be accepted as
// another and a leak of one doesn't expose the rest. Session keys are
// derived from JWT_SECRET (HKDF) with a distinct label each, so no new
// secrets need configuring.
const ROOT_SECRET = process.env.JWT_SECRET!;

function deriveKey(label: string): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", ROOT_SECRET, "assentry-keys-v1", label, 32));
}

export const sessionKeys = {
  user: deriveKey("user-session"),
  developer: deriveKey("developer-session"),
  oauthBrowser: deriveKey("oauth-browser-session"),
} as const;

// ---- Agent credentials: public-key signed (ES256) ----

export const CREDENTIAL_ALGORITHM = "ES256";
const keyEncryptionKey = deriveKey("credential-signing-key-encryption");

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyEncryptionKey, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function decrypt(packed: string): string {
  const [iv, tag, body] = packed.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyEncryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

interface ActiveKey {
  kid: string;
  privateKey: crypto.KeyObject;
}

let active: Promise<ActiveKey> | null = null;
const publicKeys = new Map<string, crypto.KeyObject>();

async function loadOrCreateActiveKey(): Promise<ActiveKey> {
  let row = await prisma.signingKey.findFirst({ where: { retiredAt: null }, orderBy: { createdAt: "desc" } });
  if (!row) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = crypto.randomBytes(12).toString("base64url");
    const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: CREDENTIAL_ALGORITHM, use: "sig" };
    try {
      row = await prisma.signingKey.create({
        data: {
          id: kid,
          algorithm: CREDENTIAL_ALGORITHM,
          publicJwk: jwk,
          privateKeyEncrypted: encrypt(privateKey.export({ format: "pem", type: "pkcs8" }).toString()),
        },
      });
    } catch {
      // Another instance created one at the same moment: use theirs.
      row = await prisma.signingKey.findFirstOrThrow({ where: { retiredAt: null }, orderBy: { createdAt: "desc" } });
    }
  }
  return { kid: row.id, privateKey: crypto.createPrivateKey(decrypt(row.privateKeyEncrypted)) };
}

export function getActiveSigningKey(): Promise<ActiveKey> {
  if (!active) {
    active = loadOrCreateActiveKey();
    active.catch(() => (active = null));
  }
  return active;
}

/** Public key for a credential's kid, including retired keys (until their credentials expire). */
export async function getPublicKey(kid: string): Promise<crypto.KeyObject | null> {
  const cached = publicKeys.get(kid);
  if (cached) return cached;
  const row = await prisma.signingKey.findUnique({ where: { id: kid } });
  if (!row) return null;
  const key = crypto.createPublicKey({ key: row.publicJwk as crypto.JsonWebKey, format: "jwk" });
  publicKeys.set(kid, key);
  return key;
}

/** The JWK Set published at /.well-known/jwks.json. */
export async function getJwks() {
  await getActiveSigningKey(); // make sure there is at least one key
  const rows = await prisma.signingKey.findMany({ orderBy: { createdAt: "desc" } });
  return { keys: rows.map((r) => r.publicJwk) };
}
