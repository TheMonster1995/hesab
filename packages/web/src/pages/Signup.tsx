import { useState, type FormEvent } from 'react';
import { gql, useMutation } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { setToken } from '../auth';
import { Screen, Card, Eyebrow, Field, TextInput, Button, FormError } from '../ui';

const SIGNUP = gql`
  mutation Signup($email: String!, $password: String!, $name: String!) {
    signup(email: $email, password: $password, name: $name) {
      token
      user {
        id
        name
      }
    }
  }
`;

export function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, { loading, error }] = useMutation(SIGNUP);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await signup({ variables: { email, password, name } });
      setToken(res.data.signup.token);
      navigate('/');
    } catch {
      // error is surfaced via the `error` object below
    }
  }

  return (
    <Screen>
      <Card className="max-w-sm">
        <Eyebrow>hesab &middot; create account</Eyebrow>
        <h1 className="mt-2 font-serif text-3xl">Join the ledger</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="Name">
            <TextInput
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted">At least 8 characters.</p>
          <FormError message={error?.message} />
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </Screen>
  );
}
