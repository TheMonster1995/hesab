// Integration test for Phase 3 expenses against a running API.
const ENDPOINT = process.env.ENDPOINT || 'http://localhost:4100/graphql';

let passed = 0;
let failed = 0;
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
async function newUser(name) {
  const email = `${name}_${rnd()}@example.com`;
  const r = await gql(`mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token } }`, { e: email, p: 'correcthorse', n: name });
  return { email, token: r.data.signup.token };
}

console.log('Phase 3 — expenses integration test');

const alice = await newUser('Alice');
const stranger = await newUser('Stranger');

const cg = await gql(`mutation($n:String!){ createGroup(name:$n,baseCurrency:"EUR"){ id members { id isYou } } }`, { n: 'Trip' }, alice.token);
const groupId = cg.data.createGroup.id;
const aliceM = cg.data.createGroup.members.find((m) => m.isYou).id;
const bobM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: groupId, n: 'Bob' }, alice.token)).data.addMember.id;
const charlieM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: groupId, n: 'Charlie' }, alice.token)).data.addMember.id;

// EQUAL split of 30.00 three ways
const addEq = await gql(
  `mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"Dinner",amount:3000,paidById:$p,splitMode:EQUAL,splits:$s){ id amount currency splitMode splits { amount member { id } } } }`,
  { g: groupId, p: aliceM, s: [{ membershipId: aliceM }, { membershipId: bobM }, { membershipId: charlieM }] }, alice.token,
);
const eq = addEq.data?.addExpense;
check('addExpense EQUAL succeeds', !!eq?.id);
check('EQUAL currency inherited from group', eq?.currency === 'EUR');
check('EQUAL splits sum to total', eq?.splits.reduce((a, s) => a + s.amount, 0) === 3000);
check('EQUAL splits are [1000,1000,1000]', JSON.stringify(eq?.splits.map((s) => s.amount).sort()) === '[1000,1000,1000]');

// EXACT split
const addEx = await gql(
  `mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"Taxi",amount:1000,paidById:$p,splitMode:EXACT,splits:$s){ id splits { amount } } }`,
  { g: groupId, p: bobM, s: [{ membershipId: aliceM, amount: 600 }, { membershipId: bobM, amount: 400 }] }, alice.token,
);
check('addExpense EXACT succeeds', !!addEx.data?.addExpense?.id);

// EXACT with wrong sum rejected
const badEx = await gql(
  `mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"Bad",amount:1000,paidById:$p,splitMode:EXACT,splits:$s){ id } }`,
  { g: groupId, p: bobM, s: [{ membershipId: aliceM, amount: 600 }, { membershipId: bobM, amount: 300 }] }, alice.token,
);
check('EXACT with wrong sum is rejected', Array.isArray(badEx.errors) && badEx.errors.length > 0);

// paidBy outside group rejected
const badPayer = await gql(
  `mutation($g:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"X",amount:100,paidById:"nonexistent",splitMode:EQUAL,splits:$s){ id } }`,
  { g: groupId, s: [{ membershipId: aliceM }] }, alice.token,
);
check('payer outside group is rejected', Array.isArray(badPayer.errors) && badPayer.errors.length > 0);

// non-member cannot add expense
const intruder = await gql(
  `mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"X",amount:100,paidById:$p,splitMode:EQUAL,splits:$s){ id } }`,
  { g: groupId, p: aliceM, s: [{ membershipId: aliceM }] }, stranger.token,
);
check('non-member cannot add expense', Array.isArray(intruder.errors) && intruder.errors.length > 0);

// group.expenses lists both
const list = await gql(`query($id:ID!){ group(id:$id){ expenses { id description } } }`, { id: groupId }, alice.token);
check('group lists 2 expenses', list.data?.group?.expenses?.length === 2);

// update the EQUAL expense amount -> recompute equal
const upd = await gql(
  `mutation($id:ID!){ updateExpense(expenseId:$id,amount:3300){ amount splits { amount } } }`,
  { id: eq.id }, alice.token,
);
check('update recomputes equal splits', upd.data?.updateExpense?.splits.reduce((a, s) => a + s.amount, 0) === 3300);
check('updated equal splits are [1100,1100,1100]', JSON.stringify(upd.data?.updateExpense?.splits.map((s) => s.amount).sort()) === '[1100,1100,1100]');

// delete
const del = await gql(`mutation($id:ID!){ deleteExpense(expenseId:$id) }`, { id: addEx.data.addExpense.id }, alice.token);
check('deleteExpense returns true', del.data?.deleteExpense === true);
const list2 = await gql(`query($id:ID!){ group(id:$id){ expenses { id } } }`, { id: groupId }, alice.token);
check('group now lists 1 expense', list2.data?.group?.expenses?.length === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
