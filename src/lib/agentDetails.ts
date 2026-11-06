import { normaliseDomain } from "./domain";
import { siteKey } from "./fields";
import { prisma } from "./prisma";
import { fieldDefFor, keyKind, setValue } from "./profile";

// What an agent can do about details sites asked for: see the open requests
// for the person it acts for, and suggest values. It never reads the
// person's profile; suggestions wait for the person to confirm.

async function agentUser(agentId: string): Promise<string | null> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  return agent && !agent.revokedAt ? agent.userId : null;
}

export async function listOpenRequests(agentId: string) {
  const userId = await agentUser(agentId);
  if (!userId) return [];
  const rows = await prisma.fieldRequest.findMany({
    where: { userId, resolvedAt: null },
    include: { partner: { select: { name: true, domain: true } } },
    orderBy: { createdAt: "desc" },
  });
  const out = [];
  for (const r of rows) {
    const def = await fieldDefFor(userId, r.key);
    if (!def) continue;
    const value = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key: r.key } } });
    out.push({
      site: `${r.partner.name} (${r.partner.domain})`,
      siteDomain: r.partner.domain,
      key: keyKind(r.key) === "site" ? r.key.split(":")[2] : r.key,
      label: def.label,
      type: def.type,
      ...(def.options?.length ? { options: def.options } : {}),
      required: r.required,
      status: value?.status === "confirmed" ? "filled in, waiting for the person to allow sharing" : value?.status === "suggested" ? "suggestion waiting for the person" : "not filled in",
    });
  }
  return out;
}

export async function suggestDetail(
  agentId: string,
  key: string,
  value: unknown,
  siteDomain?: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const userId = await agentUser(agentId);
  if (!userId) return { ok: false, error: "This connection is no longer active." };

  let profileKey = key;
  if (siteDomain) {
    const domain = normaliseDomain(siteDomain);
    const field = domain
      ? await prisma.partnerField.findFirst({
          where: { key, custom: true, partner: { domain, domainVerifiedAt: { not: null }, revokedAt: null } },
        })
      : null;
    if (!field) return { ok: false, error: `${siteDomain} hasn't asked for a detail called ${key}.` };
    profileKey = siteKey(field.partnerId, key);
  } else if (keyKind(key) !== "standard") {
    return { ok: false, error: "Use the key and siteDomain exactly as listed by list_requested_details." };
  }

  // Agents may only fill in what a site has actually asked this person for.
  const asked = await prisma.fieldRequest.findFirst({ where: { userId, key: profileKey, resolvedAt: null } });
  if (!asked) return { ok: false, error: "No site is waiting on that detail. Check list_requested_details." };

  const result = await setValue(userId, profileKey, value, { source: "agent", agentId });
  if (!result.ok) return { ok: false, error: `Not saved: ${result.error}.` };

  const saved = await prisma.profileValue.findUnique({ where: { userId_key: { userId, key: profileKey } } });
  await prisma.auditLog.create({
    data: {
      userId,
      agentId,
      partnerId: asked.partnerId,
      action: "detail_suggested",
      result: "allowed",
      reason: saved?.status === "confirmed" ? "auto_filled" : "awaiting_confirmation",
      metadata: { key: profileKey },
    },
  });
  return {
    ok: true,
    message:
      saved?.status === "confirmed"
        ? "Saved. The person lets you fill in details, so it's available to the site now."
        : "Saved as a suggestion. The person will confirm it in the Assentry app before any site sees it.",
  };
}

export { fieldDefFor };
