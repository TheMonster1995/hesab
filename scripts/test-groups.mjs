// Integration test for Phase 2 groups/members/invites/roles against a running API.
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
  const r = await gql(
    `mutation($e:String!,$p:String!,$n:String!){ signup(email:$e,password:$p,name:$n){ token user{ id } } }`,
    { e: email, p: 'correcthorse', n: name },
  );
  return { email, token: r.data.signup.token, id: r.data.signup.user.id };
}

console.log('Phase 2 — groups integration test');

const alice = await newUser('Alice');
const bob = await newUser('Bob');

// createGroup
const cg = await gql(
  `mutation($n:String!,$c:String){ createGroup(name:$n,baseCurrency:$c){ id name baseCurrency myRole memberCount } }`,
  { n: 'Ski Trip', c: 'eur' }, alice.token,
);
const group = cg.data?.createGroup;
check('createGroup returns a group', !!group?.id);
check('creator is ADMIN', group?.myRole === 'ADMIN');
check('baseCurrency normalized to EUR', group?.baseCurrency === 'EUR');
check('new group has 1 member', group?.memberCount === 1);

// myGroups for alice
const mg = await gql(`{ myGroups { id } }`, {}, alice.token);
check('myGroups lists the group', mg.data?.myGroups?.some((g) => g.id === group.id));

// addMember (placeholder)
const am = await gql(
  `mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id name role user { id } } }`,
  { g: group.id, n: 'Charlie (cash only)' }, alice.token,
);
check('addMember creates a placeholder member', am.data?.addMember?.name === 'Charlie (cash only)');
check('placeholder member has no linked user', am.data?.addMember?.user === null);

// member (bob) cannot addMember before joining -> forbidden
const bobBefore = await gql(
  `mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`,
  { g: group.id, n: 'Nope' }, bob.token,
);
check('non-member cannot add members', Array.isArray(bobBefore.errors) && bobBefore.errors.length > 0);

// invite bob by email
const inv = await gql(
  `mutation($g:ID!,$e:String!){ inviteByEmail(groupId:$g,email:$e){ id token status email } }`,
  { g: group.id, e: bob.email }, alice.token,
);
const inviteToken = inv.data?.inviteByEmail?.token;
check('inviteByEmail returns a token', typeof inviteToken === 'string' && inviteToken.length > 5);
check('invite starts PENDING', inv.data?.inviteByEmail?.status === 'PENDING');

// bob accepts
const acc = await gql(`mutation($t:String!){ acceptInvite(token:$t){ id memberCount } }`, { t: inviteToken }, bob.token);
check('acceptInvite joins the group', acc.data?.acceptInvite?.id === group.id);
check('group now has 3 members', acc.data?.acceptInvite?.memberCount === 3);

// bob now a member (MEMBER) still cannot add members
const bobAfter = await gql(
  `mutation($g:ID!,$n:String!){ addMember(groupId:$g,name:$n){ id } }`,
  { g: group.id, n: 'Nope2' }, bob.token,
);
check('plain member cannot add members', Array.isArray(bobAfter.errors) && bobAfter.errors.length > 0);

// find bob's membership id
const members = await gql(`query($id:ID!){ group(id:$id){ members { id role isYou user { id } } } }`, { id: group.id }, alice.token);
const bobMembership = members.data.group.members.find((m) => m.user?.id === bob.id);
check('bob appears as a member with a linked user', !!bobMembership);

// promote bob to ADMIN
const promo = await gql(
  `mutation($g:ID!,$m:ID!,$r:Role!){ updateMemberRole(groupId:$g,membershipId:$m,role:$r){ role } }`,
  { g: group.id, m: bobMembership.id, r: 'ADMIN' }, alice.token,
);
check('admin can promote a member', promo.data?.updateMemberRole?.role === 'ADMIN');

// last-admin guard: solo group where alice is the only admin
const solo = await gql(`mutation($n:String!){ createGroup(name:$n){ id members { id isYou } } }`, { n: 'Solo' }, alice.token);
const soloId = solo.data.createGroup.id;
const aliceSoloMembership = solo.data.createGroup.members.find((m) => m.isYou);
const lastAdmin = await gql(
  `mutation($g:ID!,$m:ID!){ removeMember(groupId:$g,membershipId:$m) }`,
  { g: soloId, m: aliceSoloMembership.id }, alice.token,
);
check('cannot remove the last admin', Array.isArray(lastAdmin.errors) && lastAdmin.errors.length > 0);

// non-member cannot read a group
const stranger = await newUser('Stranger');
const peek = await gql(`query($id:ID!){ group(id:$id){ id } }`, { id: group.id }, stranger.token);
check('non-member cannot read a group', Array.isArray(peek.errors) && peek.errors.length > 0);

// revoke invite makes token invalid
const inv2 = await gql(`mutation($g:ID!,$e:String!){ inviteByEmail(groupId:$g,email:$e){ id token } }`, { g: soloId, e: `late_${rnd()}@example.com` }, alice.token);
await gql(`mutation($g:ID!,$i:ID!){ revokeInvite(groupId:$g,inviteId:$i) }`, { g: soloId, i: inv2.data.inviteByEmail.id }, alice.token);
const useRevoked = await gql(`mutation($t:String!){ acceptInvite(token:$t){ id } }`, { t: inv2.data.inviteByEmail.token }, bob.token);
check('revoked invite cannot be accepted', Array.isArray(useRevoked.errors) && useRevoked.errors.length > 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
