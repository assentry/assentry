// Sends Assentry's own transactional email (verification codes). Uses Resend's
// HTTP API when RESEND_API_KEY and EMAIL_FROM are set. Without them, outside
// production, messages are logged instead of sent, and tests read them from
// `sentEmails`. In production a missing configuration is an error, never a
// silent skip.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

/** Messages "sent" without a provider (development and tests only). */
export const sentEmails: OutgoingEmail[] = [];

export class EmailNotConfiguredError extends Error {}
export class EmailSendError extends Error {}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") throw new EmailNotConfiguredError("email sending is not configured");
    sentEmails.push(message);
    if (process.env.NODE_ENV !== "test") console.log(`[email] to ${message.to}: ${message.subject}\n${message.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!res.ok) throw new EmailSendError(`email provider answered ${res.status}`);
}
