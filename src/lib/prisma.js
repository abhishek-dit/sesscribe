/**
 * lib/prisma.js
 * Singleton Prisma client — lazy instantiation to survive Docker build.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function getPrismaClient() {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
    });
  }
  return globalForPrisma.__prisma;
}

// Proxy that lazily creates PrismaClient on first model access
const prisma = new Proxy({}, {
  get(_target, prop) {
    return getPrismaClient()[prop];
  },
});

export default prisma;
