import { useState, type FormEvent } from 'react';
import { gql, useMutation } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { setToken } from '../auth';
import { Screen, Card, Eyebrow, Field, TextInput, Button, FormError } from '../ui';

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
      }
    }
  }
`;

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { loading, error }] = useMutation(LOGIN);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await login({ variables: { email, password } });
      setToken(res.data.login.token);
      navigate('/');
    } catch {
      // error is surfaced via the `error` object below
    }
  }

  return (
    <Screen>
      <Card className="max-w-sm">
        <Eyebrow>hesab &middot; sign in</Eyebrow>
        <h1 className="mt-2 font-serif text-3xl">Welcome back</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="Email">
            <TextInput
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <FormError message={error?.message} />
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          New here?{' '}
          <Link to="/signup" className="text-accent underline-offset-2 hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </Screen>
  );
}
