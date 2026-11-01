import crypto from "crypto";
import "dotenv/config";
import { hashApiKey } from "../src/lib/partnerAuth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const name = process.argv[2] ?? "Demo Job Board";
  const apiKey = `hapi_${crypto.randomBytes(24).toString("hex")}`;

  const linkRedirectUri = process.argv[3] ?? "http://localhost:4100/link/callback";

  const partner = await prisma.partner.create({
    data: {
      name,
      apiKeyHash: hashApiKey(apiKey),
      allowedScopes: ["job_application:submit"],
      linkRedirectUris: [linkRedirectUri],
    },
  });

  console.log(`Created partner "${partner.name}" (${partner.id})`);
  console.log(`Public id (safe to put in a /link/authorize URL): ${partner.publicId}`);
  console.log(`API key (shown once — store it now):\n${apiKey}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
