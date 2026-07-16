// Integration test for Phase 7 CSV export against a running API.
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

console.log('Phase 7 — CSV export integration test');

const alice = await newUser('Alice');
const outsider = await newUser('Outsider');
const cg = await gql(`mutation($n:String!){ createGroup(name:$n,baseCurrency:"EUR"){ id members { id isYou } } }`, { n: 'Export Co' }, alice);
const gid = cg.data.createGroup.id;
const aM = cg.data.createGroup.members.find((m) => m.isYou).id;
const bM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: gid, n: 'Bob' }, alice)).data.addMember.id;
await gql(`mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"Dinner, deluxe",amount:3000,paidById:$p,splitMode:EQUAL,splits:$s){ id } }`, { g: gid, p: aM, s: [{ membershipId: aM }, { membershipId: bM }] }, alice);

const res = await gql(`query($id:ID!){ exportGroupCsv(groupId:$id) }`, { id: gid }, alice);
const csv = res.data?.exportGroupCsv ?? '';
check('CSV returns a string', typeof csv === 'string' && csv.length > 0);
check('CSV has an Expenses section header', csv.includes('Expenses'));
check('CSV has a Balances section', csv.includes('Balances'));
check('CSV includes the expense description', csv.includes('Dinner'));
check('CSV quotes a value containing a comma', csv.includes('"Dinner, deluxe"'));
check('CSV shows the amount 30.00', csv.includes('30.00'));

// non-member cannot export
const denied = await gql(`query($id:ID!){ exportGroupCsv(groupId:$id) }`, { id: gid }, outsider);
check('non-member cannot export', Array.isArray(denied.errors) && denied.errors.length > 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
