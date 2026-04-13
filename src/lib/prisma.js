/**
 * lib/prisma.js
 * Singleton Prisma client — lazy instantiation to survive Docker build
 * where DATABASE_URL is a dummy placeholder.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function getPrismaClient() {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = new PrismaClient();
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
