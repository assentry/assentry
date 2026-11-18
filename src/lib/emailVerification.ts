import crypto from "crypto";
import { sendEmail } from "./mailer";
import { prisma } from "./prisma";

// The person proves they control the email address they share with sites by
// entering a six-digit code sent to it. Only an HMAC of the code is stored,
// keyed from the server secret, so a database leak doesn't expose live codes
// (and six digits can't be brute-forced offline without the key).

export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_HOUR = 5;

const codeKey = () =>
  Buffer.from(crypto.hkdfSync("sha256", process.env.JWT_SECRET!, "assentry-keys-v1", "email-verification-codes", 32));

function hashCode(verificationId: string, code: string): string {
  return crypto.createHmac("sha256", codeKey()).update(`${verificationId}:${code}`).digest("hex");
}

export function normaliseEmail(value: unknown): string | null {
  return typeof value === "string" && value.includes("@") ? value.trim().toLowerCase() : null;
}

/** The email detail the person shares with sites, if they've confirmed one. */
async function sharedEmail(userId: string): Promise<string | null> {
  const value = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key: "email" } } });
  if (!value || value.status !== "confirmed") return null;
  return normaliseEmail(value.value);
}

export async function isEmailVerified(userId: string, email: string): Promise<boolean> {
  const row = await prisma.emailVerification.findFirst({
    where: { userId, email: normaliseEmail(email) ?? "", verifiedAt: { not: null } },
    select: { id: true },
  });
  return !!row;
}

/** Whether the person's current shared email is verified (null if there isn't one). */
export async function sharedEmailStatus(userId: string): Promise<{ email: string; verified: boolean } | null> {
  const email = await sharedEmail(userId);
  if (!email) return null;
  return { email, verified: await isEmailVerified(userId, email) };
}

export type StartOutcome =
  | { ok: true; email: string; expiresAt: Date }
  | { ok: false; error: "no_email" | "already_verified" | "too_many_requests" };

export async function startEmailVerification(userId: string): Promise<StartOutcome> {
  const email = await sharedEmail(userId);
  if (!email) return { ok: false, error: "no_email" };
  if (await isEmailVerified(userId, email)) return { ok: false, error: "already_verified" };

  const recent = await prisma.emailVerification.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_SENDS_PER_HOUR) return { ok: false, error: "too_many_requests" };

  // A new code replaces any earlier one still waiting.
  await prisma.emailVerification.updateMany({
    where: { userId, verifiedAt: null, codeHash: { not: null } },
    data: { codeHash: null },
  });

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const row = await prisma.emailVerification.create({ data: { userId, email, expiresAt } });
  await prisma.emailVerification.update({ where: { id: row.id }, data: { codeHash: hashCode(row.id, code) } });

  await sendEmail({
    to: email,
    subject: "Your Assentry verification code",
    text:
      `Your code is ${code}\n\n` +
      "Enter it in Assentry to confirm this is your email address. It expires in 15 minutes.\n" +
      "If you didn't ask for this, you can ignore this email.",
  });
  await prisma.auditLog.create({
    data: { userId, action: "email_verification_sent", result: "allowed", reason: "ok", metadata: {} },
  });
  return { ok: true, email, expiresAt };
}

export type ConfirmOutcome =
  | { ok: true; email: string }
  | { ok: false; error: "no_pending_code" | "code_expired" | "too_many_attempts" | "wrong_code" | "email_changed" };

export async function confirmEmailVerification(userId: string, rawCode: string): Promise<ConfirmOutcome> {
  const pending = await prisma.emailVerification.findFirst({
    where: { userId, verifiedAt: null, codeHash: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return { ok: false, error: "no_pending_code" };
  if ((await sharedEmail(userId)) !== pending.email) {
    await prisma.emailVerification.update({ where: { id: pending.id }, data: { codeHash: null } });
    return { ok: false, error: "email_changed" };
  }
  if (pending.expiresAt.getTime() < Date.now()) return { ok: false, error: "code_expired" };
  if (pending.attempts >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  const code = String(rawCode ?? "").replace(/\D/g, "");
  const expected = Buffer.from(pending.codeHash!, "hex");
  const given = Buffer.from(hashCode(pending.id, code), "hex");
  if (code.length !== 6 || !crypto.timingSafeEqual(expected, given)) {
    // Conditional increment, so parallel guesses can't exceed the limit.
    await prisma.emailVerification.updateMany({
      where: { id: pending.id, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "wrong_code" };
  }

  const claimed = await prisma.emailVerification.updateMany({
    where: { id: pending.id, verifiedAt: null, codeHash: { not: null } },
    data: { verifiedAt: new Date(), codeHash: null },
  });
  if (claimed.count === 0) return { ok: false, error: "no_pending_code" };
  await prisma.auditLog.create({
    data: { userId, action: "email_verified", result: "allowed", reason: "ok", metadata: {} },
  });
  return { ok: true, email: pending.email };
}
