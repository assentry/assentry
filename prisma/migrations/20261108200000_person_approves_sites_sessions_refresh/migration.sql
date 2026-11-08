-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "oauthClientId" TEXT,
ADD COLUMN     "refreshExpiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshHash" TEXT;

-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SiteApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "agentId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allowedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),

    CONSTRAINT "SiteApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteApproval_userId_partnerId_key" ON "SiteApproval"("userId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_refreshHash_key" ON "Agent"("refreshHash");

-- AddForeignKey
ALTER TABLE "SiteApproval" ADD CONSTRAINT "SiteApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteApproval" ADD CONSTRAINT "SiteApproval_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sites a person's agents already signed in to (or got credentials for)
-- count as allowed, so nothing that works today stops working.
INSERT INTO "SiteApproval" ("id", "userId", "partnerId", "requestedAt", "allowedAt")
SELECT gen_random_uuid()::text, "userId", "partnerId", MIN("createdAt"), MIN("createdAt")
FROM "AuditLog"
WHERE "result" = 'allowed'
  AND "action" IN ('sign_in_collected', 'credential_issued')
  AND "userId" IS NOT NULL
  AND "partnerId" IS NOT NULL
GROUP BY "userId", "partnerId"
ON CONFLICT DO NOTHING;

-- Connections made before tokens expired keep working for 30 days, then the
-- AI app asks the person to reconnect once.
UPDATE "Agent" SET "accessExpiresAt" = NOW() + INTERVAL '30 days'
WHERE "secretHash" IS NOT NULL AND "revokedAt" IS NULL;
