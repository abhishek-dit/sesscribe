/**
 * lib/prisma.js
 * Singleton Prisma client with pg adapter for production,
 * standard client for build-time / environments without pg.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
  // During Docker build, DATABASE_URL is a dummy — just return a basic client
  // that won't actually connect (routes aren't called at build time)
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("dummy")) {
    return new PrismaClient();
  }

  // At runtime, use the pg adapter for connection pooling
  try {
    const pg = require("pg");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch {
    // Fallback to standard client if pg adapter fails
    return new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  }
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
