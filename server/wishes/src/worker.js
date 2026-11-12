// THE PETITION BEE's server: a Cloudflare Worker with a D1 (SQLite) database.
// Players send wishes (what chat should build next) and vote on each other's. Every day the wish
// pipeline (tools/wishes/daily.cjs) reads the top wishes with the admin token, builds some of them, and
// after the streamer approves, writes the patch notes back here.
//
// Who is who: the game sends the player's Wavedash JWT (Wavedash.getUserJwt()); we verify it against
// Wavedash's public keys (RS256, iss https://auth.wavedash.com, aud gameplay.wavedash.com). `sub` is the
// player's id. In DEV mode (local testing only) a token "dev:<id>" is accepted too.
//
// Public routes (CORS open, since the game runs on *.builds.wavedashcdn.com):
//   GET  /api/wishes?sort=top|new|mine|done&limit=&offset=   the open wishes (done: the COMPLETE board)
//   POST /api/wishes   {text, name}                     make a wish (player token)
//   POST /api/vote     {id, on}                         vote / unvote (player token)
//   POST /api/report   {id}                             report a wish (player token)
//   GET  /api/notes                                     the patch notes, newest first
// Admin routes (Authorization: Bearer <ADMIN_TOKEN>):
//   GET  /api/admin/open?limit=                         top open wishes, with full detail
//   POST /api/admin/claim   {batch, ids}                mark wishes as being built today
//   POST /api/admin/resolve {batch, title, results}     write the outcome and the patch notes
//   POST /api/admin/hide    {ids, reason}               take wishes off the board
//   GET  /api/admin/stats                               how many players wished and voted

export const LIMITS = {
  textMax: 2000,     // a wish can be long; this only keeps one wish from being a novel
  nameMax: 24,
  gapSec: 2,         // one wish every 2 seconds per player: stops scripts, not people
  reportsToHide: 3,  // three different players report it: it leaves the board until a human looks
  pageMax: 100,
  notesMax: 20,
};

const JWKS_URL = 'https://auth.wavedash.com/.well-known/jwks.json';
const ISS = 'https://auth.wavedash.com';
const AUD = 'gameplay.wavedash.com';

// ---------------- the word filter ----------------
// A first line of defense: the wish is shown to everyone the moment it is made. Slurs and hate get
// bounced here (and Workers AI's Llama Guard checks it too, when the AI binding is present). The daily
// moderation pass and player reports catch the rest.
const SUBS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' };
export function squash(text) {
  let s = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[0-9@$!|+]/g, (c) => SUBS[c] || c);
  return s.replace(/[^a-z]+/g, ' ').trim();
}
// Squashed first, so "n1gg3r" lands. A trailing * matches any word that starts with it; everything
// else must be the whole word, so "spicy", "fire retardant" and "kill all the bees" are fine.
const BAD_WORDS = [
  'nigg*', 'nigga*', 'fag', 'fags', 'fagg*', 'faggot*', 'fagot*', 'retard', 'retards', 'retarded', 'tranny', 'trannies', 'kike', 'kikes',
  'spic', 'spics', 'chink', 'chinks', 'gook', 'gooks', 'wetback*', 'beaner', 'beaners', 'raghead*', 'towelhead*', 'coon', 'coons',
  'darkie', 'darkies', 'paki', 'pakis', 'dyke', 'dykes', 'shemale*', 'rape', 'rapes', 'raped', 'raping', 'rapist*', 'molest*', 'pedo',
  'pedos', 'pedophil*', 'paedo*', 'kys', 'heil hitler', 'sieg heil', 'white power', 'kill yourself', 'kill urself',
];
export function badWords(text) {
  // "n i g g e r" / "r.a.p.e": a run of single letters is also read as words (from each starting letter,
  // so "a r a p e" still finds "rape")
  const words = squash(text).split(' ');
  const extra = [];
  for (let i = 0; i < words.length;) {
    if (words[i].length !== 1) { i++; continue; }
    let j = i;
    while (j < words.length && words[j].length === 1) j++;
    if (j - i >= 2) for (let k = i; k < j - 1; k++) extra.push(words.slice(k, j).join(''));
    i = j;
  }
  const s = ` ${words.join(' ')} ${extra.join(' ')} `;
  for (const w of BAD_WORDS) {
    if (w.endsWith('*')) { if (s.includes(` ${w.slice(0, -1)}`)) return true; } else if (s.includes(` ${w} `) || (w.length >= 3 && !w.includes(' ') && extra.some((x) => x.startsWith(w)))) return true;
  }
  return false;
}

// ---------------- helpers ----------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
const fail = (status, error) => json({ ok: false, error }, status);
const now = () => Math.floor(Date.now() / 1000);
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);

function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let jwksCache = null;
async function keyFor(kid, fetchImpl) {
  if (!jwksCache || jwksCache.at < Date.now() - 3600e3 || !jwksCache.keys.has(kid)) {
    const res = await fetchImpl(JWKS_URL);
    if (!res.ok) throw new Error('jwks');
    const { keys } = await res.json();
    const map = new Map();
    for (const k of keys || []) {
      if (k.kty !== 'RSA') continue;
      map.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    jwksCache = { at: Date.now(), keys: map };
  }
  return jwksCache.keys.get(kid);
}

// verify a Wavedash player JWT; returns the claims or throws
export async function verifyJwt(token, fetchImpl = fetch) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
  if (header.alg !== 'RS256') throw new Error('alg');
  const key = await keyFor(header.kid, fetchImpl);
  if (!key) throw new Error('kid');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('signature');
  const c = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  const t = now();
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== ISS || !aud.includes(AUD)) throw new Error('issuer');
  if (typeof c.exp !== 'number' || c.exp < t - 30) throw new Error('expired');
  if (typeof c.nbf === 'number' && c.nbf > t + 30) throw new Error('early');
  if (!c.sub) throw new Error('sub');
  return c;
}

async function player(req, env) {
  const h = req.headers.get('Authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!tok) return null;
  if (env.DEV === '1' && /^dev:[\w-]{1,40}$/.test(tok)) return { uid: tok, gcid: 'dev' };
  try { const c = await verifyJwt(tok, env.fetchImpl || fetch); return { uid: String(c.sub), gcid: String(c.gcid || '') }; } catch (e) { return null; }
}

function isAdmin(req, env) {
  const h = req.headers.get('Authorization') || '';
  const want = `Bearer ${env.ADMIN_TOKEN || ''}`;
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24 || h.length !== want.length) return false;
  let diff = 0; // constant time: how long the check takes says nothing about the token
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ h.charCodeAt(i);
  return diff === 0;
}

async function body(req) { try { return await req.json(); } catch (e) { return {}; } }

// Llama Guard (Workers AI), when bound. Returns true when it says the text is unsafe.
async function aiUnsafe(env, text) {
  if (!env.AI) return false;
  try {
    const r = await env.AI.run('@cf/meta/llama-guard-3-8b', { messages: [{ role: 'user', content: text }] });
    const v = r && (r.response ?? r.result ?? r);
    if (v && typeof v === 'object' && 'safe' in v) return v.safe === false;
    return /\bunsafe\b/i.test(typeof v === 'string' ? v : JSON.stringify(v));
  } catch (e) { return false; }
}

const PUBLIC_COLS = 'id, name, text, votes, status, created';
function shape(r, me, voted) {
  return { id: r.id, name: r.name, text: r.text, votes: r.votes, status: r.status, created: r.created, mine: !!me && r.uid === me, voted: !!voted };
}

// ---------------- routes ----------------
async function listWishes(req, env, url) {
  const me = await player(req, env);
  const sort = url.searchParams.get('sort') || 'top';
  const limit = Math.max(1, Math.min(LIMITS.pageMax, Number(url.searchParams.get('limit')) || 50));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  let rows;
  if (sort === 'done') { // the COMPLETE board: every wish that was built, newest first
    rows = (await env.DB.prepare(`SELECT ${PUBLIC_COLS}, uid, note, batch FROM wishes WHERE status = 'built' ORDER BY batch DESC, id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all()).results;
    const done = (await env.DB.prepare("SELECT COUNT(*) AS n FROM wishes WHERE status = 'built'").first()).n;
    return json({ ok: true, wishes: rows.map((r) => ({ ...shape(r, me && me.uid, false), note: r.note, batch: r.batch })), total: done });
  }
  if (sort === 'mine') {
    if (!me) return json({ ok: true, wishes: [], total: 0 });
    rows = (await env.DB.prepare(`SELECT ${PUBLIC_COLS}, uid FROM wishes WHERE uid = ? AND status != 'hidden' ORDER BY created DESC, id DESC LIMIT ? OFFSET ?`).bind(me.uid, limit, offset).all()).results;
  } else {
    const order = sort === 'new' ? 'created DESC, id DESC' : 'votes DESC, created ASC, id ASC';
    rows = (await env.DB.prepare(`SELECT ${PUBLIC_COLS}, uid FROM wishes WHERE status IN ('open', 'building') ORDER BY ${order} LIMIT ? OFFSET ?`).bind(limit, offset).all()).results;
  }
  let voted = new Set();
  if (me && rows.length) {
    const ids = rows.map((r) => r.id);
    const vs = (await env.DB.prepare(`SELECT wid FROM votes WHERE uid = ? AND wid IN (${ids.map(() => '?').join(',')})`).bind(me.uid, ...ids).all()).results;
    voted = new Set(vs.map((v) => v.wid));
  }
  const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM wishes WHERE status IN ('open', 'building')").first()).n;
  return json({ ok: true, wishes: rows.map((r) => shape(r, me && me.uid, voted.has(r.id))), total });
}

async function makeWish(req, env) {
  const me = await player(req, env);
  if (!me) return fail(401, 'SIGN IN TO MAKE A WISH');
  const b = await body(req);
  const text = clean(b.text, LIMITS.textMax);
  const name = clean(b.name, LIMITS.nameMax).replace(/\n/g, ' ') || 'A BEE';
  if (text.length < 3) return fail(400, 'THAT WISH IS TOO SHORT');
  if (badWords(text) || badWords(name)) return fail(400, 'THE PETITION BEE WILL NOT CARRY THAT');
  const last = await env.DB.prepare('SELECT created, text FROM wishes WHERE uid = ? ORDER BY id DESC LIMIT 1').bind(me.uid).first();
  if (last && now() - last.created < LIMITS.gapSec) return fail(429, 'ONE MOMENT. THE BEE IS STILL FLYING');
  const dup = await env.DB.prepare("SELECT id FROM wishes WHERE uid = ? AND text = ? AND status IN ('open', 'building')").bind(me.uid, text).first();
  if (dup) return fail(409, 'YOU ALREADY WISHED THAT');
  if (await aiUnsafe(env, text)) return fail(400, 'THE PETITION BEE WILL NOT CARRY THAT');
  const r = await env.DB.prepare("INSERT INTO wishes (uid, name, text, created, status, votes, reports, gcid) VALUES (?, ?, ?, ?, 'open', 0, 0, ?) RETURNING id").bind(me.uid, name, text, now(), me.gcid).first();
  return json({ ok: true, id: r.id });
}

async function vote(req, env) {
  const me = await player(req, env);
  if (!me) return fail(401, 'SIGN IN TO VOTE');
  const b = await body(req);
  const id = Number(b.id);
  const w = await env.DB.prepare('SELECT id, uid, status FROM wishes WHERE id = ?').bind(id).first();
  if (!w || !['open', 'building'].includes(w.status)) return fail(404, 'THAT WISH IS GONE');
  if (w.uid === me.uid) return fail(400, 'YOU CANNOT VOTE FOR YOUR OWN WISH');
  if (b.on === false) await env.DB.prepare('DELETE FROM votes WHERE wid = ? AND uid = ?').bind(id, me.uid).run();
  else await env.DB.prepare('INSERT OR IGNORE INTO votes (wid, uid, created) VALUES (?, ?, ?)').bind(id, me.uid, now()).run();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE wid = ?').bind(id).first()).n;
  await env.DB.prepare('UPDATE wishes SET votes = ? WHERE id = ?').bind(n, id).run();
  return json({ ok: true, votes: n, voted: b.on !== false });
}

async function report(req, env) {
  const me = await player(req, env);
  if (!me) return fail(401, 'SIGN IN TO REPORT');
  const id = Number((await body(req)).id);
  const w = await env.DB.prepare('SELECT id, uid FROM wishes WHERE id = ?').bind(id).first();
  if (!w) return fail(404, 'THAT WISH IS GONE');
  if (w.uid === me.uid) return fail(400, 'THAT IS YOUR OWN WISH');
  await env.DB.prepare('INSERT OR IGNORE INTO reports (wid, uid, created) VALUES (?, ?, ?)').bind(id, me.uid, now()).run();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE wid = ?').bind(id).first()).n;
  await env.DB.prepare('UPDATE wishes SET reports = ? WHERE id = ?').bind(n, id).run();
  if (n >= LIMITS.reportsToHide) await env.DB.prepare("UPDATE wishes SET status = 'hidden', note = 'reported' WHERE id = ? AND status = 'open'").bind(id).run();
  return json({ ok: true });
}

async function notes(req, env) {
  const me = await player(req, env);
  const rows = (await env.DB.prepare('SELECT id, created, title, body FROM batches ORDER BY created DESC LIMIT ?').bind(LIMITS.notesMax).all()).results;
  const out = rows.map((r) => {
    let b = {};
    try { b = JSON.parse(r.body); } catch (e) { /* ignore */ }
    const built = (b.built || []).map((x) => ({ id: x.id, name: x.name, text: x.text, summary: x.summary, mine: !!me && x.uid === me.uid }));
    const rejected = (b.rejected || []).map((x) => ({ id: x.id, name: x.name, text: x.text, reason: x.reason, mine: !!me && x.uid === me.uid }));
    return { id: r.id, created: r.created, title: r.title, built, rejected };
  });
  return json({ ok: true, notes: out });
}

// ---------------- admin ----------------
async function adminOpen(env, url) {
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 200));
  const rows = (await env.DB.prepare("SELECT id, uid, name, text, votes, reports, created, status FROM wishes WHERE status = 'open' ORDER BY votes DESC, created ASC LIMIT ?").bind(limit).all()).results; // most-voted first
  const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM wishes WHERE status = 'open'").first()).n;
  return json({ ok: true, wishes: rows, total });
}

async function adminClaim(req, env) {
  const b = await body(req);
  const ids = (b.ids || []).map(Number).filter(Number.isFinite);
  const batch = clean(b.batch, 40);
  if (!batch) return fail(400, 'batch');
  for (const id of ids) await env.DB.prepare("UPDATE wishes SET status = 'building', batch = ? WHERE id = ? AND status = 'open'").bind(batch, id).run();
  return json({ ok: true, claimed: ids.length });
}

// results: [{id, status: 'built'|'rejected'|'open', summary?, reason?}]
async function adminResolve(req, env) {
  const b = await body(req);
  const batch = clean(b.batch, 40);
  if (!batch) return fail(400, 'batch');
  const built = [], rejected = [];
  for (const r of b.results || []) {
    const id = Number(r.id);
    const w = await env.DB.prepare('SELECT id, uid, name, text FROM wishes WHERE id = ?').bind(id).first();
    if (!w) continue;
    const status = ['built', 'rejected', 'open', 'hidden'].includes(r.status) ? r.status : 'open';
    const note = clean(status === 'built' ? r.summary : r.reason, 400);
    await env.DB.prepare('UPDATE wishes SET status = ?, note = ?, batch = ? WHERE id = ?').bind(status, note, status === 'open' ? '' : batch, id).run();
    if (status === 'built') built.push({ id, uid: w.uid, name: w.name, text: w.text.slice(0, 300), summary: note });
    if (status === 'rejected') rejected.push({ id, uid: w.uid, name: w.name, text: w.text.slice(0, 300), reason: note });
  }
  if (b.publish !== false && (built.length || rejected.length)) {
    await env.DB.prepare('INSERT OR REPLACE INTO batches (id, created, title, body) VALUES (?, ?, ?, ?)')
      .bind(batch, now(), clean(b.title, 120) || `PATCH ${batch}`, JSON.stringify({ built, rejected })).run();
  }
  return json({ ok: true, built: built.length, rejected: rejected.length });
}

// how many players have tried it (for the streamer: is everyone finding the Petition Bee?)
async function adminStats(env) {
  const day = now() - 86400;
  const one = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()).n;
  return json({
    ok: true,
    wishers: await one('SELECT COUNT(DISTINCT uid) AS n FROM wishes'),
    voters: await one('SELECT COUNT(DISTINCT uid) AS n FROM votes'),
    wishes: await one('SELECT COUNT(*) AS n FROM wishes'),
    votes: await one('SELECT COUNT(*) AS n FROM votes'),
    open: await one("SELECT COUNT(*) AS n FROM wishes WHERE status = 'open'"),
    built: await one("SELECT COUNT(*) AS n FROM wishes WHERE status = 'built'"),
    wishers24h: await one('SELECT COUNT(DISTINCT uid) AS n FROM wishes WHERE created > ?', day),
    wishes24h: await one('SELECT COUNT(*) AS n FROM wishes WHERE created > ?', day),
  });
}

async function adminHide(req, env) {
  const b = await body(req);
  const ids = (b.ids || []).map(Number).filter(Number.isFinite);
  for (const id of ids) await env.DB.prepare("UPDATE wishes SET status = 'hidden', note = ? WHERE id = ?").bind(clean(b.reason, 200) || 'hidden', id).run();
  return json({ ok: true, hidden: ids.length });
}

export async function handle(req, env) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const p = url.pathname.replace(/\/+$/, '');
  try {
    if (p === '/api/wishes' && req.method === 'GET') return await listWishes(req, env, url);
    if (p === '/api/wishes' && req.method === 'POST') return await makeWish(req, env);
    if (p === '/api/vote' && req.method === 'POST') return await vote(req, env);
    if (p === '/api/report' && req.method === 'POST') return await report(req, env);
    if (p === '/api/notes' && req.method === 'GET') return await notes(req, env);
    if (p === '/api/health') return json({ ok: true, dev: env.DEV === '1' });
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req, env)) return fail(403, 'admin only');
      if (p === '/api/admin/open' && req.method === 'GET') return await adminOpen(env, url);
      if (p === '/api/admin/claim' && req.method === 'POST') return await adminClaim(req, env);
      if (p === '/api/admin/resolve' && req.method === 'POST') return await adminResolve(req, env);
      if (p === '/api/admin/hide' && req.method === 'POST') return await adminHide(req, env);
      if (p === '/api/admin/stats' && req.method === 'GET') return await adminStats(env);
    }
    return fail(404, 'not found');
  } catch (e) {
    return fail(500, 'server error');
  }
}

export default { fetch: (req, env) => handle(req, env) };
