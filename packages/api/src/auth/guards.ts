import { GraphQLError } from 'graphql';
import type { Context } from '../context.js';

// Throws a well-formed GraphQL error if the request is unauthenticated,
// otherwise returns the authenticated user's id.
export function requireUserId(ctx: Context): string {
  if (!ctx.userId) {
    throw new GraphQLError('You must be signed in to do that.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.userId;
}
