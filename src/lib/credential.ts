import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

// What an agent actually carries and presents to a partner site. Deliberately
// minimal — no PII. It is a pointer + proof, not a data payload: the grant
// record in the database remains the source of truth for validity, and
// profile data is pulled separately through /profile, scoped per-request.
export interface GrantCredentialPayload {
  grantId: string;
  userId: string;
  agentId: string;
}

export function issueCredential(
  payload: GrantCredentialPayload,
  expiresAt: Date
): string {
  const expiresInSeconds = Math.max(
    1,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function decodeCredential(
  credential: string
): GrantCredentialPayload | null {
  try {
    return jwt.verify(credential, JWT_SECRET) as GrantCredentialPayload &
      jwt.JwtPayload;
  } catch {
    return null;
  }
}
