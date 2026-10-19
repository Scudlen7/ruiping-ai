-- AlterTable
ALTER TABLE "teachers" ADD COLUMN "registrationCodeId" INTEGER;

-- CreateTable
CREATE TABLE "registration_codes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "registration_codes_usage_check" CHECK ("maxUses" >= 1 AND "usedCount" >= 0 AND "usedCount" <= "maxUses")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_codes_code_key" ON "registration_codes"("code");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_registrationCodeId_fkey" FOREIGN KEY ("registrationCodeId") REFERENCES "registration_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
