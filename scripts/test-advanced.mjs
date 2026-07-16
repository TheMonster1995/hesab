// Integration test for Phase 5 advanced splits + multi-currency.
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
const ssum = (s) => s.reduce((a, x) => a + x.amount, 0);

console.log('Phase 5 — advanced splits + multi-currency integration test');

const alice = await newUser('Alice');
const cg = await gql(`mutation($n:String!){ createGroup(name:$n,baseCurrency:"EUR"){ id members { id isYou } } }`, { n: 'Adv' }, alice);
const gid = cg.data.createGroup.id;
const aM = cg.data.createGroup.members.find((m) => m.isYou).id;
const bM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: gid, n: 'Bob' }, alice)).data.addMember.id;
const cM = (await gql(`mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`, { g: gid, n: 'Cy' }, alice)).data.addMember.id;

const ADD = `mutation($g:ID!,$d:String!,$a:Int!,$p:ID!,$m:SplitMode!,$s:[SplitInput!],$i:[ItemInput!],$c:String,$r:Float){
  addExpense(groupId:$g,description:$d,amount:$a,paidById:$p,splitMode:$m,splits:$s,items:$i,currency:$c,exchangeRate:$r){
    id amount baseAmount currency exchangeRate splitMode splits { amount member { id } } } }`;

// PERCENTAGE 50/50
const pct = await gql(ADD, { g: gid, d: 'Pct', a: 1000, p: aM, m: 'PERCENTAGE', s: [{ membershipId: aM, value: 5000 }, { membershipId: bM, value: 5000 }] }, alice);
check('percentage splits sum to total', ssum(pct.data.addExpense.splits) === 1000);
check('percentage 50/50 = 500 each', pct.data.addExpense.splits.every((s) => s.amount === 500));

// SHARES 2:1
const sh = await gql(ADD, { g: gid, d: 'Shares', a: 900, p: aM, m: 'SHARES', s: [{ membershipId: aM, value: 2 }, { membershipId: bM, value: 1 }] }, alice);
const shA = sh.data.addExpense.splits.find((s) => s.member.id === aM).amount;
check('shares 2:1 gives a=600', shA === 600);
check('shares sum to total', ssum(sh.data.addExpense.splits) === 900);

// ADJUSTMENT: a +200, rest equal over 3
const adj = await gql(ADD, { g: gid, d: 'Adj', a: 1000, p: aM, m: 'ADJUSTMENT', s: [{ membershipId: aM, value: 200 }, { membershipId: bM, value: 0 }, { membershipId: cM, value: 0 }] }, alice);
check('adjustment sums to total', ssum(adj.data.addExpense.splits) === 1000);

// ITEMIZED
const it = await gql(ADD, { g: gid, d: 'Itemized', a: 1500, p: aM, m: 'ITEMIZED', i: [
  { description: 'Pizza', amount: 900, membershipIds: [aM, bM, cM] },
  { description: 'Beer', amount: 600, membershipIds: [aM, bM] },
] }, alice);
check('itemized sums to total', ssum(it.data.addExpense.splits) === 1500);
check('itemized: cy pays only pizza share (300)', it.data.addExpense.splits.find((s) => s.member.id === cM).amount === 300);

// MULTI-CURRENCY: 10.00 USD at 1.08 -> 1080 base
const usd = await gql(ADD, { g: gid, d: 'USD dinner', a: 1000, p: aM, m: 'EQUAL', s: [{ membershipId: aM }, { membershipId: bM }], c: 'usd', r: 1.08 }, alice);
check('foreign currency stored as USD', usd.data.addExpense.currency === 'USD');
check('baseAmount = round(1000*1.08) = 1080', usd.data.addExpense.baseAmount === 1080);
check('base splits sum to baseAmount', ssum(usd.data.addExpense.splits) === 1080);
check('base splits are [540,540]', JSON.stringify(usd.data.addExpense.splits.map((s) => s.amount).sort()) === '[540,540]');

// foreign currency without rate -> error
const noRate = await gql(ADD, { g: gid, d: 'GBP', a: 1000, p: aM, m: 'EQUAL', s: [{ membershipId: aM }], c: 'GBP' }, alice);
check('foreign currency without rate is rejected', Array.isArray(noRate.errors) && noRate.errors.length > 0);

// balances use base amounts: alice paid 1080 base on USD expense among a,b (540 each)
const bal = (await gql(`query($id:ID!){ group(id:$id){ balances { member { id } amount } } }`, { id: gid }, alice)).data.group.balances;
check('balances still sum to zero across mixed currencies', bal.reduce((a, b) => a + b.amount, 0) === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
