// CONTROLLERS (standard mapping: Xbox, PlayStation, Switch Pro, and Android handhelds like the
// Retroid / AYN / Anbernic family). Left stick moves, right stick looks. In menus a cursor follows
// the left stick (or the d-pad) and A clicks.
//
//  A jump        B slide/crouch   X reload (or use)   Y backflip
//  LB dash       RB parry         LT class move (slash / spin ball / knife / kick / molotov)
//  RT fire       D-pad up/down: switch weapon   D-pad left: relic   D-pad right: use / interact
//  L3 ping       R3 build mode    SELECT inventory   START pause
const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * (Math.abs(v) - DEAD) / (1 - DEAD));

export class GamepadInput {
  constructor(game) {
    this.g = game;
    this.prev = [];
    this.active = false; // a controller is the input right now (the menu cursor shows, lock() skips pointer lock)
    this.cursorT = 0;
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', (e) => { this.g.ui.toast(`CONTROLLER: ${String(e.gamepad.id).slice(0, 30).toUpperCase()}`); });
      // any mouse or keyboard use hands control back to them
      window.addEventListener('mousemove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.active = false; });
      window.addEventListener('keydown', () => { this.active = false; });
    }
  }

  pad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    for (const p of navigator.getGamepads()) if (p && p.connected && p.buttons.length >= 12) return p;
    return null;
  }

  poll(dt) {
    const g = this.g, p = this.pad();
    if (!p) { if (g.padMove) g.padMove = null; return; }
    const b = p.buttons.map((x) => (typeof x === 'object' ? x.value > 0.5 || x.pressed : x > 0.5));
    const down = (i) => b[i] && !this.prev[i];
    const up = (i) => !b[i] && this.prev[i];
    const ax = (i) => dz(p.axes[i] || 0);
    const any = b.some(Boolean) || p.axes.some((v) => Math.abs(v) > 0.4);
    if (any) this.active = true;
    if (!this.active) { this.prev = b; return; }
    const playing = g.mode === 'play' && g.locked && !g.casino.open && !g.micro.open && !g.console.open && !(g.ui.screen === 'class');
    if (playing) {
      g.padMove = { f: -ax(1), s: ax(0) };
      const sens = (g.settings.padSens || 1) * 900 * dt;
      g.lookBy(ax(2) * Math.abs(ax(2)) * sens, ax(3) * Math.abs(ax(3)) * sens);
      const hold = (i, code) => { if (b[i]) g.keys.add(code); else if (this.prev[i]) g.keys.delete(code); };
      hold(0, 'Space'); hold(1, 'ShiftLeft'); hold(4, 'KeyQ');
      g.mouseDown = !!b[7];
      const picking = g.offers.length && b[4] && b[5];
      if (g.cls === 'fister') { g.fParry = !!b[5] && !b[4]; g.fGrab = !!b[6]; } else if (down(5) && !b[4]) g.parry();
      if (picking) { if (down(2)) g.pickUpgrade(0); if (down(3)) g.pickUpgrade(1); if (down(1)) g.pickUpgrade(2); this.prev = b; return; } // hold both bumpers: X / Y / B pick boon 1 / 2 / 3
      if (down(2)) { if (g.cls === 'hornet' && !g.nearProp()) g.loadShell(); else g.interact(); }
      if (down(3)) g.backflip();
      if (down(6) && g.cls !== 'fister') { const c = g.cls; if (c === 'cleaver') g.startSlash('pad'); else if (c === 'spinner' || c === 'hornet') { if (c === 'hornet') g.throwKnife(); else g.throwBall(); } else if (c === 'batter') g.dropkick(); else if (c === 'grenader') g.throwMolotov(); }
      if (up(6) && g.cls === 'cleaver') g.releaseSlash();
      if (down(12) && b[4]) { g.useMedkit(); this.prev = b; return; } // LB + d-pad up: MEDKIT
      if (down(13) && b[4]) { g.toggleSaber(); this.prev = b; return; } // LB + d-pad down: LIGHT SABER
      if (down(12)) g.cycleWeapon(-1);
      if (down(13)) g.cycleWeapon(1);
      if (down(14)) g.useActive();
      if (down(15)) g.interact();
      if (down(10)) g.doPing();
      if (down(11)) g.toggleBuild();
      if (down(8)) g.casino.openInventory(0);
      if (down(9)) g.touchPause();
      this.prev = b; return;
    }
    g.padMove = null; g.mouseDown = false;
    if (g.mode === 'play' && g.micro.open) { // microgames: d-pad and A
      const map = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Space' };
      for (const [i, code] of Object.entries(map)) { if (down(+i)) g.micro.key({ code, key: '', repeat: false }); if (up(+i)) g.micro.keyUp({ code }); }
      this.prev = b; return;
    }
    if (g.mode === 'play' && g.casino.open && g.locked) { // machines: d-pad, A plays, B leaves
      const map = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Space', 1: 'Escape', 2: 'Enter' };
      for (const [i, code] of Object.entries(map)) if (down(+i)) g.casino.key({ code, key: '', repeat: false });
      this.prev = b; return;
    }
    // menus: a cursor
    const ui = g.ui;
    if (ui.mx < 0) { ui.mx = ui.W / 2; ui.my = ui.H / 2; }
    const sp = 260 * dt * (ui.H / 240);
    ui.mx = Math.max(0, Math.min(ui.W - 1, ui.mx + (ax(0) + ax(2)) * sp));
    ui.my = Math.max(0, Math.min(ui.H - 1, ui.my + (ax(1) + ax(3)) * sp));
    // the d-pad hops between buttons
    if (down(12) || down(13) || down(14) || down(15)) this.hop(down(12) ? 0 : down(13) ? 1 : down(14) ? 2 : 3);
    if (down(0)) this.click();
    if (down(1)) ui.key({ code: 'Escape' });
    if (down(9)) { if (g.mode === 'play' && !g.locked && !ui.screen) g.lock(); }
    this.prev = b;
  }

  click() {
    const ui = this.g.ui;
    for (const bt of ui.buttons) {
      if (ui.mx >= bt.x && ui.mx <= bt.x + bt.w && ui.my >= bt.y && ui.my <= bt.y + bt.h) { this.g.sound.unlock(); this.g.sound.play('ui'); bt.action(); return; }
    }
  }

  // jump the cursor to the nearest button in a direction (0 up, 1 down, 2 left, 3 right)
  hop(dir) {
    const ui = this.g.ui;
    let best = null, bd = Infinity;
    for (const bt of ui.buttons) {
      const cx = bt.x + bt.w / 2, cy = bt.y + bt.h / 2, dx = cx - ui.mx, dy = cy - ui.my;
      const ok = dir === 0 ? dy < -2 : dir === 1 ? dy > 2 : dir === 2 ? dx < -2 : dx > 2;
      if (!ok) continue;
      const d = dir < 2 ? Math.abs(dy) + Math.abs(dx) * 0.3 : Math.abs(dx) + Math.abs(dy) * 0.3;
      if (d < bd) { bd = d; best = bt; }
    }
    if (best) { ui.mx = best.x + best.w / 2; ui.my = best.y + best.h / 2; }
  }
}
