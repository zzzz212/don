-- Workspaces (Organization + Membership + Invite). Existing per-user data
-- stays valid because every new orgId column is nullable; the lazy
-- ensureActiveOrg() helper backfills each user on their first authenticated
-- request post-deploy.

-- 1. User.activeOrgId — current workspace context.
ALTER TABLE "User" ADD COLUMN "activeOrgId" TEXT;

-- 2. Organization
CREATE TABLE "Organization" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "plan"      TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- 3. Membership
CREATE TABLE "Membership" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "userId"    TEXT NOT NULL,
    "orgId"     TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Membership_userId_orgId_key"
  ON "Membership"("userId", "orgId");
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- 4. Invite (shareable link, no email integration yet)
CREATE TABLE "Invite" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "orgId"      TEXT NOT NULL,
    "email"      TEXT,
    "role"       TEXT NOT NULL DEFAULT 'MEMBER',
    "token"      TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdBy"  TEXT,
    CONSTRAINT "Invite_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");
CREATE INDEX "Invite_token_idx" ON "Invite"("token");

-- 5. orgId on each shared model (all nullable).
ALTER TABLE "Document"          ADD COLUMN "orgId" TEXT;
ALTER TABLE "GeneratedDocument" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Chat"              ADD COLUMN "orgId" TEXT;
ALTER TABLE "AiUsage"           ADD COLUMN "orgId" TEXT;
ALTER TABLE "CounterpartyCheck" ADD COLUMN "orgId" TEXT;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument"
  ADD CONSTRAINT "GeneratedDocument_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsage"
  ADD CONSTRAINT "AiUsage_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CounterpartyCheck"
  ADD CONSTRAINT "CounterpartyCheck_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Document_orgId_idx"          ON "Document"("orgId");
CREATE INDEX "GeneratedDocument_orgId_idx" ON "GeneratedDocument"("orgId");
CREATE INDEX "Chat_orgId_idx"              ON "Chat"("orgId");
CREATE INDEX "AiUsage_orgId_createdAt_idx" ON "AiUsage"("orgId", "createdAt");
CREATE INDEX "AiUsage_orgId_feature_idx"   ON "AiUsage"("orgId", "feature");
CREATE INDEX "CounterpartyCheck_orgId_idx" ON "CounterpartyCheck"("orgId");

-- 6. CounterpartyCheck dedup moves from (userId, inn) → (orgId, inn) so the
-- same INN re-checked by another team member doesn't violate uniqueness.
-- Drop the old index first; the new one is created up where orgId was added.
ALTER TABLE "CounterpartyCheck" DROP CONSTRAINT IF EXISTS "CounterpartyCheck_userId_inn_key";
DROP INDEX IF EXISTS "CounterpartyCheck_userId_inn_key";
-- The new (orgId, inn) unique constraint will be created later when every
-- existing CounterpartyCheck row has an orgId. Until then, having no unique
-- constraint is acceptable: anonymous / pre-migration rows just can't dedup.
-- The application code uses upsert-by-(orgId, inn) once orgId is set.
