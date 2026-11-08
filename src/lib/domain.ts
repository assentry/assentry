import dns from "dns/promises";
import net from "net";
import { generateSecret } from "./secrets";
import { prisma } from "./prisma";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Local hosts are only accepted when Assentry itself runs locally, so the
// live server never fetches from its own machine.
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL || process.env.RENDER);

/**
 * Turns whatever a developer typed ("https://Shop.Example.com/login",
 * "shop.example.com") into a bare lowercase hostname. A port is kept only
 * for local development hosts. Returns null if it isn't a usable domain.
 */
export function normaliseDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (LOCAL_HOSTS.has(host)) return isProduction ? null : url.port ? `${host}:${url.port}` : host;
  // Real domains only: no IP addresses, at least one dot, sensible labels.
  if (/^\d+(\.\d+){3}$/.test(host) || host.includes(":")) return null;
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(host)) return null;
  return host;
}

export function newVerificationToken(): string {
  return generateSecret("assentry-domain");
}

export const VERIFICATION_PATH = "/.well-known/assentry-domain-verification";

export type VerifyDomainOutcome =
  | { ok: true; verifiedAt: Date }
  | { ok: false; error: "no_domain" | "taken" | "unreachable" | "token_mismatch"; detail?: string };

/**
 * Checks the developer controls the app's domain: the site (via the SDK)
 * must serve this app's token at VERIFICATION_PATH. A verified domain can
 * belong to only one developer account.
 */
export async function verifyPartnerDomain(partnerId: string): Promise<VerifyDomainOutcome> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner?.domain || !partner.domainVerificationToken) return { ok: false, error: "no_domain" };

  const takenBy = await prisma.partner.findFirst({
    where: {
      domain: partner.domain,
      domainVerifiedAt: { not: null },
      id: { not: partner.id },
      revokedAt: null,
      NOT: { developerId: partner.developerId },
    },
  });
  if (takenBy) return { ok: false, error: "taken" };

  const host = partner.domain.split(":")[0];
  const scheme = LOCAL_HOSTS.has(host) ? "http" : "https";
  if (!LOCAL_HOSTS.has(host) && !(await resolvesToPublicAddress(host))) {
    return { ok: false, error: "unreachable", detail: "the domain doesn't point to a public address" };
  }
  let body: string;
  try {
    const res = await fetch(`${scheme}://${partner.domain}${VERIFICATION_PATH}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Assentry-Domain-Verification/1" },
    });
    if (!res.ok) return { ok: false, error: "unreachable", detail: `the site answered ${res.status}` };
    body = (await readCapped(res, 1024)).trim();
  } catch (err) {
    return { ok: false, error: "unreachable", detail: err instanceof Error ? err.message : String(err) };
  }
  if (body !== partner.domainVerificationToken) return { ok: false, error: "token_mismatch" };

  const updated = await prisma.partner.update({
    where: { id: partner.id },
    data: { domainVerifiedAt: new Date() },
  });
  return { ok: true, verifiedAt: updated.domainVerifiedAt! };
}

/** Reads at most `max` bytes of a response body, however much the site sends. */
async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).subarray(0, max).toString("utf8");
}

/** True only if every address the name resolves to is on the public internet. */
async function resolvesToPublicAddress(host: string): Promise<boolean> {
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return false;
  }
  return addresses.length > 0 && addresses.every(({ address }) => isPublicAddress(address));
}

export function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPublicAddress(v6.slice(7));
  return !(v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff"));
}
