import { PrismaClient } from "@prisma/client";
import { seedLegalKnowledge } from "./legal-seed-data";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Auto-initialize legal knowledge base on first run
if (process.env.NODE_ENV !== "production") {
  seedLegalKnowledge(prisma).catch((error) => {
    console.error("Failed to auto-seed legal knowledge:", error);
  });
}
