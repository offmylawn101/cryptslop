// MOBILE: on-screen touch controls. A floating stick on the left half moves you, dragging on the right
// half looks around (and so does dragging the FIRE button, so you can aim while you shoot).
// Buttons change with what's on screen: the class kit in a fight, a d-pad in the casino and the
// microgames, offer cards for boons, arrows when spectating. Menus are plain taps on the canvas.
import { CLASSES, UPGRADES } from './data.js';

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  return coarse && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
}

// the class kit buttons: [action, label]
const KIT_BUTTONS = {
  hornet: [['knife', 'KNIFE'], ['reload', 'RELOAD']],
  batter: [['kick', 'KICK']],
  grenader: [['molotov', 'FIRE\nBOMB']],
  cleaver: [],
  spinner: [],
  pestilent: [],
  fister: [['grab', 'GRAB']],
};
const HOLD_KEYS = { jump: 'Space', crouch: 'ShiftLeft', dash: 'KeyQ' };
const DPAD = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const CSS = `
#touch { position: fixed; inset: 0; z-index: 5; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; display: none; font-family: 'Courier New', monospace; font-weight: 700; }
#touch .b { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; white-space: pre; border-radius: 50%;
  background: rgba(32, 16, 8, 0.45); border: 2px solid rgba(255, 208, 64, 0.75); color: #ffd040; font-size: 2.6vmin; line-height: 1.05; box-sizing: border-box; }
#touch .b.on { background: rgba(255, 208, 64, 0.55); color: #201008; }
#touch .b.sq { border-radius: 14%; }
#touch .b.hide { display: none; }
#touch .stick { position: absolute; width: 22vmin; height: 22vmin; margin: -11vmin 0 0 -11vmin; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); display: none; pointer-events: none; }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 9vmin; height: 9vmin; margin: -4.5vmin 0 0 -4.5vmin; border-radius: 50%; background: rgba(255, 208, 64, 0.6); }
#touch .offer { position: absolute; border-radius: 8px; width: 26vw; height: 15vmin; top: 22vh; font-size: 2.4vmin; white-space: normal; padding: 1vmin; }
#touch .tip { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); color: #ffd040; font-size: 4vmin; text-align: center; pointer-events: none; display: none; text-shadow: 2px 2px 0 #000; }
`;

export class TouchControls {
  constructor(game) {
    this.g = game;
    this.touches = new Map(); // identifier -> { role, x, y, action }
    this.move = { x: 0, y: 0 };
    this.mode = null;
    this.kitFor = null;
    this.built = false;
  }

  // AUTO uses the device; the setting can force it on or off
  get enabled() {
    const s = this.g.settings.touch || 'auto';
    return s === 'on' || (s === 'auto' && isTouchDevice());
  }

  build() {
    if (this.built || typeof document === 'undefined') return;
    this.built = true;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'touch'; document.body.appendChild(root);
    this.root = root;
    this.stickEl = document.createElement('div'); this.stickEl.className = 'stick';
    this.knob = document.createElement('div'); this.knob.className = 'knob'; this.stickEl.appendChild(this.knob);
    root.appendChild(this.stickEl);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.tip.textContent = 'TURN YOUR PHONE SIDEWAYS'; root.appendChild(this.tip);
    this.btn = {};
    // [action, label, right, bottom, size(vmin), group, square]
    const B = [
      ['fire', 'FIRE', 3, 6, 21, 'play'], ['jump', 'JUMP', 26, 4, 15, 'play'], ['parry', 'PARRY', 6, 31, 13, 'play'],
      ['crouch', 'SLIDE', 43, 4, 12, 'play'], ['dash', 'DASH', 24, 23, 12, 'play'],
      ['kit0', '', 21, 40, 11, 'play'], ['kit1', '', 34, 36, 11, 'play'], ['kit2', '', 41, 20, 11, 'play'],
      ['use', 'USE', 50, 18, 10, 'play'], ['active', 'RELIC', 56, 4, 10, 'play'],
      ['pause', 'II', 2, 'top:2', 9, 'any', true], ['bag', 'BAG', 13, 'top:2', 9, 'play', true], ['ping', 'PING', 24, 'top:2', 9, 'play', true],
      ['w', 'W', 35, 'top:2', 9, 'play', true], ['build', 'BUILD', 46, 'top:2', 9, 'play', true], ['flip', 'FLIP', 57, 'top:2', 9, 'play', true], ['swap', 'SWAP', 68, 'top:2', 9, 'play', true], ['med', 'MED', 79, 'top:2', 9, 'play', true], ['saber', 'SABR', 90, 'top:2', 9, 'play', true], ['wish', 'WISH', 101, 'top:2', 9, 'play', true],
      ['qte', 'TAP!', 'center', 'center', 22, 'qte'],
      ['up', '▲', 16, 30, 12, 'pad', true], ['down', '▼', 16, 4, 12, 'pad', true], ['left', '◀', 29, 17, 12, 'pad', true], ['right', '▶', 3, 17, 12, 'pad', true],
      ['ok', 'OK', 'left:4', 18, 15, 'pad'], ['back', 'BACK', 'left:22', 6, 11, 'pad'], ['tab', 'TAB', 'left:22', 26, 10, 'casino', true],
      ['specL', '◀', 'left:4', 40, 13, 'dead', true], ['specR', '▶', 4, 40, 13, 'dead', true],
    ];
    for (const [a, label, right, bottom, size, group, sq] of B) {
      const el = document.createElement('div');
      el.className = `b${sq ? ' sq' : ''}`; el.dataset.a = a; el.dataset.group = group; el.textContent = label;
      el.style.width = el.style.height = `${size}vmin`;
      if (right === 'center') { el.style.left = `calc(50% - ${size / 2}vmin)`; el.style.top = `calc(55% - ${size / 2}vmin)`; }
      else {
        if (String(right).startsWith('left:')) el.style.left = `${right.slice(5)}vmin`; else el.style.right = `${right}vmin`;
        if (String(bottom).startsWith('top:')) el.style.top = `${bottom.slice(4)}vmin`; else el.style.bottom = `${bottom}vmin`;
      }
      if (a === 'fire') el.style.fontSize = '4vmin';
      root.appendChild(el); this.btn[a] = el;
    }
    this.offers = [0, 1, 2].map((i) => {
      const el = document.createElement('div'); el.className = 'b sq offer'; el.dataset.a = `pick${i}`; el.dataset.group = 'offer';
      el.style.left = `${4 + i * 32}vw`; root.appendChild(el); return el;
    });
    const opt = { passive: false };
    root.addEventListener('touchstart', (e) => this.onStart(e), opt);
    root.addEventListener('touchmove', (e) => this.onMove(e), opt);
    root.addEventListener('touchend', (e) => this.onEnd(e), opt);
    root.addEventListener('touchcancel', (e) => this.onEnd(e), opt);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // what the overlay shows right now
  currentMode() {
    const g = this.g;
    if (!this.enabled || g.mode !== 'play' || !g.locked || g.console.open) return 'off';
    if (g.micro.open) return 'micro';
    if (g.casino.open) return 'casino';
    if (g.dead) return 'dead';
    return 'play';
  }

  update() {
    if (!this.enabled && !this.built) return;
    this.build();
    if (!this.root) return;
    const mode = this.currentMode();
    if (mode !== this.mode) {
      this.mode = mode;
      this.releaseAll();
      this.root.style.display = mode === 'off' ? 'none' : 'block';
      for (const el of Object.values(this.btn)) {
        const gr = el.dataset.group;
        const show = gr === 'any' || gr === mode || (gr === 'pad' && (mode === 'casino' || mode === 'micro')) || (gr === 'casino' && mode === 'casino');
        el.classList.toggle('hide', !show);
      }
      this.kitFor = null;
    }
    if (mode === 'off') return;
    const g = this.g;
    // the kit buttons follow the class
    if (mode === 'play' && this.kitFor !== g.cls) {
      this.kitFor = g.cls;
      const kit = KIT_BUTTONS[g.cls] || [];
      for (let i = 0; i < 3; i++) {
        const el = this.btn[`kit${i}`];
        if (kit[i]) { el.textContent = kit[i][1]; el.dataset.act = kit[i][0]; el.classList.remove('hide'); } else el.classList.add('hide');
      }
      this.btn.fire.textContent = { hornet: 'FIRE', batter: 'SWING', grenader: 'BOMB', cleaver: 'SLASH', spinner: 'SPIN', pestilent: 'COUGH', fister: 'PUNCH', sieger: 'LOB', koolciller: 'POKE', interceptor: 'LASER', blasphemous: 'RING', parkour: 'RUN' }[g.cls] || 'FIRE';
      this.btn.fire.style.borderColor = CLASSES[g.cls].color;
    }
    // QTE prompt, boon cards, the portrait hint
    const qte = g.qte && g.qte.active;
    this.btn.qte.classList.toggle('hide', !(qte && mode === 'play'));
    if (qte) this.btn.qte.textContent = `TAP!\n${qte.label}`;
    const offer = mode === 'play' && g.offers && g.offers.length ? g.offers[0] : null;
    this.offers.forEach((el, i) => {
      const u = offer && offer[i];
      el.style.display = u ? 'flex' : 'none';
      if (u && el.dataset.u !== u) { el.dataset.u = u; el.textContent = `${i + 1}. ${UPGRADES[u].name}\n${UPGRADES[u].desc}`; el.style.whiteSpace = 'pre-wrap'; }
    });
    this.tip.style.display = window.innerHeight > window.innerWidth * 1.1 ? 'block' : 'none';
  }

  // the left stick as analog move input (null when no thumb is on it)
  moveVec() {
    for (const t of this.touches.values()) if (t.role === 'stick') return { f: -this.move.y, s: this.move.x };
    return null;
  }

  onStart(e) {
    e.preventDefault();
    const g = this.g;
    g.sound.unlock();
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const b = el && el.closest ? el.closest('[data-a]') : null;
      if (b && !b.classList.contains('hide') && b.style.display !== 'none') {
        const a = b.dataset.act || b.dataset.a;
        this.touches.set(t.identifier, { role: 'button', action: a, el: b, x: t.clientX, y: t.clientY });
        b.classList.add('on');
        this.press(a, true);
        continue;
      }
      if (this.mode === 'micro') { g.micro.click(); this.touches.set(t.identifier, { role: 'look', x: t.clientX, y: t.clientY }); continue; }
      if (this.mode === 'dead') { g.specCycle(1); continue; }
      if (t.clientX < window.innerWidth * 0.45 && this.mode === 'play') {
        this.touches.set(t.identifier, { role: 'stick', ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY });
        this.stickEl.style.display = 'block'; this.stickEl.style.left = `${t.clientX}px`; this.stickEl.style.top = `${t.clientY}px`;
        this.knob.style.transform = 'translate(0px, 0px)';
        this.move.x = this.move.y = 0;
      } else this.touches.set(t.identifier, { role: 'look', x: t.clientX, y: t.clientY });
    }
  }

  onMove(e) {
    e.preventDefault();
    const g = this.g;
    for (const t of e.changedTouches) {
      const s = this.touches.get(t.identifier);
      if (!s) continue;
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      s.x = t.clientX; s.y = t.clientY;
      if (s.role === 'stick') {
        const r = Math.min(window.innerWidth, window.innerHeight) * 0.11;
        let ox = t.clientX - s.ox, oy = t.clientY - s.oy;
        const l = Math.hypot(ox, oy);
        if (l > r) { ox *= r / l; oy *= r / l; }
        this.knob.style.transform = `translate(${ox}px, ${oy}px)`;
        // a small dead zone, then full speed quickly (bhop needs crisp strafes)
        const nx = ox / r, ny = oy / r, nl = Math.hypot(nx, ny);
        const k = nl < 0.15 ? 0 : Math.min(1, (nl - 0.15) / 0.6) / (nl || 1);
        this.move.x = nx * k; this.move.y = ny * k;
      } else if (s.role === 'look' || (s.role === 'button' && (s.action === 'fire' || s.action === 'slash'))) {
        if (this.mode === 'micro') { g.micro.mouse(dx * 2, dy * 2); continue; }
        if (this.mode !== 'play') continue;
        g.lookBy(dx * 2.2 * (g.settings.touchSens || 1), dy * 2.2 * (g.settings.touchSens || 1));
      }
    }
  }

  onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = this.touches.get(t.identifier);
      this.touches.delete(t.identifier);
      if (!s) continue;
      if (s.role === 'stick') { this.move.x = this.move.y = 0; this.stickEl.style.display = 'none'; }
      if (s.role === 'button') { s.el.classList.remove('on'); this.press(s.action, false); }
    }
  }

  releaseAll() {
    for (const s of this.touches.values()) if (s.role === 'button') { s.el.classList.remove('on'); this.press(s.action, false); }
    this.touches.clear();
    this.move.x = this.move.y = 0;
    if (this.stickEl) this.stickEl.style.display = 'none';
  }

  // a button went down (on = true) or up
  press(a, on) {
    const g = this.g;
    if (HOLD_KEYS[a]) { if (on) g.keys.add(HOLD_KEYS[a]); else g.keys.delete(HOLD_KEYS[a]); return; }
    if (DPAD[a] || a === 'ok' || a === 'back' || a === 'tab') {
      const code = DPAD[a] || { ok: 'Enter', back: 'Escape', tab: 'Tab' }[a];
      if (this.mode === 'micro') { const c = a === 'ok' ? 'Space' : code; if (on) g.micro.key({ code: c, key: '' }); else g.micro.keyUp({ code: c }); }
      else if (on && this.mode === 'casino') g.casino.key({ code, key: '', repeat: false });
      return;
    }
    if (a === 'fire') { g.mouseDown = on; return; }
    if (!on) return;
    switch (a) {
      case 'parry': g.parry(); break;
      case 'knife': g.throwKnife(); break;
      case 'spin': g.throwBall(); break;
      case 'kick': g.dropkick(); break;
      case 'molotov': g.throwMolotov(); break;
      case 'reload': g.loadShell(); break;
      case 'build': g.toggleBuild(); break;
      case 'flip': g.backflip(); break;
      case 'swap': g.cycleWeapon(1); break;
      case 'grab': if (g.fisterGrab) g.fisterGrab(); break;
      case 'use': g.interact(); break;
      case 'active': g.useActive(); break;
      case 'med': g.useMedkit(); break;
      case 'saber': g.toggleSaber(); break;
      case 'ping': g.doPing(); break;
      case 'bag': g.casino.openInventory(0); break;
      case 'w': g.quickChat('W'); break;
      case 'wish': g.openWishes(); break;
      case 'pause': g.touchPause(); break;
      case 'qte': if (g.qte.active) g.qte.key(g.qte.active.code); break;
      case 'specL': g.specCycle(-1); break;
      case 'specR': g.specCycle(1); break;
      default:
        if (a.startsWith('pick')) g.pickUpgrade(Number(a.slice(4)));
    }
  }
}
