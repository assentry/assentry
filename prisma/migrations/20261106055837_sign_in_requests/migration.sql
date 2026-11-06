-- AlterTable
ALTER TABLE "OAuthClient" ALTER COLUMN "redirectUris" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SignInRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "grantId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignInRequest_code_key" ON "SignInRequest"("code");

-- AddForeignKey
ALTER TABLE "SignInRequest" ADD CONSTRAINT "SignInRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInRequest" ADD CONSTRAINT "SignInRequest_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
