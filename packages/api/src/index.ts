import express, { type RequestHandler } from 'express';
import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { createContext, type Context } from './context.js';

const PORT = Number(process.env.PORT ?? 4000);

function main(): void {
  const app = express();

  const yoga = createYoga({
    schema: createSchema<Context>({ typeDefs, resolvers }),
    context: createContext,
    graphqlEndpoint: '/graphql',
  });

  // Plain HTTP liveness endpoint (used by Docker / load balancers).
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Yoga handles body parsing and CORS itself, so mount it directly.
  // The cast bridges Yoga's fetch-style handler to Express's RequestHandler type.
  app.use(yoga.graphqlEndpoint, yoga as unknown as RequestHandler);

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`hesab-api ready at http://localhost:${PORT}${yoga.graphqlEndpoint}`);
  });
}

main();
