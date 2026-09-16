import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient per process. Next.js dev-mode module reloading would
 * otherwise open a new connection pool on every edit.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Either the root client or an open interactive transaction. */
export type DbClient = PrismaClient | Tx;
