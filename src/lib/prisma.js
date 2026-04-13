/**
 * lib/prisma.js
 * Singleton Prisma client using the pg driver adapter (Prisma 7 pattern).
 * Lazy initialization — the pool is only created when first accessed at runtime,
 * so the build step (which has a dummy DATABASE_URL) won't fail.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";

const { Pool } = pkg;

const globalForPrisma = globalThis;

function createPrismaClient() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("dummy")) {
    throw new Error("DATABASE_URL is not configured. Set it in .env.production");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// Lazy proxy — PrismaClient is only instantiated on first property access at runtime
const prisma = globalForPrisma.prisma ?? new Proxy({}, {
  get(_target, prop) {
    if (!globalForPrisma.__prismaInstance) {
      globalForPrisma.__prismaInstance = createPrismaClient();
    }
    return globalForPrisma.__prismaInstance[prop];
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
