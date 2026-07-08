-- CreateTable
CREATE TABLE "KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "KeyValue_expiresAt_idx" ON "KeyValue"("expiresAt");

-- Match the RLS posture of every other table: enable RLS with no policies so
-- the Supabase anon/authenticated REST roles cannot touch it. The app reaches
-- it through Prisma as the postgres role, which bypasses RLS.
ALTER TABLE "KeyValue" ENABLE ROW LEVEL SECURITY;
