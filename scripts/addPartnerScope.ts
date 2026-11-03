import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Additive, idempotent one-off: adds a scope to every partner's
// allowedScopes if it isn't already there. Never removes anything.
// Needed whenever a partner integration starts using a new scope name —
// e.g. demo-job-board's /dashboard moving off "job_application:submit"
// onto its own "dashboard:read" scope.
async function main() {
  const scope = process.argv[2];
  if (!scope) {
    console.error("Usage: npm run add-scope -- <scope>");
    process.exitCode = 1;
    return;
  }

  const partners = await prisma.partner.findMany();
  for (const partner of partners) {
    if (partner.allowedScopes.includes(scope)) {
      console.log(`"${partner.name}" already allows "${scope}" — skipped`);
      continue;
    }
    await prisma.partner.update({
      where: { id: partner.id },
      data: { allowedScopes: { push: scope } },
    });
    console.log(`Added "${scope}" to "${partner.name}"`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
