import { hash, verify } from '@node-rs/argon2';

// Argon2id with library defaults — a sensible, memory-hard configuration.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain);
}
