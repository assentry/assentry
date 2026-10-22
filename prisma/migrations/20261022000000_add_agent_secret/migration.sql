-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "secretHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_secretHash_key" ON "Agent"("secretHash");
