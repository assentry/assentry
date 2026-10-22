import crypto from "crypto";

// Shared by partner API keys and agent connector keys: both are high-entropy,
// server-generated tokens (not user-chosen passwords), so a fast deterministic
// hash is appropriate and lets us look the owner up directly by hash.
export function hashSecret(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateSecret(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}
