import { PrismaClient } from '@prisma/client';

// A single shared client for the process. Prisma connects lazily on first query,
// so importing this does not require the database to be reachable at boot.
export const prisma = new PrismaClient();
