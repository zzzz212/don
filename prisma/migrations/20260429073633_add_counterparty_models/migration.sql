-- CreateTable
CREATE TABLE "CounterpartyProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationType" TEXT,
    "registrationDate" DATETIME,
    "address" TEXT,
    "okved" TEXT,
    "capitalSize" INTEGER,
    "statusCode" TEXT,
    "activeLawsuits" INTEGER NOT NULL DEFAULT 0,
    "completedLawsuits" INTEGER NOT NULL DEFAULT 0,
    "lossesCount" INTEGER NOT NULL DEFAULT 0,
    "debtFound" BOOLEAN NOT NULL DEFAULT false,
    "debtAmount" BIGINT,
    "debtSources" TEXT NOT NULL DEFAULT '',
    "riskScore" INTEGER NOT NULL DEFAULT 50,
    "riskLevel" TEXT NOT NULL DEFAULT 'medium',
    "riskFactors" TEXT NOT NULL DEFAULT '',
    "lastUpdated" DATETIME NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'egrul',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CounterpartyCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CounterpartyCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CounterpartyCheck_inn_fkey" FOREIGN KEY ("inn") REFERENCES "CounterpartyProfile" ("inn") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CounterpartyProfile_inn_key" ON "CounterpartyProfile"("inn");

-- CreateIndex
CREATE INDEX "CounterpartyProfile_inn_idx" ON "CounterpartyProfile"("inn");

-- CreateIndex
CREATE INDEX "CounterpartyCheck_userId_idx" ON "CounterpartyCheck"("userId");

-- CreateIndex
CREATE INDEX "CounterpartyCheck_inn_idx" ON "CounterpartyCheck"("inn");
