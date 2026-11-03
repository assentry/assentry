-- Separate developer accounts that own partner apps and manage their keys
-- from the developer console.

-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Developer_email_key" ON "Developer"("email");

-- AlterTable: nullable so existing, owner-less partners are untouched.
ALTER TABLE "Partner" ADD COLUMN "developerId" TEXT;
ALTER TABLE "Partner" ADD COLUMN "apiKeyPreview" TEXT;
ALTER TABLE "Partner" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
