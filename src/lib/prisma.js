/**
 * lib/prisma.js
 * Singleton Prisma client with pg adapter — lazy instantiation for Docker build.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis;

function getPrismaClient() {
  if (!globalForPrisma.__prisma) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    globalForPrisma.__prisma = new PrismaClient({ adapter });
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
