import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production.');
}

// Fall back to an obviously-insecure secret in dev so the app still boots.
const EFFECTIVE_SECRET = SECRET ?? 'dev-insecure-secret-change-me';

export interface TokenPayload {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, EFFECTIVE_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_SECRET) as jwt.JwtPayload;
    if (typeof decoded.userId === 'string') {
      return { userId: decoded.userId };
    }
    return null;
  } catch {
    return null;
  }
}
