-- Sign-in requests are short-lived (5 minutes); clear any in flight so the
-- plain-text code column can be replaced by its hash.
DELETE FROM "SignInRequest";

-- DropIndex
DROP INDEX "SignInRequest_code_key";

-- AlterTable
ALTER TABLE "SignInRequest" DROP COLUMN "code",
ADD COLUMN     "codeHash" TEXT NOT NULL,
ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "SignInRequest_codeHash_key" ON "SignInRequest"("codeHash");
CREATE INDEX "SignInRequest_grantId_idx" ON "SignInRequest"("grantId");

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "declaredFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SigningKey" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "publicJwk" JSONB NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "SigningKey_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OAuthAuthorizationCode" ADD COLUMN     "replacesAgentId" TEXT;
