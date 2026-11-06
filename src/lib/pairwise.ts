import crypto from "crypto";

// Sites never see Assentry's internal user or agent IDs. Each gets its own
// stable ID for a person (and for an agent): the same on every visit and
// across one developer's apps (e.g. staging and live), different for every
// other developer, so two sites can't compare notes and link a person.
const key = Buffer.from(
  crypto.hkdfSync("sha256", process.env.JWT_SECRET!, "assentry-keys-v1", "pairwise-ids", 32)
);

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 32 symbols, 5 bits each

function encode(digest: Buffer, length: number): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < length) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

/** Who counts as "the same site" for IDs: the owning developer, else the app itself. */
export function sectorFor(partner: { id: string; developerId: string | null }): string {
  return partner.developerId ? `developer:${partner.developerId}` : `partner:${partner.id}`;
}

function pairwise(kind: string, internalId: string, sector: string): string {
  return encode(crypto.createHmac("sha256", key).update(`${kind}\0${internalId}\0${sector}`).digest(), 26);
}

export function pairwiseUserId(userId: string, partner: { id: string; developerId: string | null }): string {
  return `usr_${pairwise("user", userId, sectorFor(partner))}`;
}

export function pairwiseAgentId(agentId: string, partner: { id: string; developerId: string | null }): string {
  return `agt_${pairwise("agent", agentId, sectorFor(partner))}`;
}
