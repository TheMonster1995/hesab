// Integration test for Phase 6 API: search, change log, share links.
const ENDPOINT = process.env.ENDPOINT || 'http://localhost:4100/graphql';
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}
async function gql(query, variables, token) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
const rnd = () => Math.floor(Math.random() * 1e9);
async function newUser(n) {
  const r = await gql(`mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token } }`, { e: `${n}_${rnd()}@x.com`, p: 'correcthorse', n });
  return r.data.signup.token;
}

console.log('Phase 6 — polish integration test');

const alice = await newUser('Alice');
const bob = await newUser('Bob');
const cg = await gql(`mutation($n:String!){ createGroup(name:$n,baseCurrency:"EUR"){ id members { id isYou } } }`, { n: 'Polish' }, alice);
const gid = cg.data.createGroup.id;
const aM = cg.data.createGroup.members.find((m) => m.isYou).id;
const bM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: gid, n: 'Bob' }, alice)).data.addMember.id;

const ADD = `mutation($g:ID!,$d:String!,$a:Int!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:$d,amount:$a,paidById:$p,splitMode:EQUAL,splits:$s){ id } }`;
const both = [{ membershipId: aM }, { membershipId: bM }];
await gql(ADD, { g: gid, d: 'Dinner', a: 3000, p: aM, s: both }, alice);
await gql(ADD, { g: gid, d: 'Taxi', a: 1000, p: bM, s: both }, alice);
await gql(ADD, { g: gid, d: 'Groceries', a: 2000, p: aM, s: [{ membershipId: aM }] }, alice);

// search
const searched = await gql(`query($id:ID!,$s:String){ group(id:$id){ expenses(search:$s){ description } } }`, { id: gid, s: 'din' }, alice);
check('search "din" returns only Dinner', searched.data.group.expenses.length === 1 && searched.data.group.expenses[0].description === 'Dinner');

// filter by member: Bob is in Dinner + Taxi (not Groceries)
const byMember = await gql(`query($id:ID!,$m:ID){ group(id:$id){ expenses(memberId:$m){ description } } }`, { id: gid, m: bM }, alice);
check('filter by member returns the 2 involving Bob', byMember.data.group.expenses.length === 2);

// change log
const log = await gql(`query($id:ID!){ group(id:$id){ changeLog { action summary entity } } }`, { id: gid }, alice);
check('change log records the 3 creates', log.data.group.changeLog.filter((e) => e.action === 'CREATE' && e.entity === 'Expense').length === 3);

// share link
const mk = await gql(`mutation($g:ID!){ createShareLink(groupId:$g){ id token revoked } }`, { g: gid }, alice);
const token = mk.data?.createShareLink?.token;
check('createShareLink returns a token', typeof token === 'string' && token.length > 5);

// public read-only view — no auth token passed
const shared = await gql(`query($t:String!){ sharedGroup(token:$t){ name baseCurrency expenses { description paidByName } balances { name amount } suggestedTransfers { fromName toName amount } } }`, { t: token });
check('sharedGroup is readable without auth', shared.data?.sharedGroup?.name === 'Polish');
check('sharedGroup lists expenses with payer names', shared.data.sharedGroup.expenses.length === 3 && shared.data.sharedGroup.expenses.every((e) => typeof e.paidByName === 'string'));
check('sharedGroup balances sum to zero', shared.data.sharedGroup.balances.reduce((a, b) => a + b.amount, 0) === 0);

// bad token
const bad = await gql(`query($t:String!){ sharedGroup(token:$t){ name } }`, { t: 'not-a-real-token' });
check('bad share token returns null', bad.data?.sharedGroup === null);

// non-admin (bob, not a member here) cannot create a share link
const bobLink = await gql(`mutation($g:ID!){ createShareLink(groupId:$g){ id } }`, { g: gid }, bob);
check('non-member cannot create a share link', Array.isArray(bobLink.errors) && bobLink.errors.length > 0);

// revoke -> view becomes null
await gql(`mutation($g:ID!,$s:ID!){ revokeShareLink(groupId:$g,shareLinkId:$s) }`, { g: gid, s: mk.data.createShareLink.id }, alice);
const afterRevoke = await gql(`query($t:String!){ sharedGroup(token:$t){ name } }`, { t: token });
check('revoked link no longer resolves', afterRevoke.data?.sharedGroup === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
