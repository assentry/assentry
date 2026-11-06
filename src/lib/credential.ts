import jwt from "jsonwebtoken";
import { CREDENTIAL_ALGORITHM, getActiveSigningKey, getPublicKey } from "./keys";

export const CREDENTIAL_ISSUER = "assentry";

// What an agent carries to a participating site. Public-key signed, so its
// contents are readable by anyone holding it: deliberately nothing but
// opaque pointers. No user or agent IDs (those would let sites correlate a
// person) and no personal data. The grant record stays the source of
// truth; sites always ask Assentry (/verify) rather than trusting this alone.
export interface GrantCredentialPayload {
  grantId: string;
  /** The verified domain of the one site this credential works on. */
  site: string;
  /** The sign-in it came from, if any, so the person can end that sign-in alone. */
  signInId?: string;
}

export async function issueCredential(payload: GrantCredentialPayload, expiresAt: Date): Promise<string> {
  const { kid, privateKey } = await getActiveSigningKey();
  const expiresInSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return jwt.sign(
    { gid: payload.grantId, ...(payload.signInId ? { sid: payload.signInId } : {}) },
    privateKey,
    {
      algorithm: CREDENTIAL_ALGORITHM,
      keyid: kid,
      issuer: CREDENTIAL_ISSUER,
      audience: payload.site,
      expiresIn: expiresInSeconds,
      header: { alg: CREDENTIAL_ALGORITHM, kid, typ: "assentry-credential+jwt" },
    }
  );
}

export async function decodeCredential(credential: string): Promise<GrantCredentialPayload | null> {
  try {
    const header = jwt.decode(credential, { complete: true })?.header;
    if (!header?.kid || header.alg !== CREDENTIAL_ALGORITHM || header.typ !== "assentry-credential+jwt") return null;
    const key = await getPublicKey(header.kid);
    if (!key) return null;
    const payload = jwt.verify(credential, key, {
      algorithms: [CREDENTIAL_ALGORITHM],
      issuer: CREDENTIAL_ISSUER,
    }) as jwt.JwtPayload & { gid?: unknown; sid?: unknown };
    if (typeof payload.gid !== "string" || typeof payload.aud !== "string") return null;
    return {
      grantId: payload.gid,
      site: payload.aud,
      ...(typeof payload.sid === "string" ? { signInId: payload.sid } : {}),
    };
  } catch {
    return null;
  }
}
