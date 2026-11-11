// CLOUD SAVES. Everything permanent (wafers, wafer upgrades, unlocked classes, the archive, lifetime
// stats, friends, settings) lives in localStorage under "crypthop.*". A new build can land on a fresh
// origin, and a fresh origin means empty localStorage: that is the "every update resets" bug.
// So the whole profile is also mirrored to Wavedash cloud storage (per player, every device) and
// merged back in at boot. Merging never loses progress: counters take the max, sets take the union.
const PREFIX = 'crypthop.';
const STAMP = 'crypthop.savedAt';
export const SAVE_PATH = 'saves/profile.json';

function ls() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }

export function snapshotLocal(store = ls()) {
  const out = {};
  if (!store) return out;
  for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(PREFIX)) out[k] = store.getItem(k); }
  return out;
}

const parse = (s, d) => { try { const v = JSON.parse(s); return v ?? d; } catch (e) { return d; } };
const maxObj = (a = {}, b = {}) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) if (typeof v === 'number') o[k] = Math.max(Number(o[k]) || 0, v); else if (!(k in o)) o[k] = v; return o; };
const union = (a = [], b = []) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];

// merge two profiles (key -> string). `newer` decides plain values; progress is merged either way.
export function mergeProfiles(local, cloud) {
  const lt = Number(local[STAMP]) || 0, ct = Number(cloud[STAMP]) || 0;
  const newer = ct > lt ? cloud : local, older = newer === cloud ? local : cloud;
  const out = { ...older, ...newer };
  // meta: wafer upgrades only ever go up; unlocks and the archive only ever grow
  if (local['crypthop.meta'] || cloud['crypthop.meta']) {
    const a = parse(newer['crypthop.meta'], {}), b = parse(older['crypthop.meta'], {});
    const m = { ...b, ...a };
    m.ups = maxObj(a.ups, b.ups);
    m.bestHearts = maxObj(a.bestHearts, b.bestHearts);
    m.jackpots = Math.max(Number(a.jackpots) || 0, Number(b.jackpots) || 0);
    m.unlocked = union(a.unlocked, b.unlocked);
    m.seen = union(a.seen, b.seen);
    m.hats = union(a.hats, b.hats); // cosmetics are kept forever
    m.flair = union(a.flair, b.flair);
    m.wished = Math.max(Number(a.wished) || 0, Number(b.wished) || 0); // the Petition Bee (wishes.js)
    m.wishIntro = Math.max(Number(a.wishIntro) || 0, Number(b.wishIntro) || 0);
    m.wishPaid = !!(a.wishPaid || b.wishPaid);
    m.killed = maxObj(a.killed, b.killed);
    m.wafers = Number.isFinite(a.wafers) ? a.wafers : Number(b.wafers) || 0;
    if (!lt) m.wafers = Math.max(Number(a.wafers) || 0, Number(b.wafers) || 0); // a wiped device never wins on wafers
    out['crypthop.meta'] = JSON.stringify(m);
  }
  if (local['crypthop.best'] || cloud['crypthop.best']) out['crypthop.best'] = String(Math.max(Number(local['crypthop.best']) || 0, Number(cloud['crypthop.best']) || 0));
  if (local['crypthop.life'] || cloud['crypthop.life']) out['crypthop.life'] = JSON.stringify(maxObj(parse(local['crypthop.life'], {}), parse(cloud['crypthop.life'], {})));
  if (local['crypthop.friends'] || cloud['crypthop.friends']) {
    const a = parse(newer['crypthop.friends'], {}), b = parse(older['crypthop.friends'], {});
    const byId = (x, y) => { const seen = new Map(); for (const f of [...(x || []), ...(y || [])]) if (f && f.id && !seen.has(f.id)) seen.set(f.id, f); return [...seen.values()]; };
    out['crypthop.friends'] = JSON.stringify({ friends: byId(a.friends, b.friends), recent: byId(a.recent, b.recent).slice(0, 30) });
  }
  out[STAMP] = String(Math.max(lt, ct));
  return out;
}

// Some hosts run the game in a sandboxed frame where localStorage throws (or is wiped every load).
// Then every save quietly failed. Detect it and put a memory-backed localStorage in its place, so the
// game keeps working and the cloud save (which then carries everything) still has a profile to read.
export function ensureStorage() {
  try {
    const k = '__cryptslop_probe__';
    window.localStorage.setItem(k, '1');
    const ok = window.localStorage.getItem(k) === '1';
    window.localStorage.removeItem(k);
    if (ok) return 'local';
  } catch (e) { /* blocked */ }
  const data = new Map();
  const shim = {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.has(String(k)) ? data.get(String(k)) : null; },
    setItem(k, v) { data.set(String(k), String(v)); },
    removeItem(k) { data.delete(String(k)); },
    clear() { data.clear(); },
  };
  try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true, writable: true }); } catch (e) { /* ignore */ }
  try { globalThis.localStorage = shim; } catch (e) { /* ignore */ }
  return 'memory';
}

export class CloudSave {
  constructor(WD) {
    this.WD = WD;
    this.lastPush = -1e9;
    this.dirty = false;
    this.busy = false;
    // never upload before the cloud copy has been read and merged in: an early upload of a blank
    // profile (a refresh in the first seconds) would overwrite your real one
    this.pulled = false;
    this.status = WD ? 'LOADING CLOUD SAVE' : 'LOCAL ONLY';
  }
  get on() { return !!(this.WD && this.WD.uploadRemoteFile && this.WD.downloadRemoteFile && this.WD.writeLocalFile && this.WD.readLocalFile); }

  // download the cloud profile and merge it into storage; true if anything changed. Retries on errors.
  async pull(tries = 4) {
    const store = ls();
    if (!this.on || !store) return false;
    for (let attempt = 0; attempt < tries; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      try {
        const ex = await this.WD.remoteFileExists(SAVE_PATH);
        if (!ex || !ex.success) continue; // could not ask: try again
        if (!ex.data) { this.status = 'NO CLOUD SAVE YET'; this.pulled = true; this.dirty = true; return false; }
        const dl = await this.WD.downloadRemoteFile(SAVE_PATH);
        if (!dl || !dl.success) continue;
        const bytes = await this.WD.readLocalFile(SAVE_PATH);
        if (!bytes) continue;
        const cloud = parse(new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)), {});
        if (!cloud || typeof cloud !== 'object' || !cloud.profile) { this.status = 'CLOUD SAVE UNREADABLE'; this.pulled = true; return false; }
        const merged = mergeProfiles(snapshotLocal(store), cloud.profile);
        let changed = false;
        for (const [k, v] of Object.entries(merged)) if (k.startsWith(PREFIX) && typeof v === 'string' && store.getItem(k) !== v) { store.setItem(k, v); changed = true; }
        this.status = 'CLOUD SAVE LOADED';
        this.pulled = true;
        this.dirty = true; // push the merged result back up so every device converges
        return changed;
      } catch (e) { /* try again */ }
    }
    this.status = 'CLOUD SAVE OFFLINE';
    return false;
  }

  // upload the profile (throttled well under the 30/min limit unless forced)
  async push(now, force = false) {
    const store = ls();
    if (!this.on || !store || this.busy) return false;
    if (!this.pulled) { this.dirty = true; return false; }
    if (!force && now - this.lastPush < 10) { this.dirty = true; return false; }
    this.busy = true; this.lastPush = now; this.dirty = false;
    try {
      store.setItem(STAMP, String(Date.now()));
      const body = JSON.stringify({ v: 1, profile: snapshotLocal(store) });
      await this.WD.writeLocalFile(SAVE_PATH, new TextEncoder().encode(body));
      const up = await this.WD.uploadRemoteFile(SAVE_PATH);
      this.status = up && up.success ? 'SAVED TO CLOUD' : 'CLOUD SAVE FAILED';
      if (!(up && up.success)) this.dirty = true;
      return !!(up && up.success);
    } catch (e) { this.status = 'CLOUD SAVE FAILED'; this.dirty = true; return false; } finally { this.busy = false; }
  }

  // anything unsaved goes up within ~15 seconds (about 240 uploads an hour at most: under the limit)
  tick(now) { if (this.dirty && now - this.lastPush > 15) this.push(now); }
}
