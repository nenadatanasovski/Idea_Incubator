/**
 * Prisma Client Wrapper
 * 
 * Provides Prisma ORM access to the SQLite database.
 * Can coexist with the raw SQL approach in db.ts during migration.
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get Prisma client instance (singleton)
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

/**
 * Disconnect Prisma client (for cleanup)
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// Re-export PrismaClient type for convenience
export { PrismaClient };

// Export typed client instance for direct import
export const db = getPrisma();
