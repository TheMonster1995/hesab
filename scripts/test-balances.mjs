// Integration test for Phase 4 balances + settle up against a running API.
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
  const r = await gql(`mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token } }`, { e: `${name}_${rnd()}@x.com`, p: 'correcthorse', n: name });
  return r.data.signup.token;
}
const balOf = (arr, id) => arr.find((b) => b.member.id === id)?.amount;

console.log('Phase 4 — balances & settle-up integration test');

const alice = await newUser('Alice');
const cg = await gql(`mutation($n:String!){ createGroup(name:$n,baseCurrency:"EUR"){ id members { id isYou } } }`, { n: 'Balances' }, alice);
const groupId = cg.data.createGroup.id;
const aliceM = cg.data.createGroup.members.find((m) => m.isYou).id;
const bobM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: groupId, n: 'Bob' }, alice)).data.addMember.id;
const charlieM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: groupId, n: 'Charlie' }, alice)).data.addMember.id;

// Alice pays 30.00, split equally three ways
await gql(
  `mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"Dinner",amount:3000,paidById:$p,splitMode:EQUAL,splits:$s){ id } }`,
  { g: groupId, p: aliceM, s: [{ membershipId: aliceM }, { membershipId: bobM }, { membershipId: charlieM }] }, alice,
);

const q = `query($id:ID!){ group(id:$id){ balances { member { id } amount } suggestedTransfers { from { id } to { id } amount } } }`;
let g = (await gql(q, { id: groupId }, alice)).data.group;
check('alice is +2000', balOf(g.balances, aliceM) === 2000);
check('bob is -1000', balOf(g.balances, bobM) === -1000);
check('charlie is -1000', balOf(g.balances, charlieM) === -1000);
check('balances sum to zero', g.balances.reduce((a, b) => a + b.amount, 0) === 0);
check('two suggested transfers', g.suggestedTransfers.length === 2);
check('all suggested transfers point to alice', g.suggestedTransfers.every((t) => t.to.id === aliceM));

// Bob settles 10.00 to Alice
const settle = await gql(
  `mutation($g:ID!,$f:ID!,$t:ID!){ addSettlement(groupId:$g,fromId:$f,toId:$t,amount:1000){ id amount } }`,
  { g: groupId, f: bobM, t: aliceM }, alice,
);
check('addSettlement succeeds', settle.data?.addSettlement?.amount === 1000);

g = (await gql(q, { id: groupId }, alice)).data.group;
check('after settle, bob is 0', balOf(g.balances, bobM) === 0);
check('after settle, alice is +1000', balOf(g.balances, aliceM) === 1000);
check('one suggested transfer remains (charlie->alice)', g.suggestedTransfers.length === 1 && g.suggestedTransfers[0].from.id === charlieM);

// Charlie settles too -> fully settled
await gql(`mutation($g:ID!,$f:ID!,$t:ID!){ addSettlement(groupId:$g,fromId:$f,toId:$t,amount:1000){ id } }`, { g: groupId, f: charlieM, t: aliceM }, alice);
g = (await gql(q, { id: groupId }, alice)).data.group;
check('fully settled: all balances zero', g.balances.every((b) => b.amount === 0));
check('fully settled: no suggested transfers', g.suggestedTransfers.length === 0);

// validation
const selfPay = await gql(`mutation($g:ID!,$m:ID!){ addSettlement(groupId:$g,fromId:$m,toId:$m,amount:100){ id } }`, { g: groupId, m: aliceM }, alice);
check('cannot settle with yourself', Array.isArray(selfPay.errors) && selfPay.errors.length > 0);
const negative = await gql(`mutation($g:ID!,$f:ID!,$t:ID!){ addSettlement(groupId:$g,fromId:$f,toId:$t,amount:-50){ id } }`, { g: groupId, f: bobM, t: aliceM }, alice);
check('cannot settle a negative amount', Array.isArray(negative.errors) && negative.errors.length > 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
