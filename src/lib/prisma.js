/**
 * lib/prisma.js
 * Singleton Prisma client using the pg driver adapter (Prisma 7 pattern).
 * Uses dynamic imports so the pg pool is not created at build time.
 */

const globalForPrisma = globalThis;

async function createPrismaClient() {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const pkg = await import("pg");
  const { Pool } = pkg.default || pkg;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let clientPromise = null;

function getClient() {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;
  if (!clientPromise) {
    clientPromise = createPrismaClient().then((client) => {
      globalForPrisma.__prisma = client;
      return client;
    });
  }
  return clientPromise;
}

// Create a proxy that awaits the client on every property access
const prisma = new Proxy({}, {
  get(_target, prop) {
    const client = getClient();
    // If client is a promise, return a proxy that awaits it
    if (client instanceof Promise) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return client[prop].bind(client);
      }
      // For model access like prisma.session.findUnique(...)
      // Return an object whose methods await the client first
      return new Proxy({}, {
        get(_t, method) {
          return async (...args) => {
            const resolved = await client;
            return resolved[prop][method](...args);
          };
        },
      });
    }
    return client[prop];
  },
});

export default prisma;
