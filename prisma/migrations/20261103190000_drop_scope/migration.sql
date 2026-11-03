-- Drop the scope/action concept for now — a valid grant authorises an
-- agent to act for a person, full stop; the only remaining restriction is
-- which profile fields it may disclose (Grant.consentedFields).

-- AlterTable
ALTER TABLE "Grant" DROP COLUMN "scope";

-- AlterTable
ALTER TABLE "Partner" DROP COLUMN "allowedScopes";
