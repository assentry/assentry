-- AlterTable: add a safe-to-expose public identifier, backfilled for
-- existing rows via Postgres's built-in gen_random_uuid() (core since PG13),
-- then drop the DB-level default so new rows get theirs from Prisma Client,
-- consistent with how "id" columns already work in this schema.
ALTER TABLE "Partner" ADD COLUMN "publicId" TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "Partner" ALTER COLUMN "publicId" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Partner_publicId_key" ON "Partner"("publicId");

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN "linkRedirectUris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AccountLinkCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountLinkCode_code_key" ON "AccountLinkCode"("code");

-- AddForeignKey
ALTER TABLE "AccountLinkCode" ADD CONSTRAINT "AccountLinkCode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
