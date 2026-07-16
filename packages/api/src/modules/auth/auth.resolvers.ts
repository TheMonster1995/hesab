import { GraphQLError } from 'graphql';
import type { User } from '@prisma/client';
import type { Context } from '../../context.js';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { signToken } from '../../auth/jwt.js';
import { requireUserId } from '../../auth/guards.js';

// Shape a DB user into the public GraphQL User (never leak passwordHash).
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
  };
}

interface SignupArgs {
  email: string;
  password: string;
  name: string;
}
interface LoginArgs {
  email: string;
  password: string;
}

export const authResolvers = {
  Query: {
    me: async (_p: unknown, _a: unknown, ctx: Context) => {
      if (!ctx.userId) return null;
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
      return user ? publicUser(user) : null;
    },
  },
  Mutation: {
    signup: async (_p: unknown, args: SignupArgs, ctx: Context) => {
      const email = args.email.trim().toLowerCase();
      const name = args.name.trim();
      if (!email || !name) {
        throw new GraphQLError('Email and name are required.');
      }
      if (args.password.length < 8) {
        throw new GraphQLError('Password must be at least 8 characters.');
      }

      const existing = await ctx.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new GraphQLError('An account with that email already exists.');
      }

      const user = await ctx.prisma.user.create({
        data: { email, name, passwordHash: await hashPassword(args.password) },
      });
      return { token: signToken(user.id), user: publicUser(user) };
    },

    login: async (_p: unknown, args: LoginArgs, ctx: Context) => {
      const email = args.email.trim().toLowerCase();
      const user = await ctx.prisma.user.findUnique({ where: { email } });
      // Same message whether the email is unknown or the password is wrong.
      if (!user || !(await verifyPassword(user.passwordHash, args.password))) {
        throw new GraphQLError('Invalid email or password.');
      }
      return { token: signToken(user.id), user: publicUser(user) };
    },

    logout: async (_p: unknown, _a: unknown, ctx: Context) => {
      // Stateless JWT: the client discards the token. This mutation exists for
      // API completeness and as the hook for future server-side revocation.
      requireUserId(ctx);
      return true;
    },
  },
};
