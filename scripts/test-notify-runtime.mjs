// Drives a real expense between two accounts so the console mailer fires.
const ENDPOINT = 'http://localhost:4100/graphql';
async function gql(query, variables, token) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) console.error('gql error:', JSON.stringify(json.errors));
  return json;
}
const rnd = () => Math.floor(Math.random() * 1e9);
async function newUser(n) {
  const email = `${n}_${rnd()}@x.com`;
  const r = await gql(`mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token } }`, { e: email, p: 'correcthorse', n });
  return { email, token: r.data.signup.token };
}

try {
  const alice = await newUser('Alice');
  const bob = await newUser('Bob');
  const cg = await gql(`mutation($n:String!){ createGroup(name:$n,baseCurrency:"EUR"){ id members { id isYou } } }`, { n: 'Notify' }, alice.token);
  const gid = cg.data.createGroup.id;
  const aM = cg.data.createGroup.members.find((m) => m.isYou).id;
  const inv = await gql(`mutation($g:ID!,$e:String!){ inviteByEmail(groupId:$g,email:$e){ token } }`, { g: gid, e: bob.email }, alice.token);
  await gql(`mutation($t:String!){ acceptInvite(token:$t){ id } }`, { t: inv.data.inviteByEmail.token }, bob.token);
  const members = await gql(`query($id:ID!){ group(id:$id){ members { id user { email } } } }`, { id: gid }, alice.token);
  const bobM = members.data.group.members.find((m) => m.user?.email === bob.email.toLowerCase()).id;
  const add = await gql(`mutation($g:ID!,$p:ID!,$s:[SplitInput!]!){ addExpense(groupId:$g,description:"Notify dinner",amount:2000,paidById:$p,splitMode:EQUAL,splits:$s){ id } }`, { g: gid, p: aM, s: [{ membershipId: aM }, { membershipId: bobM }] }, alice.token);
  console.error('addExpense id:', add.data?.addExpense?.id, '| expect [mail] to', bob.email);
  await new Promise((r) => setTimeout(r, 800));
} catch (e) {
  console.error('driver error:', e?.message);
}
