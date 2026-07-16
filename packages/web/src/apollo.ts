import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getToken } from './auth';

// Relative URI: the Vite dev proxy (and nginx in production) forward /graphql to the API.
const httpLink = createHttpLink({ uri: '/graphql' });

// Attach the JWT as a Bearer token when we have one.
const authLink = setContext((_operation, { headers }) => {
  const token = getToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

export const client = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});
