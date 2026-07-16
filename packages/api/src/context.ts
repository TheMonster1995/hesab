import type { YogaInitialContext } from 'graphql-yoga';
import { prisma } from './prisma.js';
import { verifyToken } from './auth/jwt.js';

export interface Context {
  prisma: typeof prisma;
  // Populated from a verified JWT. Null means an unauthenticated request.
  userId: string | null;
}

export async function createContext(initial: YogaInitialContext): Promise<Context> {
  const header = initial.request.headers.get('authorization');
  let userId: string | null = null;

  if (header?.startsWith('Bearer ')) {
    const payload = verifyToken(header.slice('Bearer '.length));
    userId = payload?.userId ?? null;
  }

  return { prisma, userId };
}
