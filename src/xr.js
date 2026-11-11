// VR (WebXR). Enter from the title or pause menu on a headset browser (Quest, Pico, PCVR in Chrome).
// You stand in the bee: head to look, left stick to move (where you look), right stick to snap turn.
// Right trigger fires, right grip parries, A jumps, B dashes, left trigger slides, left grip is the
// class move, X reloads (or uses), Y backflips. The HUD floats in front of you. The low-res render
// target and the vertex wobble are switched off in the headset (they would make you sick).
import * as THREE from 'three';
import { sharedUniforms, retroMaterial } from './retro.js';
import { makeAsset } from './assets.js';

// a blocky glove: palm, four fingers, a thumb (built facing -Z, the way a controller points)
export function makeVRHand(color = [1, 0.85, 0.3], left = false) {
  const g = new THREE.Group();
  const mat = retroMaterial({ color, emissive: color.map((v) => v * 0.35) });
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  box(0.085, 0.03, 0.1, 0, 0, 0.01); // palm
  for (let f = 0; f < 4; f++) box(0.017, 0.022, 0.065, -0.03 + f * 0.02, 0.002, -0.07); // fingers
  box(0.02, 0.02, 0.05, left ? 0.05 : -0.05, 0, -0.01); // thumb
  box(0.07, 0.04, 0.05, 0, 0, 0.08); // cuff
  g.userData.mat = mat;
  return g;
}

export class XRSupport {
  constructor(game) {
    this.g = game;
    this.supported = false;
    this.session = null;
    this.rig = new THREE.Group();
    this.turn = 0; this.turnArmed = true;
    this.prev = { left: [], right: [] };
    this.aimDir = null;
    this.log = []; // VR diagnostics (window.__crypthop.xr.log), so a failure on someone's headset can be read back
    if (typeof navigator !== 'undefined' && navigator.xr && navigator.xr.isSessionSupported) {
      // On a PC the first answer can come back false while the OpenXR runtime (Oculus, SteamVR) is still
      // waking up, and the ENTER VR button then never showed. Ask again when the devices change, and
      // every few seconds until the answer is yes.
      const ask = () => navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
        if (!!ok !== this.supported) this.note(`immersive-vr supported: ${!!ok}`);
        this.supported = !!ok;
      }).catch((e) => this.note(`isSessionSupported failed: ${e && e.message}`));
      ask();
      try { navigator.xr.addEventListener('devicechange', ask); } catch (e) { /* ignore */ }
      this.askTimer = setInterval(() => { if (!this.supported) ask(); else clearInterval(this.askTimer); }, 3000);
    }
  }

  note(msg) {
    const line = `${new Date().toISOString().slice(11, 19)} ${(performance.now() / 1000).toFixed(2)}s ${msg}`;
    this.log.push(line); if (this.log.length > 80) this.log.shift();
    console.info('[cryptslop] VR', line);
    // kept in the browser too, so it survives a frozen page: read it back with __crypthop.xr.savedLog()
    try { localStorage.setItem('cryptslop.vrlog', JSON.stringify(this.log)); } catch (e) { /* ignore */ }
  }
  savedLog() { try { return JSON.parse(localStorage.getItem('cryptslop.vrlog') || '[]').join(String.fromCharCode(10)); } catch (e) { return ''; } }

  // every 2 seconds in VR: frames per second, and how long the game's own work takes per frame
  profile(ms, now) {
    const p = this.prof || (this.prof = { n: 0, sum: 0, max: 0, gapMax: 0, last: now, t0: now });
    if (p.last) p.gapMax = Math.max(p.gapMax, now - p.last);
    p.last = now; p.n++; p.sum += ms; p.max = Math.max(p.max, ms);
    if (now - p.t0 >= 2000) {
      this.note(`fps ${(p.n / ((now - p.t0) / 1000)).toFixed(0)}, work avg ${(p.sum / p.n).toFixed(1)}ms max ${p.max.toFixed(0)}ms, longest gap ${p.gapMax.toFixed(0)}ms, vis ${this.session && this.session.visibilityState}`);
      this.prof = { n: 0, sum: 0, max: 0, gapMax: 0, last: now, t0: now };
    }
  }

  async enter() {
    const g = this.g, r = g.rr.renderer;
    if (!this.supported || this.session || this.entering) return;
    this.entering = true; // a second click while the headset spins up must not start a second session
    let s = null;
    try {
      this.note('requestSession...');
      s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      this.note(`session granted (blend ${s.environmentBlendMode}, ${typeof s.renderState.layers === 'undefined' ? 'baseLayer' : 'layers'})`);
      // PC runtimes do not all grant a floor-level space; fall back to 'local' (head height at the start)
      let space = 'local-floor';
      try { await s.requestReferenceSpace('local-floor'); } catch (e) { space = 'local'; }
      this.note(`reference space ${space}`);
      this.eyeLift = space === 'local' ? 1.6 : 0; // 'local' puts the origin at your head: lift the rig to bee height
      const standalone = typeof navigator !== 'undefined' && /Android|OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent || '');
      r.xr.enabled = true;
      r.xr.setReferenceSpaceType(space);
      r.xr.setFramebufferScaleFactor(standalone ? 0.6 : 0.8); // chunky pixels; a standalone headset needs the savings most
      r.xr.setFoveation(standalone ? 1 : 0);
      await r.xr.setSession(s);
      this.note('three.js attached the session');
      this.session = s;
      this.frames = 0; this.prof = null;
      s.addEventListener('visibilitychange', () => this.note(`headset visibility: ${s.visibilityState}`));
      this.entering = false;
      g.scene.add(this.rig);
      this.rig.add(g.camera);
      this.controllers = [0, 1].map((i) => { const c = r.xr.getController(i); this.rig.add(c); return c; });
      for (const c of this.controllers) { // a pointer line on each hand (menus only)
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.5)]), new THREE.LineBasicMaterial({ color: 0xffd040 }));
        c.add(line); c.userData.line = line;
      }
      // HANDS: gloves on both controllers, and the class weapon in the right one (a gun you really aim)
      this.hands = [0, 1].map((i) => {
        const hand = makeVRHand(undefined, i === 0);
        this.controllers[i].add(hand);
        return hand;
      });
      this.weapons = {};
      const gun = makeAsset('hornetgun', { center: true });
      if (gun) { gun.position.set(0, -0.03, -0.32); gun.scale.setScalar(0.85); for (const mm of gun.userData.mats) mm.uniforms.uEmissive.value.set(0.45, 0.45, 0.45); }
      else { const gg = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.7), retroMaterial({ color: [0.4, 0.35, 0.2], emissive: [0.2, 0.17, 0.1] })); b.position.z = -0.32; gg.add(b); this.weapons.hornet = gg; }
      if (gun) this.weapons.hornet = gun;
      const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.8, 6), retroMaterial({ color: [0.75, 0.55, 0.3], emissive: [0.3, 0.2, 0.1] }));
      bat.rotation.x = -Math.PI / 2; bat.position.z = -0.42; this.weapons.batter = bat;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 1.0), retroMaterial({ color: [1, 0.82, 0.3], emissive: [0.5, 0.4, 0.1] }));
      blade.position.z = -0.55; this.weapons.cleaver = blade;
      if (g.vrWeapons2) Object.assign(this.weapons, g.vrWeapons2()); // the five newer classes (classes2.js)
      for (const w of Object.values(this.weapons)) { w.visible = false; this.controllers[1].add(w); }
      // the muzzle: where shots come from (a little in front of the right hand)
      this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0, -0.7); this.controllers[1].add(this.muzzle);
      this.hudMat = new THREE.MeshBasicMaterial({ map: g.rr.uiTex, transparent: true, depthTest: false, depthWrite: false });
      this.hud = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), this.hudMat);
      this.hud.renderOrder = 1000; this.hud.position.set(0, 0, -1.4);
      g.camera.add(this.hud);
      this.snapSaved = sharedUniforms.uSnap.value.clone();
      sharedUniforms.uSnap.value.set(100000, 100000); // no PS1 wobble in a headset
      g.locked = true;
      if (g.mode === 'menu') g.ui.toast('VR: PICK A MODE WITH THE MOUSE, OR START A SOLO RUN');
      s.addEventListener('end', () => this.exit());
      g.ui.toast('VR ON');
      this.note('VR ready');
    } catch (e) {
      this.entering = false;
      console.warn('[cryptslop] VR failed', e);
      this.note(`FAILED: ${(e && e.message) || e}`);
      g.ui.toast(`VR FAILED: ${String((e && e.message) || e).slice(0, 40)}`);
      // never leave a half-started session running: the headset would sit on a black frame and the page hang
      if (s && !this.session) { try { r.xr.enabled = false; const p = s.end(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } }
      else if (this.session) { const live = this.session; this.exit(); try { const p = live.end(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } }
    }
  }

  exit() {
    const g = this.g, r = g.rr.renderer;
    if (!this.session) return;
    this.session = null;
    this.note(`session ended after ${this.frames || 0} frames`);
    r.xr.enabled = false;
    if (this.hud) g.camera.remove(this.hud);
    this.muzzlePos = null;
    for (const c of this.controllers || []) for (const ch of [...c.children]) c.remove(ch); // hands, weapons, pointers: rebuilt next time
    this.controllers = null; this.hands = null; this.weapons = null; this.muzzle = null;
    this.rig.remove(g.camera);
    g.scene.remove(this.rig);
    g.camera.position.set(0, 0, 0); g.camera.quaternion.identity(); g.camera.rotation.order = 'YXZ';
    g.rr.resize(); // also applies any window resize that happened while in the headset
    g.locked = false; g.padMove = null; g.mouseDown = false;
    this.aimDir = null;
  }

  // head and hands relative to the feet, for everyone else to see: [hx,hy,hz, then per hand x,y,z,qx,qy,qz,qw]
  packet() {
    if (!this.session || !this.controllers) return null;
    const g = this.g, m = g.mover, q = (v) => Math.round(v * 100) / 100;
    const cam = g.rr.renderer.xr.getCamera();
    const hp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const out = [q(hp.x - m.pos.x), q(hp.y - m.pos.y), q(hp.z - m.pos.z)];
    for (const c of this.controllers) {
      const p = new THREE.Vector3(), r = new THREE.Quaternion();
      c.matrixWorld.decompose(p, r, new THREE.Vector3());
      out.push(q(p.x - m.pos.x), q(p.y - m.pos.y), q(p.z - m.pos.z), q(r.x), q(r.y), q(r.z), q(r.w));
    }
    return out;
  }

  // the right hand's pointing direction (aim), or null to aim with the head
  aim() {
    if (!this.session || !this.controllers) return null;
    const c = this.controllers[1];
    const q = c.getWorldQuaternion(new THREE.Quaternion());
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize();
  }

  update() {
    const g = this.g;
    if (!this.session) return;
    this.frames = (this.frames || 0) + 1;
    if (this.frames === 1 || this.frames === 90) this.note(`headset frame ${this.frames}`);
    if (this.hudMat && this.hudMat.map !== g.rr.uiTex) { this.hudMat.map = g.rr.uiTex; this.hudMat.needsUpdate = true; }
    // the rig stands where the bee stands. Not playing yet (the title screen): stand in the middle of
    // the demo hive's first room instead of at the world origin, which is inside the rock (all black).
    const m = g.mover;
    const lift = this.eyeLift || 0;
    if (g.mode === 'play' && g.world) this.rig.position.set(m.pos.x, m.pos.y + lift, m.pos.z);
    else if (g.map && g.map.rooms && g.map.rooms.length) { const r = g.map.rooms[0]; this.rig.position.set((r.cx + 0.5) * 3, lift, (r.cy + 0.5) * 3); }
    this.rig.rotation.y = this.turn;
    // look = head, aim = right hand
    const cam = g.rr.renderer.xr.getCamera();
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    this.rig.updateMatrixWorld(true);
    this.aimDir = this.aim();
    // the class weapon in the right hand; pointer lines only show in menus
    const menuNow = g.mode !== 'play' || !g.locked || !!g.ui.screen || g.casino.open;
    if (this.weapons) for (const [cls, w] of Object.entries(this.weapons)) w.visible = !menuNow && g.mode === 'play' && g.cls === cls && !g.dead && !g.riding;
    if (this.controllers) for (const c of this.controllers) if (c.userData.line) c.userData.line.visible = menuNow;
    if (this.muzzle) this.muzzlePos = new THREE.Vector3().setFromMatrixPosition(this.muzzle.matrixWorld);
    // controllers
    const src = { left: null, right: null };
    for (const s of this.session.inputSources) if (s.gamepad && (s.handedness === 'left' || s.handedness === 'right')) src[s.handedness] = s.gamepad;
    const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const axis = (gp, i) => { const v = gp && gp.axes[i] ? gp.axes[i] : 0; return Math.abs(v) < 0.15 ? 0 : v; };
    const L = src.left, R = src.right;
    const now = { left: L ? L.buttons.map((_, i) => btn(L, i)) : [], right: R ? R.buttons.map((_, i) => btn(R, i)) : [] };
    const down = (h, i) => now[h][i] && !this.prev[h][i];
    g.padMove = L ? { f: -axis(L, 3), s: axis(L, 2) } : null;
    const tx = axis(R, 2);
    if (Math.abs(tx) > 0.6 && this.turnArmed) { this.turn -= Math.sign(tx) * Math.PI / 6; this.turnArmed = false; }
    if (Math.abs(tx) < 0.3) this.turnArmed = true;
    // menus (the title, pause, class pick, a machine): point the right hand at the floating screen, trigger clicks
    const menu = g.mode !== 'play' || !g.locked || g.ui.screen || g.casino.open;
    if (this.hud) this.hud.visible = true;
    if (menu && this.controllers && this.hud) {
      const c = this.controllers[1];
      const o = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
      const ray = new THREE.Raycaster(o, this.aimDir || new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(this.hud, false)[0];
      if (hit && hit.uv) { g.ui.mx = hit.uv.x * g.ui.W; g.ui.my = (1 - hit.uv.y) * g.ui.H; }
      if (down('right', 0)) { // trigger: click whatever the pointer is on
        for (const bt of g.ui.buttons) if (g.ui.mx >= bt.x && g.ui.mx <= bt.x + bt.w && g.ui.my >= bt.y && g.ui.my <= bt.y + bt.h) { g.sound.unlock(); g.sound.play('ui'); bt.action(); break; }
        if (g.casino.open) g.casino.key({ code: 'Space', key: '', repeat: false });
      }
      if (down('right', 1) && g.casino.open) g.casino.key({ code: 'Escape', key: '', repeat: false });
      if (down('right', 5) && g.mode === 'play' && !g.ui.screen && !g.casino.open) g.locked = true; // B: back into the game
      g.mouseDown = false;
      this.prev = now;
      return;
    }
    if (g.mode === 'play') {
      if (down('left', 2) || (L && L.buttons[12] && L.buttons[12].pressed)) { g.locked = false; } // left stick click / menu: pause
      g.mouseDown = now.right[0] || false;
      const hold = (on, code) => { if (on) g.keys.add(code); else g.keys.delete(code); };
      hold(now.right[4], 'Space'); hold(now.right[5], 'KeyQ'); hold(now.left[0], 'ShiftLeft');
      if (down('right', 1)) g.parry();
      if (down('left', 1)) { const c = g.cls; if (c === 'cleaver') g.startSlash('pad'); else if (c === 'hornet') g.throwKnife(); else if (c === 'spinner') g.throwBall(); else if (c === 'batter') g.dropkick(); else if (c === 'grenader') g.throwMolotov(); }
      if (!now.left[1] && this.prev.left[1] && g.cls === 'cleaver') g.releaseSlash();
      if (down('left', 4)) { if (g.cls === 'hornet' && !g.nearProp()) g.loadShell(); else g.interact(); }
      if (down('left', 5)) g.backflip();
      if (down('left', 3)) g.cycleWeapon(1);
      if (down('right', 3)) g.toggleBuild();
    }
    this.prev = now;
  }
}
