// Integration test for Phase 1 auth against a running API (default :4100).
const ENDPOINT = process.env.ENDPOINT || 'http://localhost:4100/graphql';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`);
  }
}

async function gql(query, variables, token) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const email = `alice_${Math.floor(Math.random() * 1e9)}@example.com`;
const password = 'correcthorse';

console.log('Phase 1 — auth integration test');

// 1. signup
const signup = await gql(
  `mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token user{ id email name } } }`,
  { e: email, p: password, n: 'Alice' },
);
const token = signup.data?.signup?.token;
check('signup returns a token', typeof token === 'string' && token.length > 20);
check('signup returns the user with normalized email', signup.data?.signup?.user?.email === email);

// 2. me without token -> null
const meAnon = await gql(`{ me { id } }`);
check('me is null when unauthenticated', meAnon.data?.me === null);

// 3. me with token -> the user
const meAuth = await gql(`{ me { id email name } }`, {}, token);
check('me returns the user when authenticated', meAuth.data?.me?.email === email);

// 4. duplicate signup -> error
const dup = await gql(
  `mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token } }`,
  { e: email, p: password, n: 'Alice2' },
);
check('duplicate email is rejected', Array.isArray(dup.errors) && dup.errors.length > 0);

// 5. login with correct password
const login = await gql(
  `mutation($e:String!,$p:String!){ login(email:$e,password:$p){ token user{ email } } }`,
  { e: email, p: password },
);
check('login succeeds with correct password', typeof login.data?.login?.token === 'string');

// 6. login with wrong password -> error
const bad = await gql(
  `mutation($e:String!,$p:String!){ login(email:$e,password:$p){ token } }`,
  { e: email, p: 'wrongpassword' },
);
check('login fails with wrong password', Array.isArray(bad.errors) && bad.errors.length > 0);

// 7. short password rejected
const short = await gql(
  `mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token } }`,
  { e: `bob_${Math.floor(Math.random() * 1e9)}@example.com`, p: 'short', n: 'Bob' },
);
check('password under 8 chars is rejected', Array.isArray(short.errors) && short.errors.length > 0);

// 8. logout requires auth
const logoutAnon = await gql(`mutation{ logout }`);
check('logout requires authentication', Array.isArray(logoutAnon.errors) && logoutAnon.errors.length > 0);
const logoutAuth = await gql(`mutation{ logout }`, {}, token);
check('logout returns true when authenticated', logoutAuth.data?.logout === true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
