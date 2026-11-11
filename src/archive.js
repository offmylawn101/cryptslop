// THE ARCHIVE: every foe you have seen. The list view pages through them; click (or Enter, or a pad's A)
// a recorded entry to open its file: stats read straight from the enemy data, the specimen itself in a
// little 3D viewport playing its idle loop, and the extended field notes.
// Everything is data-driven: any type in ENEMY_TYPES shows up here, with whatever stats it has.
import * as THREE from 'three';
import { drawText, drawSmall } from './font.js';
import { ENEMY_TYPES, ENEMY_NAMES, ENEMIES, LORE, SCORE, HONEY_FOR_KILL } from './data.js';
import { ENEMY_BUILDERS, animateEnemy } from './models.js';
import { sharedUniforms, MAX_LIGHTS } from './retro.js';
import { LORE_EXT } from './archiveLore.js';

const C = { text: '#f2ead8', dim: '#8c88a8', hot: '#ffd040', red: '#ff4a5a', green: '#6aff9a', blue: '#4ff0ff', pink: '#ff6ad8' };
const ROW_H = 22;

function wrap(text, maxChars) {
  const lines = []; let cur = '';
  for (let w of String(text).split(' ')) {
    while (w.length > maxChars) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, maxChars)); w = w.slice(maxChars); }
    if (!w) continue;
    if ((cur ? cur.length + 1 : 0) + w.length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------- data ----------------
export const nameOf = (t) => ENEMY_NAMES[ENEMY_TYPES.indexOf(t)] || String(t).toUpperCase();
// the entries the archive lists (the FINGLER is a secret until you have seen one)
export function archiveTypes(seen = []) { return ENEMY_TYPES.filter((t) => t !== 'fingler' || seen.includes('fingler')); }

const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')) : String(v).toUpperCase());
const SKIP = new Set(['hp', 'speed', 'radius', 'hit', 'height', 'melee', 'ranged', 'pattern', 'hover']);
const TAGS = { boss: 'BOSS', randomling: 'RANDOMLING', hunter: 'HUNTS ONE PLAYER', elite: 'ELITE' };

// stat lines for one foe: [label, value, color]. Reads whatever the enemy definition has, so new enemies
// (and new kinds of special rules) need no archive code.
export function statLines(type) {
  const d = ENEMIES[type] || {}, idx = ENEMY_TYPES.indexOf(type), out = [];
  if (d.hp != null) out.push(['HEALTH', fmt(d.hp), C.red]);
  if (d.speed != null) out.push(['SPEED', `${fmt(d.speed)} M/S`, C.blue]);
  if (d.height != null) out.push(['SIZE', `${fmt(d.height)} M TALL`, C.text]);
  if (d.melee) out.push(['MELEE', `${fmt(d.melee.dmg)} DMG  ${fmt(d.melee.range)} M  ${fmt(d.melee.windup)}S WINDUP`, C.hot]);
  if (d.ranged) out.push(['RANGED', `${fmt(d.ranged.dmg)} DMG  EVERY ${fmt(d.ranged.cooldown)}S  ${fmt(d.ranged.range)} M`, C.hot]);
  if (d.hover) out.push(['FLIES', `${fmt(d.hover)} M UP`, C.blue]);
  if (Array.isArray(d.pattern) && d.pattern.length) {
    const atk = [...new Set(d.pattern.map((p) => { const [k, what, n] = String(p).split(':'); return k === 'summon' && what ? `SUMMONS ${n || ''}${n ? 'X ' : ''}${nameOf(what)}` : k.toUpperCase(); }))];
    out.push(['ATTACKS', atk.join(', '), C.pink]);
  }
  const tags = Object.entries(TAGS).filter(([k]) => d[k] === true).map(([, v]) => v);
  for (const [k, v] of Object.entries(d)) {
    if (SKIP.has(k) || k in TAGS) continue;
    if (v === true) tags.push(k.toUpperCase());
    else if (v && typeof v === 'object' && !Array.isArray(v)) out.push([k.toUpperCase(), Object.entries(v).filter(([, x]) => typeof x === 'number' || typeof x === 'string').map(([a, x]) => `${a.toUpperCase()} ${fmt(x)}`).join('  '), C.green]);
    else if (typeof v === 'number' || typeof v === 'string') out.push([k.toUpperCase(), fmt(v), C.green]);
  }
  if (tags.length) out.push(['TRAITS', tags.join(', '), C.pink]);
  if (SCORE && SCORE[type] != null) out.push(['SCORE', fmt(SCORE[type]), C.dim]);
  if (idx >= 0 && HONEY_FOR_KILL[idx] != null) out.push(['HONEY', fmt(HONEY_FOR_KILL[idx]), C.dim]);
  return out;
}

// the long entry: hand-written if there is one, otherwise written from the short lore and the stats
export function extendedLore(type) {
  if (LORE_EXT[type]) return LORE_EXT[type];
  const d = ENEMIES[type] || {};
  const bits = [LORE[type] || `THE ARCHIVE HAS ONLY JUST OPENED A FILE ON THE ${nameOf(type)}.`];
  if (d.boss) bits.push('IT GUARDS A BOSS DOOR. IT TOOK THE JOB SERIOUSLY.');
  if (d.hover) bits.push('IT DOES NOT TOUCH THE FLOOR IF IT CAN HELP IT.');
  if (d.hp >= 300) bits.push('IT IS VERY HARD TO KILL. THE ARCHIVE RECOMMENDS DOING IT ANYWAY.');
  else if (d.hp && d.hp <= 25) bits.push('IT GOES DOWN EASY. IT KNOWS. IT COMPENSATES WITH NUMBERS.');
  bits.push('FURTHER NOTES PENDING. THE ARCHIVIST IS ON BREAK.');
  return bits.join(' ');
}

// ---------------- the specimen viewport ----------------
// The foe is built with the game's own model builder into a private scene and rendered into a small
// render target, which is read back and drawn into the UI canvas like any other sprite. That way it
// works the same on a monitor, at 4:3, on touch screens and on the VR HUD plane.
export class SpecimenView {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
    this.type = null; this.model = null; this.t = 0; this.sz = 0; this.rt = null;
    this.lastT = 0;
  }

  setType(type) {
    if (this.type === type) return;
    if (this.model) { this.scene.remove(this.model); disposeTree(this.model); this.model = null; }
    this.type = type; this.t = 0;
    const b = ENEMY_BUILDERS[ENEMY_TYPES.indexOf(type)];
    if (!b) return;
    try { this.model = b(); } catch (e) { this.model = null; return; }
    if (this.model.userData && this.model.userData.tag) this.model.userData.tag.visible = false;
    this.scene.add(this.model);
    this.step(0.001);
    this.model.rotation.y = 0;
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model, true);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
    const size = box.getSize(new THREE.Vector3());
    const h = Math.max(0.3, size.y), w = Math.max(0.3, Math.hypot(size.x, size.z));
    const cy = (box.min.y + box.max.y) / 2;
    const half = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    const dist = (Math.max(h, w) / 2) / half * 1.15 + w / 2;
    this.frame = { cy, h, w, dist };
    this.cam.position.set(0, cy + h * 0.18, dist);
    this.cam.lookAt(0, cy, 0);
    this.cam.far = dist * 6 + 50; this.cam.updateProjectionMatrix();
  }

  step(dt) {
    if (!this.model) return;
    this.t += dt;
    try { animateEnemy(this.model, this.t, false, 0, dt); } catch (e) { /* a builder without an animator: hold still */ }
    this.model.rotation.y = this.t * 0.6;
  }

  ensureSize(sz) {
    if (this.sz === sz && this.rt) return;
    if (this.rt) this.rt.dispose();
    this.sz = sz;
    this.rt = new THREE.WebGLRenderTarget(sz, sz, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    this.buf = new Uint8Array(sz * sz * 4);
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = sz;
      this.cctx = this.canvas.getContext('2d'); this.img = this.cctx.createImageData(sz, sz);
    }
  }

  // render the specimen and draw it at (x, y) on the UI canvas. Restores every bit of shared GPU state.
  draw(renderer, ctx, x, y, sz, now) {
    this.ensureSize(sz);
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastT || now)) / 1000)); this.lastT = now;
    this.step(dt);
    if (!this.model || !renderer || !this.canvas) return false;
    const S = sharedUniforms, f = this.frame;
    const save = {
      amb: S.uAmbient.value.clone(), fogC: S.uFogColor.value.clone(), near: S.uFogNear.value, far: S.uFogFar.value, snap: S.uSnap.value.clone(),
      lp: S.uLightPos.value.map((v) => v.clone()), lc: S.uLightCol.value.map((v) => v.clone()), lr: [...S.uLightRange.value],
    };
    const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    const xrOn = renderer.xr.enabled;
    try {
      S.uAmbient.value.set(0.32, 0.3, 0.38);
      S.uFogColor.value.set(0.05, 0.03, 0.09); S.uFogNear.value = f.dist * 4; S.uFogFar.value = f.dist * 8;
      S.uSnap.value.set(sz / 2, sz / 2);
      for (let i = 0; i < MAX_LIGHTS; i++) { S.uLightPos.value[i].set(0, -9999, 0); S.uLightCol.value[i].set(0, 0, 0); S.uLightRange.value[i] = 1; }
      S.uLightPos.value[0].set(f.dist * 0.7, f.cy + f.h * 1.2, f.dist); S.uLightCol.value[0].set(1.2, 1.05, 0.9); S.uLightRange.value[0] = f.dist * 4;
      if (MAX_LIGHTS > 1) { S.uLightPos.value[1].set(-f.dist, f.cy + f.h * 0.4, -f.dist * 0.8); S.uLightCol.value[1].set(0.35, 0.5, 1.0); S.uLightRange.value[1] = f.dist * 4; }
      renderer.xr.enabled = false; // in VR three would swap our camera for the headset's
      renderer.setRenderTarget(this.rt);
      renderer.setClearColor(0x0d0818, 1);
      renderer.clear(true, true, true);
      renderer.render(this.scene, this.cam);
      renderer.readRenderTargetPixels(this.rt, 0, 0, sz, sz, this.buf);
    } finally {
      renderer.xr.enabled = xrOn;
      renderer.setRenderTarget(prevRT);
      renderer.setClearColor(prevClear, prevAlpha);
      S.uAmbient.value.copy(save.amb); S.uFogColor.value.copy(save.fogC); S.uFogNear.value = save.near; S.uFogFar.value = save.far; S.uSnap.value.copy(save.snap);
      for (let i = 0; i < MAX_LIGHTS; i++) { S.uLightPos.value[i].copy(save.lp[i]); S.uLightCol.value[i].copy(save.lc[i]); S.uLightRange.value[i] = save.lr[i]; }
    }
    // WebGL reads bottom-up: flip rows into the image
    const d = this.img.data, row = sz * 4;
    for (let j = 0; j < sz; j++) d.set(this.buf.subarray((sz - 1 - j) * row, (sz - j) * row), j * row);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    this.cctx.putImageData(this.img, 0, 0);
    ctx.drawImage(this.canvas, x, y);
    return true;
  }
}

function disposeTree(o) {
  o.traverse((n) => {
    // geometry can be shared between copies of a model, so only the per-copy materials are freed
    // (three re-uploads a disposed material if anything still uses it)
    if (n.material) for (const m of Array.isArray(n.material) ? n.material : [n.material]) if (m.dispose) m.dispose();
  });
}

// ---------------- the screen ----------------
// ui: the UI instance (ctx, W, H, mx, my, buttons, panel, button, splitText, edges)
export function drawArchiveScreen(ui) {
  const ctx = ui.ctx, W = ui.W, H = ui.H, g = ui.g;
  ctx.fillStyle = 'rgba(8,4,16,0.92)'; ctx.fillRect(0, 0, W, H);
  if (ui.archOpen) return drawEntry(ui);
  ui.splitText('THE ARCHIVE', W / 2, 6, C.hot, 2, 'center');
  const seen = (g.meta && g.meta.seen) || [];
  const all = archiveTypes(seen);
  drawSmall(ctx, `${all.filter((t) => seen.includes(t)).length}/${all.length} RECORDED. CLICK AN ENTRY TO OPEN ITS FILE.`, W / 2, 24, C.dim, 'center');
  const per = Math.max(1, Math.floor((H - 52) / ROW_H));
  const pages = Math.max(1, Math.ceil(all.length / per));
  ui.archPage = Math.max(0, Math.min(pages - 1, ui.archPage || 0));
  const onPage = all.slice(ui.archPage * per, ui.archPage * per + per);
  ui.archCur = Math.max(0, Math.min(onPage.length - 1, ui.archCur || 0));
  ui.archRows = onPage;
  const pw = Math.min(W - 16, 340), px = Math.round(W / 2 - pw / 2);
  onPage.forEach((t, i) => {
    const y = 33 + i * ROW_H, known = seen.includes(t);
    const hot = known && ((ui.mx >= px && ui.mx <= px + pw && ui.my >= y && ui.my <= y + 20) || (ui.archKeys && ui.archCur === i));
    ui.panel(px, y, pw, 20);
    if (hot) { ctx.fillStyle = 'rgba(255,208,64,0.16)'; ctx.fillRect(px + 1, y + 1, pw - 2, 18); }
    drawText(ctx, known ? nameOf(t) : '? ? ?', px + 4, y + 3, known ? C.hot : C.dim);
    drawSmall(ctx, known ? `KILLED ${(g.meta.killed && g.meta.killed[t]) || 0}${hot ? '   OPEN >' : ''}` : '', px + pw - 4, y + 4, hot ? C.green : C.dim, 'right');
    drawSmall(ctx, (known ? LORE[t] || extendedLore(t) : 'YOU HAVE NOT SEEN THIS ONE YET.').slice(0, Math.floor((pw - 8) / 4)), px + 4, y + 12, known ? C.text : C.dim);
    if (known) ui.buttons.push({ x: px, y, w: pw, h: 20, action: () => openEntry(ui, t) });
  });
  const by = H - 17;
  ui.button('<', px, by, 20, 13, () => { ui.archPage--; ui.archCur = 0; });
  ui.button('>', px + 24, by, 20, 13, () => { ui.archPage++; ui.archCur = 0; });
  drawSmall(ctx, `PAGE ${ui.archPage + 1}/${pages}`, px + 50, by + 4, C.dim);
  ui.button('BACK', px + pw - 70, by, 70, 13, () => { ui.screen = 'title'; });
}

export function openEntry(ui, type) {
  ui.archOpen = type; ui.archScroll = 0;
  if (!ui.specimen) ui.specimen = new SpecimenView();
  try { ui.specimen.setType(type); } catch (e) { /* no model: the file still opens */ }
}

function seenList(ui) { const seen = (ui.g.meta && ui.g.meta.seen) || []; return archiveTypes(seen).filter((t) => seen.includes(t)); }
function stepEntry(ui, dir) {
  const list = seenList(ui); if (!list.length) return;
  const i = list.indexOf(ui.archOpen);
  openEntry(ui, list[(i + dir + list.length) % list.length]);
}

function drawEntry(ui) {
  const ctx = ui.ctx, W = ui.W, H = ui.H, g = ui.g, t = ui.archOpen;
  const name = nameOf(t);
  ui.splitText(name, W / 2, 5, C.hot, name.length * 12 < W - 16 ? 2 : 1, 'center');
  // the viewport takes whatever room the field notes leave (they scroll past 8 lines)
  const loreN = Math.min(8, wrap(extendedLore(t), Math.max(10, Math.floor((W - 20) / 4))).length);
  const vs = Math.max(56, Math.min(168, Math.floor(W * 0.42), H - 26 - 8 - loreN * 7 - 26));
  const vx = 8, vy = 26;
  ui.panel(vx - 2, vy - 2, vs + 4, vs + 4);
  const drew = ui.specimen && ui.specimen.draw(g.rr && g.rr.renderer, ctx, vx, vy, vs, typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (!drew) { ctx.fillStyle = '#0d0818'; ctx.fillRect(vx, vy, vs, vs); drawSmall(ctx, 'NO SPECIMEN', vx + vs / 2, vy + vs / 2 - 2, C.dim, 'center'); }
  drawSmall(ctx, 'SPECIMEN (IDLE)', vx + 2, vy + vs - 7, C.dim);
  // stats, to the right of the viewport
  const sx = vx + vs + 10, sw = W - sx - 8, maxC = Math.max(8, Math.floor(sw / 4));
  let y = vy;
  const killed = (g.meta.killed && g.meta.killed[t]) || 0;
  const lines = [['KILLED', `${killed} (EVERY RUN)`, C.text], ...statLines(t)];
  for (const [k, v, col] of lines) {
    if (y > vy + vs) break;
    drawSmall(ctx, k, sx, y, C.dim);
    const vl = wrap(v, Math.max(4, maxC - 9));
    vl.slice(0, 2).forEach((l, n) => drawSmall(ctx, l, sx + 36, y + n * 7, col));
    y += 7 * Math.min(2, vl.length) + 2;
  }
  // the extended entry, scrollable
  const ly = vy + vs + 8, lh = H - 22 - ly, perLine = Math.max(10, Math.floor((W - 20) / 4));
  const text = wrap(extendedLore(t), perLine);
  const rows = Math.max(1, Math.floor(lh / 7));
  ui.archScroll = Math.max(0, Math.min(Math.max(0, text.length - rows), ui.archScroll || 0));
  ui.panel(6, ly - 3, W - 12, lh + 4);
  text.slice(ui.archScroll, ui.archScroll + rows).forEach((l, n) => drawSmall(ctx, l, 10, ly + n * 7, C.text));
  if (text.length > rows) drawSmall(ctx, `${ui.archScroll + rows < text.length ? 'V MORE' : 'END'}`, W - 10, ly + lh - 6, C.dim, 'right');
  const by = H - 17;
  ui.button('< PREV', 8, by, 50, 13, () => stepEntry(ui, -1));
  ui.button('NEXT >', 62, by, 50, 13, () => stepEntry(ui, 1));
  if (text.length > rows) { ui.button('^', 116, by, 16, 13, () => { ui.archScroll--; }); ui.button('V', 136, by, 16, 13, () => { ui.archScroll++; }); }
  ui.button('BACK', W - 78, by, 70, 13, () => { ui.archOpen = null; });
}

// keys on the archive screen. Returns true when it used the key.
export function archiveKey(ui, e) {
  const c = e.code;
  if (ui.archOpen) {
    if (c === 'Escape' || c === 'Backspace') { ui.archOpen = null; return true; }
    if (c === 'ArrowRight' || c === 'KeyD') { stepEntry(ui, 1); return true; }
    if (c === 'ArrowLeft' || c === 'KeyA') { stepEntry(ui, -1); return true; }
    if (c === 'ArrowDown' || c === 'KeyS') { ui.archScroll = (ui.archScroll || 0) + 1; return true; }
    if (c === 'ArrowUp' || c === 'KeyW') { ui.archScroll = (ui.archScroll || 0) - 1; return true; }
    return false;
  }
  if (c === 'Escape') { ui.screen = 'title'; return true; }
  if (c === 'ArrowRight' || c === 'KeyD') { ui.archPage = (ui.archPage || 0) + 1; ui.archCur = 0; return true; }
  if (c === 'ArrowLeft' || c === 'KeyA') { ui.archPage = (ui.archPage || 0) - 1; ui.archCur = 0; return true; }
  if (c === 'ArrowDown' || c === 'KeyS') { ui.archKeys = true; ui.archCur = (ui.archCur || 0) + 1; return true; }
  if (c === 'ArrowUp' || c === 'KeyW') { ui.archKeys = true; ui.archCur = Math.max(0, (ui.archCur || 0) - 1); return true; }
  if (c === 'Enter' || c === 'Space') {
    const t = ui.archRows && ui.archRows[ui.archCur || 0];
    const seen = (ui.g.meta && ui.g.meta.seen) || [];
    if (t && seen.includes(t)) { openEntry(ui, t); return true; }
  }
  return false;
}
