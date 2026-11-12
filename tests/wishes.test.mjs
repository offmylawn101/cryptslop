// The Petition Bee's server (server/wishes): wishes, votes, reports, the word filter, the admin
// routes, and Wavedash JWT verification. Runs the real worker code against Node's SQLite.
import { handle, badWords, verifyJwt, LIMITS } from '../server/wishes/src/worker.js';
import { makeD1 } from '../server/wishes/local.mjs';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL ${msg}`); } }

const ADMIN = 'test-admin-token-0123456789abcdefXYZ';
const env = { DB: makeD1(':memory:'), DEV: '1', ADMIN_TOKEN: ADMIN };
async function call(method, path, { tok, body } = {}) {
  const headers = {};
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await handle(new Request(`http://x${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, j: await res.json().catch(() => null), h: res.headers };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- the word filter ---
for (const bad of ['you n1gg3r', 'F A G G O T S everywhere', 'add a r.a.p.e button', 'kys lol', 'make a tranny boss', 'sieg heil bees']) ok(badWords(bad), `filter catches "${bad}"`);
for (const fine of ['spicy honey sauce', 'fire retardant suit for the stomper', 'kill all the bees on floor 3', 'make the cocoon boss bigger', 'raccoon pet', 'grape soda powerup', 'Pakistan level? no', 'therapist npc', 'shitake mushroom gun']) ok(!badWords(fine), `filter lets "${fine}" through`);

// --- making wishes ---
let r = await call('POST', '/api/wishes', { body: { text: 'add a horse' } });
ok(r.status === 401, 'no token: 401');
r = await call('POST', '/api/wishes', { tok: 'dev:alice', body: { text: 'make the worker bees lunge', name: 'ALICE' } });
ok(r.status === 200 && r.j.id === 1, `alice wishes (${r.status} ${JSON.stringify(r.j)})`);
ok(r.h.get('access-control-allow-origin') === '*', 'CORS header');
r = await call('POST', '/api/wishes', { tok: 'dev:alice', body: { text: 'another one right away' } });
ok(r.status === 429, 'gap between wishes enforced');
r = await call('POST', '/api/wishes', { tok: 'dev:bob', body: { text: 'kys', name: 'BOB' } });
ok(r.status === 400, 'slur bounced');
r = await call('POST', '/api/wishes', { tok: 'dev:bob', body: { text: 'hi', name: 'BOB' } });
ok(r.status === 400, 'too short bounced');
r = await call('POST', '/api/wishes', { tok: 'dev:bob', body: { text: 'x'.repeat(5000), name: 'B'.repeat(80) } });
ok(r.status === 200, 'a long wish is accepted');
const long = (await call('GET', '/api/wishes?sort=new', { tok: 'dev:bob' })).j.wishes.find((w) => w.mine);
ok(long && long.text.length === LIMITS.textMax && long.name.length === LIMITS.nameMax, 'long text and name are trimmed to the limits');
await wait(LIMITS.gapSec * 1000 + 50);
r = await call('POST', '/api/wishes', { tok: 'dev:alice', body: { text: 'make the worker bees lunge', name: 'ALICE' } });
ok(r.status === 409, 'duplicate open wish refused');
r = await call('POST', '/api/wishes', { tok: 'dev:alice', body: { text: 'a light saber please', name: 'ALICE' } });
ok(r.status === 200, 'no daily cap: alice wishes again after the gap');
r = await call('POST', '/api/wishes', { tok: 'dev:carol', body: { text: 'rainbow trail when you bhop', name: 'CAROL' } });
ok(r.status === 200, 'carol wishes');
// not in DEV: dev tokens are refused
const prod = { ...env, DEV: '0' };
r = await handle(new Request('http://x/api/wishes', { method: 'POST', headers: { Authorization: 'Bearer dev:eve', 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'hello there' }) }), prod);
ok(r.status === 401, 'dev tokens refused outside DEV');

// --- votes ---
r = await call('POST', '/api/vote', { tok: 'dev:alice', body: { id: 1 } });
ok(r.status === 400, 'cannot vote for your own wish');
for (const u of ['bob', 'carol', 'dave']) await call('POST', '/api/vote', { tok: `dev:${u}`, body: { id: 1 } });
r = await call('POST', '/api/vote', { tok: 'dev:bob', body: { id: 1 } });
ok(r.j.votes === 3, `a second vote by the same player does not count (${r.j.votes})`);
r = await call('POST', '/api/vote', { tok: 'dev:dave', body: { id: 1, on: false } });
ok(r.j.votes === 2, 'unvote');
await call('POST', '/api/vote', { tok: 'dev:bob', body: { id: 4 } });
let list = (await call('GET', '/api/wishes?sort=top', { tok: 'dev:bob' })).j;
ok(list.wishes[0].id === 1 && list.wishes[0].votes === 2 && list.wishes[0].voted === true && list.wishes[0].mine === false, 'top sort, voted flag');
ok(list.total === 4, `total open (${list.total})`);
ok(!('uid' in list.wishes[0]), 'player ids are not public');
list = (await call('GET', '/api/wishes?sort=mine', { tok: 'dev:alice' })).j;
ok(list.wishes.length === 2 && list.wishes.every((w) => w.mine), 'mine');
list = (await call('GET', '/api/wishes?sort=new')).j;
ok(list.wishes[0].id === 4 && list.wishes.every((w) => !w.voted), 'new sort, anonymous');

// --- reports ---
ok((await call('POST', '/api/report', { tok: 'dev:bob', body: { id: 2 } })).status === 400, 'cannot report your own wish');
for (const u of ['alice', 'carol']) await call('POST', '/api/report', { tok: `dev:${u}`, body: { id: 2 } });
ok((await call('GET', '/api/wishes?sort=new')).j.wishes.some((w) => w.id === 2), 'two reports: still up');
await call('POST', '/api/report', { tok: 'dev:carol', body: { id: 2 } });
ok((await call('GET', '/api/wishes?sort=new')).j.wishes.some((w) => w.id === 2), 'the same player reporting twice counts once');
await call('POST', '/api/report', { tok: 'dev:dave', body: { id: 2 } });
ok(!(await call('GET', '/api/wishes?sort=new')).j.wishes.some((w) => w.id === 2), 'three reports: off the board');

// --- admin ---
r = await call('GET', '/api/admin/open');
ok(r.status === 403, 'admin needs the token');
r = await call('GET', '/api/admin/open', { tok: 'dev:alice' });
ok(r.status === 403, 'a player token is not admin');
r = await call('GET', '/api/admin/open?limit=10', { tok: ADMIN });
ok(r.status === 200 && r.j.wishes.length === 3 && r.j.wishes[0].id === 1 && r.j.wishes[0].uid === 'dev:alice', 'admin open list with ids');
r = await call('POST', '/api/admin/claim', { tok: ADMIN, body: { batch: '2026-11-11', ids: [1, 4] } });
ok(r.j.claimed === 2, 'claim');
ok((await call('GET', '/api/admin/open', { tok: ADMIN })).j.wishes.length === 1, 'claimed wishes leave the open queue');
ok((await call('GET', '/api/wishes?sort=top')).j.wishes.some((w) => w.id === 1 && w.status === 'building'), 'players still see claimed wishes as building');
r = await call('POST', '/api/admin/resolve', { tok: ADMIN, body: { batch: '2026-11-11', title: 'DAY ONE', results: [{ id: 1, status: 'built', summary: 'Worker bees now lunge.' }, { id: 4, status: 'open' }, { id: 3, status: 'rejected', reason: 'THE QUEEN SAID NO' }] } });
ok(r.j.built === 1 && r.j.rejected === 1, 'resolve');
const notes = (await call('GET', '/api/notes', { tok: 'dev:alice' })).j.notes;
ok(notes.length === 1 && notes[0].title === 'DAY ONE' && notes[0].built[0].mine && notes[0].built[0].name === 'ALICE' && notes[0].rejected[0].reason === 'THE QUEEN SAID NO', 'patch notes');
ok(!JSON.stringify(notes).includes('dev:'), 'patch notes hide player ids');
ok((await call('GET', '/api/admin/open', { tok: ADMIN })).j.wishes.some((w) => w.id === 4), 'a wish returned to open is back in the queue');
r = await call('POST', '/api/vote', { tok: 'dev:carol', body: { id: 1 } });
ok(r.status === 404, 'cannot vote on a built wish');
await call('POST', '/api/admin/hide', { tok: ADMIN, body: { ids: [4], reason: 'test' } });
ok(!(await call('GET', '/api/wishes')).j.wishes.some((w) => w.id === 4), 'admin hide');
ok((await call('OPTIONS', '/api/wishes')).status === 204, 'CORS preflight');
const done = (await call('GET', '/api/wishes?sort=done')).j;
ok(done.total === 1 && done.wishes[0].id === 1 && done.wishes[0].note === 'Worker bees now lunge.' && done.wishes[0].batch === '2026-11-11' && done.wishes[0].status === 'built', 'the COMPLETE board lists built wishes with what was built and when');
ok(!(await call('GET', '/api/wishes?sort=top')).j.wishes.some((w) => w.id === 1), 'a built wish is gone from the open board');
const stats = (await call('GET', '/api/admin/stats', { tok: ADMIN })).j;
ok(stats.wishers === 3 && stats.voters === 2 && stats.wishes === 4 && stats.built === 1 && stats.wishers24h === 3, `admin stats (${JSON.stringify(stats)})`);
ok((await call('GET', '/api/admin/stats', { tok: 'dev:alice' })).status === 403, 'stats are admin only');

// --- JWT verification (a fake Wavedash with our own RSA key) ---
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const fakeFetch = async () => new Response(JSON.stringify({ keys: [jwk] }));
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
async function sign(claims, kid = 'k1', key = kp.privateKey) {
  const head = enc({ alg: 'RS256', typ: 'JWT', kid }), pay = enc(claims);
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${pay}`))).toString('base64url');
  return `${head}.${pay}.${sig}`;
}
const t = Math.floor(Date.now() / 1000);
const good = { iss: 'https://auth.wavedash.com', aud: 'gameplay.wavedash.com', sub: 'user_123', scope: 'gameplay', gcid: 'g1', iat: t, nbf: t, exp: t + 3600 };
const tries = async (claims, kid, key) => { try { return await verifyJwt(await sign(claims, kid, key), fakeFetch); } catch (e) { return null; } };
ok((await tries(good))?.sub === 'user_123', 'a valid token verifies');
ok(!(await tries({ ...good, exp: t - 600 })), 'expired token refused');
ok(!(await tries({ ...good, aud: 'someone.else' })), 'wrong audience refused');
ok(!(await tries({ ...good, iss: 'https://evil.example' })), 'wrong issuer refused');
const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
ok(!(await tries(good, 'k1', other.privateKey)), 'forged signature refused');
const tok = await sign(good);
const tampered = tok.split('.'); tampered[1] = enc({ ...good, sub: 'admin' });
ok(!(await verifyJwt(tampered.join('.'), fakeFetch).catch(() => null)), 'tampered claims refused');
const prodEnv = { ...env, DEV: '0', fetchImpl: fakeFetch };
r = await handle(new Request('http://x/api/wishes', { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a real wavedash player wish', name: 'REAL' }) }), prodEnv);
ok(r.status === 200, 'a real Wavedash token can make a wish');

console.log(`${fails ? 'FAILED' : 'ok'}: wishes server ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
