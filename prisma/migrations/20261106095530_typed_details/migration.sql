-- CreateTable
CREATE TABLE "ProfileValue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'person',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "agentId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserField" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FieldRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT,
    "storageKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileDownloadToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileDownloadToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerField" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "type" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileValue_userId_key_key" ON "ProfileValue"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "UserField_userId_key_key" ON "UserField"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FieldRequest_userId_partnerId_key_key" ON "FieldRequest"("userId", "partnerId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "FileDownloadToken_tokenHash_key" ON "FileDownloadToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerField_partnerId_key_key" ON "PartnerField"("partnerId", "key");

-- AddForeignKey
ALTER TABLE "ProfileValue" ADD CONSTRAINT "ProfileValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserField" ADD CONSTRAINT "UserField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldRequest" ADD CONSTRAINT "FieldRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldRequest" ADD CONSTRAINT "FieldRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileDownloadToken" ADD CONSTRAINT "FileDownloadToken_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerField" ADD CONSTRAINT "PartnerField_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- Carry existing data over before dropping the old columns ----

ALTER TABLE "User" ADD COLUMN "agentAutoFill" BOOLEAN NOT NULL DEFAULT false;

-- Profile details: plain text values become typed values. Address text goes
-- into the formatted line of the new structured address; CV text (CV is now
-- a file) is kept as the person's own detail "CV (text)".
INSERT INTO "ProfileValue" ("id", "userId", "key", "value", "updatedAt")
SELECT gen_random_uuid()::text, u."id",
       CASE WHEN p.key = 'resume' THEN 'my:resume_text' ELSE p.key END,
       CASE WHEN p.key = 'address' THEN jsonb_build_object('formatted', p.value) ELSE to_jsonb(p.value) END,
       CURRENT_TIMESTAMP
FROM "User" u, jsonb_each_text(u."profile") AS p(key, value)
WHERE p.value <> '';

INSERT INTO "UserField" ("id", "userId", "key", "label", "type")
SELECT gen_random_uuid()::text, u."id", 'my:resume_text', 'CV (text)', 'long_text'
FROM "User" u
WHERE COALESCE(u."profile"->>'resume', '') <> '';

-- Site declarations: every previously ticked detail becomes an optional one.
INSERT INTO "PartnerField" ("id", "partnerId", "key")
SELECT gen_random_uuid()::text, pt."id", f.key
FROM "Partner" pt, unnest(pt."declaredFields") AS f(key);

ALTER TABLE "Partner" DROP COLUMN "declaredFields";
ALTER TABLE "User" DROP COLUMN "profile";
