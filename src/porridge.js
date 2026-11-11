// PIXEL PORRIDGE, part two: the EXCLUSIVE SHOP.
// Relics sometimes come with a PIXEL PORRIDGE TOKEN (features.js). Tokens still nag you and nibble your
// honey while you hold them. Spending one opens the EXCLUSIVE SHOP for exactly 30 seconds: cosmetics
// nobody needs at prices nobody can pay (5,000 honey and up). Leave, and the token is gone.
// It is a joke about limited-time storefronts. It is honey only; no real money exists in Cryptslop.
import * as THREE from 'three';
import { drawText, drawSmall } from './font.js';
import { retroMaterial } from './retro.js';

const C = { text: '#f2ead8', dim: '#8c88a8', hot: '#ffd040', red: '#ff4a5a', green: '#6aff9a', blue: '#4ff0ff', pink: '#ff6ad8' };

export const PORRIDGE_SHOP_SEC = 30;
// FLAIR: exclusive cosmetics, kept forever, seen by everyone. kind: where it sits on you.
export const FLAIR = {
  bowl: { name: 'GOLDEN PORRIDGE BOWL', cost: 5000, kind: 'head', desc: 'A BOWL OF STEAMING PORRIDGE, WORN AS A HAT' },
  tokencrown: { name: 'CROWN OF UNSPENT TOKENS', cost: 8000, kind: 'head', desc: 'SIX TOKENS ORBIT YOUR HEAD. NONE OF THEM ARE SPENDABLE' },
  halo: { name: 'ENGAGEMENT HALO', cost: 12000, kind: 'head', desc: 'TWO RINGS THAT SPIN FASTER THE LONGER YOU PLAY' },
  aura: { name: 'AURA OF FOMO', cost: 15000, kind: 'body', desc: 'A PULSING PINK GLOW. OTHER BEES FEEL LEFT OUT' },
  trail: { name: 'LIMITED-TIME TRAIL', cost: 20000, kind: 'trail', desc: 'RAINBOW SPARKS WHEREVER YOU WALK. FOREVER. (NOT LIMITED)' },
  fin: { name: 'WHALE FIN', cost: 25000, kind: 'back', desc: 'A BIG BLUE FIN ON YOUR BACK SO EVERYONE KNOWS' },
  wings: { name: 'PREMIUM WINGS', cost: 30000, kind: 'back', desc: 'GOLD GLASS WINGS. THEY DO NOT FLY. THEY FLAP' },
  cloud: { name: 'STORMCLOUD OF REGRET', cost: 40000, kind: 'head', desc: 'A SMALL CLOUD THAT RAINS ON YOU, PERSONALLY' },
  plinth: { name: 'THE PEDESTAL', cost: 50000, kind: 'feet', desc: 'A GOLD PLINTH UNDER YOUR FEET AT ALL TIMES' },
  // not for sale: the Petition Bee gives it to players whose wish was built into the game (wishes.js)
  wishcrown: { name: 'WISHMAKER CROWN', cost: 0, gift: true, kind: 'head', desc: 'CHAT BUILT YOUR WISH INTO THE GAME' },
};
export const FLAIR_IDS = Object.keys(FLAIR).filter((id) => !FLAIR[id].gift); // what the exclusive shop sells

// ---------------- the models ----------------
function box(parent, geo, color, { emissive = [0, 0, 0], pos = [0, 0, 0], rot = [0, 0, 0], opacity = 1 } = {}) {
  const m = new THREE.Mesh(geo, retroMaterial({ color, emissive, transparent: opacity < 1, opacity, side: THREE.DoubleSide }));
  m.position.set(...pos); m.rotation.set(...rot);
  if (opacity < 1) m.material.depthWrite = false;
  parent.add(m); return m;
}

// a flair model, feet at y=0, facing +Z like the bees. userData.tick(t) animates it.
export function makeFlair(id) {
  const g = new THREE.Group(), u = { id, kind: FLAIR[id] ? FLAIR[id].kind : null, tick: () => {} };
  g.userData = u;
  const HEAD = 1.9;
  switch (id) {
    case 'bowl': {
      box(g, new THREE.CylinderGeometry(0.26, 0.17, 0.16, 8), [1, 0.8, 0.25], { emissive: [0.5, 0.35, 0.05], pos: [0, HEAD, 0] });
      box(g, new THREE.CylinderGeometry(0.24, 0.24, 0.02, 8), [0.95, 0.88, 0.7], { pos: [0, HEAD + 0.08, 0] });
      const steam = [0, 1, 2].map((k) => box(g, new THREE.BoxGeometry(0.06, 0.06, 0.06), [1, 1, 1], { emissive: [0.5, 0.5, 0.5], opacity: 0.6 }));
      u.tick = (t) => steam.forEach((s, k) => { const p = (t * 0.6 + k / 3) % 1; s.position.set(Math.sin(t * 2 + k * 2) * 0.08, HEAD + 0.12 + p * 0.5, Math.cos(t * 2 + k) * 0.06); s.scale.setScalar(1 - p * 0.6); });
      break;
    }
    case 'tokencrown': {
      const coins = Array.from({ length: 6 }, () => box(g, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8), [1, 0.4, 0.85], { emissive: [0.6, 0.15, 0.45], rot: [Math.PI / 2, 0, 0] }));
      u.tick = (t) => coins.forEach((c, k) => { const a = t * 1.4 + (k / 6) * Math.PI * 2; c.position.set(Math.cos(a) * 0.34, HEAD + 0.18 + Math.sin(t * 3 + k) * 0.04, Math.sin(a) * 0.34); c.rotation.z = a; });
      break;
    }
    case 'halo': {
      const a = box(g, new THREE.TorusGeometry(0.26, 0.025, 4, 12), [0, 0, 0], { emissive: [1, 0.4, 0.85], pos: [0, HEAD + 0.25, 0], rot: [Math.PI / 2, 0, 0] });
      const b = box(g, new THREE.TorusGeometry(0.34, 0.02, 4, 12), [0, 0, 0], { emissive: [0.3, 0.95, 1], pos: [0, HEAD + 0.25, 0], rot: [Math.PI / 2, 0, 0] });
      u.tick = (t) => { const sp = 1.5 + Math.min(6, t / 60); a.rotation.z = t * sp; b.rotation.z = -t * sp * 0.7; a.rotation.x = Math.PI / 2 + Math.sin(t) * 0.2; b.rotation.y = Math.cos(t * 0.8) * 0.25; };
      break;
    }
    case 'aura': {
      const s = box(g, new THREE.IcosahedronGeometry(0.95, 1), [1, 0.3, 0.8], { emissive: [0.8, 0.2, 0.6], pos: [0, 1.0, 0], opacity: 0.22 });
      u.tick = (t) => { s.scale.setScalar(1 + Math.sin(t * 4) * 0.08); s.rotation.y = t * 0.5; s.material.uniforms.uOpacity.value = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(t * 4)); };
      break;
    }
    case 'trail': break; // sparks only (emitted by the game every frame you move)
    case 'fin':
      box(g, new THREE.ConeGeometry(0.28, 0.85, 3), [0.2, 0.45, 0.95], { emissive: [0.05, 0.12, 0.3], pos: [0, 1.75, -0.32], rot: [-0.35, 0, 0] });
      break;
    case 'wings': {
      const wl = new THREE.Group(), wr = new THREE.Group(); wl.position.set(0.12, 1.35, -0.25); wr.position.set(-0.12, 1.35, -0.25); g.add(wl, wr);
      box(wl, new THREE.BoxGeometry(0.9, 0.5, 0.03), [1, 0.85, 0.3], { emissive: [0.6, 0.45, 0.1], pos: [0.45, 0.1, 0], opacity: 0.55 });
      box(wr, new THREE.BoxGeometry(0.9, 0.5, 0.03), [1, 0.85, 0.3], { emissive: [0.6, 0.45, 0.1], pos: [-0.45, 0.1, 0], opacity: 0.55 });
      u.tick = (t) => { const f = Math.sin(t * 6) * 0.45; wl.rotation.y = -0.3 - f; wr.rotation.y = 0.3 + f; };
      break;
    }
    case 'cloud': {
      const c = new THREE.Group(); c.position.y = HEAD + 0.75; g.add(c);
      for (const [x, y, z, r] of [[0, 0, 0, 0.28], [0.25, -0.03, 0.05, 0.22], [-0.25, -0.02, -0.04, 0.22], [0.08, 0.12, -0.1, 0.2]]) box(c, new THREE.IcosahedronGeometry(r, 0), [0.45, 0.45, 0.52], { pos: [x, y, z] });
      u.rain = true;
      u.tick = (t) => { c.position.x = Math.sin(t * 0.9) * 0.08; };
      break;
    }
    case 'plinth':
      box(g, new THREE.CylinderGeometry(0.55, 0.62, 0.3, 8), [1, 0.8, 0.25], { emissive: [0.45, 0.32, 0.05], pos: [0, -0.15, 0] });
      box(g, new THREE.CylinderGeometry(0.62, 0.62, 0.04, 8), [1, 0.9, 0.5], { emissive: [0.5, 0.4, 0.1], pos: [0, 0.01, 0] });
      break;
    case 'wishcrown': { // a gold crown with a star that turns over your head
      box(g, new THREE.CylinderGeometry(0.24, 0.22, 0.12, 8, 1, true), [1, 0.82, 0.25], { emissive: [0.55, 0.4, 0.06], pos: [0, HEAD + 0.06, 0] });
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; box(g, new THREE.ConeGeometry(0.05, 0.12, 4), [1, 0.85, 0.3], { emissive: [0.6, 0.45, 0.08], pos: [Math.cos(a) * 0.22, HEAD + 0.17, Math.sin(a) * 0.22] }); }
      const star = box(g, new THREE.OctahedronGeometry(0.09, 0), [1, 1, 0.7], { emissive: [1, 0.85, 0.3], pos: [0, HEAD + 0.42, 0] });
      u.tick = (t) => { star.rotation.y = t * 2.2; star.position.y = HEAD + 0.42 + Math.sin(t * 2) * 0.04; };
      break;
    }
    default: return null;
  }
  return g;
}

export function installPorridge(Game) {
  Object.defineProperties(Game.prototype, Object.getOwnPropertyDescriptors({
    get flairOn() { const f = this.meta && this.meta.flairOn; return FLAIR[f] && (this.meta.flair || []).includes(f) ? f : null; },

    // ---------------- the shop ----------------
    porridgeShopLeft() { return this.porridgeShopUntil ? Math.max(0, (this.porridgeShopUntil - Date.now()) / 1000) : 0; },
    porridgeShopActive() { return this.porridgeShopLeft() > 0; },
    // spend a token: the shop opens for 30 seconds of wall-clock time (pausing does not stop it)
    openPorridgeShop() {
      if (this.porridgeShopActive()) { this.showPorridgeShop(); return 'THE EXCLUSIVE SHOP IS ALREADY OPEN'; }
      if ((this.meta.porridge || 0) < 1) return 'NO PORRIDGE TOKENS. FIND RELICS.';
      if (this.mode !== 'play') return 'THE EXCLUSIVE SHOP ONLY OPENS DURING A RUN';
      this.meta.porridge--; this.saveMeta();
      this.stats.add('porridgeShops');
      this.porridgeShopUntil = Date.now() + PORRIDGE_SHOP_SEC * 1000;
      this.porridgeSel = 0; this.porridgeMsg = 'YOU HAVE 30 SECONDS. THIS WILL NEVER HAPPEN AGAIN (UNTIL YOUR NEXT TOKEN)';
      this.showPorridgeShop();
      this.sound.play('jackpot');
      return 'THE EXCLUSIVE SHOP IS OPEN';
    },
    showPorridgeShop() {
      if (this.casino && this.casino.open) this.casino.close();
      try { if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
      this.locked = false; // controllers, touch and VR have no pointer lock to drop
      this.ui.screen = 'porridge';
    },
    closePorridgeShop(why) {
      if (this.ui.screen === 'porridge') this.ui.screen = null; // in a run: back to the pause menu
      if (why === 'leave') { this.porridgeShopUntil = 0; this.ui.toast('YOU LEFT THE EXCLUSIVE SHOP. IT WILL REMEMBER THIS.'); } // the token is gone either way
      if (why === 'time') { this.porridgeShopUntil = 0; this.ui.banner('THE EXCLUSIVE SHOP HAS CLOSED. IT MISSES YOU ALREADY.', 3); this.sound.play('deny'); }
    },
    buyFlair(id) {
      const f = FLAIR[id]; if (!f) return 'NOT FOR SALE';
      if (f.gift && !(this.meta.flair || []).includes(id)) return 'NOT FOR SALE. CHAT HAS TO BUILD YOUR WISH';
      const owned = this.meta.flair || [];
      if (owned.includes(id)) { this.meta.flairOn = this.meta.flairOn === id ? null : id; this.saveMeta(); return this.meta.flairOn ? `WEARING: ${f.name}` : 'FLAIR OFF'; }
      if (!this.porridgeShopActive()) return 'THE EXCLUSIVE SHOP IS CLOSED';
      if ((this.honey || 0) < f.cost) return `NEEDS ${f.cost} HONEY. YOU HAVE ${Math.floor(this.honey || 0)}. SO CLOSE.`;
      this.spendHoney(f.cost, 'porridge');
      this.meta.flair = [...owned, id]; this.meta.flairOn = id; this.saveMeta();
      this.stats.add('flairBought');
      return `YOURS FOREVER: ${f.name}`;
    },
    porridgeKey(e) {
      const c = e.code, n = FLAIR_IDS.length;
      if (c === 'KeyW' || c === 'ArrowUp') this.porridgeSel = ((this.porridgeSel || 0) + n - 1) % n;
      else if (c === 'KeyS' || c === 'ArrowDown') this.porridgeSel = ((this.porridgeSel || 0) + 1) % n;
      else if (c === 'Space' || c === 'Enter') this.porridgeBuySel(this.porridgeSel || 0);
      else if (c === 'Escape') this.closePorridgeShop('leave');
      else return false;
      return true;
    },
    porridgeBuySel(i) {
      this.porridgeSel = i;
      const msg = this.buyFlair(FLAIR_IDS[i]);
      this.porridgeMsg = msg;
      this.sound.play(/^YOURS|^WEARING|^FLAIR/.test(msg) ? 'coin' : 'deny');
    },
    drawPorridgeShop(ui) {
      const left = this.porridgeShopLeft();
      if (left <= 0) { this.closePorridgeShop('time'); return; }
      if (this.locked) { ui.screen = null; return; } // back in the game: the clock keeps ticking (the pause menu can reopen it)
      const ctx = ui.ctx, W = ui.W, H = ui.H, owned = this.meta.flair || [];
      ctx.fillStyle = 'rgba(30,4,28,0.9)'; ctx.fillRect(0, 0, W, H);
      const blink = Math.floor(Date.now() / 250) % 2;
      ui.splitText('PIXEL PORRIDGE EXCLUSIVE SHOP', W / 2, 5, C.pink, W >= 380 ? 2 : 1, 'center');
      drawText(ctx, `CLOSES IN ${left.toFixed(1)}S`, W / 2, 24, left < 10 && blink ? C.red : C.hot, 1, 'center');
      ctx.fillStyle = '#301028'; ctx.fillRect(16, 34, W - 32, 3); ctx.fillStyle = left < 10 ? C.red : C.pink; ctx.fillRect(16, 34, Math.round((W - 32) * left / PORRIDGE_SHOP_SEC), 3);
      drawSmall(ctx, `YOUR HONEY: ${Math.floor(this.honey || 0)}   TOKENS LEFT: ${this.meta.porridge || 0}   ${(3 + Math.floor(Date.now() / 3000) % 7)} BEES ARE LOOKING AT THIS RIGHT NOW`, W / 2, 41, C.dim, 'center');
      const rowH = 18, top = 50, rows = Math.max(3, Math.floor((H - top - 34) / rowH));
      const sel = this.porridgeSel || 0;
      const start = Math.max(0, Math.min(FLAIR_IDS.length - rows, sel - Math.floor(rows / 2)));
      const pw = Math.min(W - 16, 360), px = Math.round(W / 2 - pw / 2);
      FLAIR_IDS.slice(start, start + rows).forEach((id, k) => {
        const i = start + k, f = FLAIR[id], y = top + k * rowH, mine = owned.includes(id), on = this.flairOn === id;
        const hot = i === sel || (ui.mx >= px && ui.mx <= px + pw && ui.my >= y && ui.my <= y + rowH - 2);
        ui.panel(px, y, pw, rowH - 1);
        if (hot) { ctx.fillStyle = 'rgba(255,106,216,0.18)'; ctx.fillRect(px + 1, y + 1, pw - 2, rowH - 3); }
        drawText(ctx, f.name, px + 4, y + 2, hot ? C.hot : C.pink);
        drawSmall(ctx, f.desc.slice(0, Math.floor((pw - 60) / 4)), px + 4, y + 10, C.dim);
        drawText(ctx, mine ? (on ? 'ON' : 'OWNED') : `${f.cost}`, px + pw - 4, y + 5, mine ? C.green : (this.honey || 0) >= f.cost ? C.hot : C.red, 1, 'right');
        ui.buttons.push({ x: px, y, w: pw, h: rowH - 1, action: () => this.porridgeBuySel(i) });
      });
      if (this.porridgeMsg) drawSmall(ctx, this.porridgeMsg, W / 2, H - 30, C.green, 'center');
      drawSmall(ctx, 'A JOKE ABOUT LIMITED-TIME STOREFRONTS. HONEY ONLY. NO REAL MONEY EXISTS IN CRYPTSLOP.', W / 2, H - 8, C.dim, 'center');
      ui.button('LEAVE (FOREVER)', W - 98, H - 20, 90, 11, () => this.closePorridgeShop('leave'), { color: C.dim });
      ui.button('RESUME', 8, H - 20, 60, 11, () => { this.closePorridgeShop('resume'); this.lock(); }); // the clock keeps running: the pause menu reopens it
    },

    // ---------------- wearing it ----------------
    // everyone's flair rides a free-standing group that follows their bee (or their JOHN FISTER)
    updateFlair(dt) {
      if (this.ui.screen === 'porridge' && !this.porridgeShopActive()) this.closePorridgeShop('time');
      if (!this.flairObjs) this.flairObjs = new Map();
      const want = new Map();
      if (this.mode === 'play' && this.world) {
        for (const [id, o] of this.others) if (o.fl && FLAIR[o.fl] && o.model) want.set(id, { fl: o.fl, src: o.model, show: !o.dead && this.spectating !== id, speed: o.speed || 0 });
        const self = this.selfModel && this.selfModel.visible ? this.selfModel : this.cls === 'fister' && this.fModel && this.fModel.visible ? this.fModel : null;
        const mine = this.flairOn;
        if (mine) want.set('__me', { fl: mine, src: self, show: !!self && !this.dead, speed: this.mover ? this.mover.horizontalSpeed() : 0 });
      }
      for (const [k, f] of this.flairObjs) if (!want.has(k) || want.get(k).fl !== f.fl) { if (f.grp) this.entityRoot.remove(f.grp); this.flairObjs.delete(k); }
      const t = this.time || 0;
      for (const [k, w] of want) {
        let f = this.flairObjs.get(k);
        if (!f) { const grp = makeFlair(w.fl); if (grp) this.entityRoot.add(grp); f = { fl: w.fl, grp, spark: 0 }; this.flairObjs.set(k, f); }
        const src = w.src;
        const vis = w.show && !!src;
        if (f.grp) {
          f.grp.visible = vis;
          if (vis) { f.grp.position.copy(src.position); f.grp.rotation.y = src.rotation.y; f.grp.userData.tick(t); }
        }
        if (!vis || !this.particles) continue;
        f.spark += dt;
        const p = src.position;
        if (w.fl === 'trail' && w.speed > 1 && f.spark > 0.03) {
          f.spark = 0;
          const hue = (t * 0.7) % 1, c = new THREE.Color().setHSL(hue, 1, 0.6);
          this.particles.emit(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.4, 0, 0.6, 0, c.r, c.g, c.b, 0.07, 0.6, 0);
        }
        if (w.fl === 'cloud' && f.spark > 0.06) {
          f.spark = 0;
          this.particles.emit(p.x + (Math.random() - 0.5) * 0.5, p.y + 2.6, p.z + (Math.random() - 0.5) * 0.5, 0, -4, 0, 0.5, 0.7, 1, 0.04, 0.5, 1);
        }
      }
    },
  }));
}
