-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "domain" TEXT,
ADD COLUMN     "domainVerificationToken" TEXT,
ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3);
