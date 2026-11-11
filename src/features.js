// The newer systems, kept out of game.js: the weapon inventory, shell-by-shell reloading, voxel
// building, the PESTILENT's clouds, backflips, LAST BEE STANDING, picking (and unlocking) a class
// each run, the boss room hooks, hive modifiers on the client, cloud saves, and the horse.
// Installed onto Game.prototype (this = the game).
import * as THREE from 'three';
import {
  ENEMIES, ENEMY_TYPES, ENEMY_NAMES, CLASSES, CLASS_IDS, CLASS_UNLOCKS, UPGRADES, UPGRADE_IDS, GIGA_IDS, upgradeFits, weaponStats, COUGH, VOXEL, LAST_STAND,
  matsForKill, MEDKIT, RANDOMLINGS, DIAMOND_HORSE, HORSE_SCARE_CHANCE, HORSE_SCARE_MS, BOSS_TYPES, isRushFloor, LORE, SPINNER, BOMB,
} from './data.js';
import { raycastLevel, T, W, H, WALL, isPit } from './mapgen.js';
import { MV } from './movement.js';
import { modFx, modPct, HIVE_MODS } from './modifiers.js';
import { starterWeapon, rollWeapon, applyGun, unpackDrop, INV_SLOTS, RARITIES, describeWeapon } from './weapons.js';
import { vkey, vdecode, hasVoxel, cellOf } from './voxels.js';
import { CloudSave } from './save.js';
export const PARRY_BAR = { perParry: 0.2, speed: 0.35, radius: 5, dmg: 90, holdSec: 4, drainPerSec: 0.1 };
import { makePlayerAvatar, makeHorseScare, makeGhostCube } from './models.js';
import { buildVoxelMesh } from './level.js';
import { makeVRHand } from './xr.js';
import { sharedUniforms } from './retro.js';

const r2 = (v) => Math.round(v * 100) / 100;
const CLOUD_TINT = [[0.55, 0.85, 0.25], [0.4, 0.7, 0.2], [0.7, 0.9, 0.35]];

export function installFeatures(Game) {
  // descriptors, not Object.assign: the getters must stay getters
  Object.defineProperties(Game.prototype, Object.getOwnPropertyDescriptors({
    initFeatures() {
      this.cloud = new CloudSave(this.WD);
      { const commit = this.stats.commit.bind(this.stats); this.stats.commit = () => { commit(); this.markDirty(); }; } // lifetime stats ride along
      if (!Array.isArray(this.meta.unlocked)) this.meta.unlocked = [];
      if (!Array.isArray(this.meta.seen)) this.meta.seen = [];
      if (!this.meta.killed || typeof this.meta.killed !== 'object') this.meta.killed = {};
      this.ghost = makeGhostCube(); this.ghost.visible = false; this.scene.add(this.ghost);
      this.voxMesh = null; this.voxDirty = false;
      this.dailyStreak();
      this.meta.opens = (this.meta.opens || 0) + 1; this.saveMeta();
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(true); });
    },

    resetFeatureRun() {
      this.inv = [starterWeapon(this.cls)]; this.invSel = 0;
      this.mats = VOXEL.startMats; this.building = false; this.buildCd = 0;
      this.clouds = []; this.coughs = COUGH.max; this.coughT = 0; this.coughCd = 0;
      this.typeBuff = null; this.lastStandId = null; this.flip = null;
      this.diamondRide = false; this.diamondT = 0;
      this.gigaOffered = 0;
      this.parryBar = 0; this.parryBarT = 0;
      this.medkits = MEDKIT.start; this.medkitT = 0;
    },

    // ---------------- MEDKITS ----------------
    // Picked up (bosses, elites, champions, the shop), carried (max 3), used with N: half your max HP back.
    addMedkit() {
      if ((this.medkits || 0) >= MEDKIT.max) { // a full bag: use the spare right away instead of wasting it
        this.toHost({ t: 'heal', a: Math.round(this.maxHp * MEDKIT.heal * 0.5) }, true);
        this.ui.toast('MEDKIT BAG FULL: PATCHED UP ON THE SPOT'); this.sound.play('orb');
        return;
      }
      this.medkits = (this.medkits || 0) + 1;
      this.ui.toast(`+1 MEDKIT (${this.medkits}/${MEDKIT.max}) - PRESS N TO HEAL`); this.sound.play('orb');
    },
    useMedkit() {
      if (this.mode !== 'play' || this.dead || !this.world) return;
      if (!(this.medkits > 0)) { this.ui.toast('NO MEDKITS'); this.sound.play('deny'); return; }
      if (this.time < (this.medkitT || 0)) return;
      if (this.hp >= this.maxHp) { this.ui.toast('ALREADY AT FULL HEALTH'); return; }
      this.medkits--; this.medkitT = this.time + MEDKIT.cd;
      const a = Math.round(this.maxHp * MEDKIT.heal);
      this.toHost({ t: 'heal', a }, true);
      this.hurtFlash = 0;
      const m = this.mover;
      this.particles.burst(m.pos.x, m.pos.y + 1, m.pos.z, 30, [1, 0.25, 0.25], 4, 0.12, 0.8, 0.2);
      this.particles.burst(m.pos.x, m.pos.y + 1, m.pos.z, 20, [1, 1, 1], 3, 0.1, 0.7, 0.3);
      this.sound.play('orb');
      this.ui.toast(`MEDKIT: +${a} HP (${this.medkits} LEFT)`);
      this.stats.add('heals');
    },

    // ---------------- THE PARRY BAR ----------------
    // Every parry fills it a fifth. The fuller it is, the faster you go (up to +35%). Full: every parry
    // also blasts everything around you. Stop parrying for 4 seconds and it drains.
    addParryCharge(n = 1) {
      const wasFull = this.parryBar >= 1;
      this.parryBar = Math.min(1, this.parryBar + PARRY_BAR.perParry * Math.max(1, n) * (1 + 0.25 * this.metaLvl('tutor'))); // PARRY TUTOR (wafers)
      this.parryBarT = 0;
      if (wasFull) this.parryNova();
      else if (this.parryBar >= 1) { this.ui.banner('PARRY BAR FULL: YOUR PARRIES EXPLODE', 2); this.sound.play('rank'); }
    },
    parryNova() {
      const m = this.mover;
      if (this.inSafeZone()) return;
      this.areaBlast(m.pos.x, m.pos.y, m.pos.z, PARRY_BAR.radius, PARRY_BAR.dmg, 'PARRY NOVA');
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; this.particles.emit(m.pos.x + Math.cos(a) * 0.6, m.pos.y + 1, m.pos.z + Math.sin(a) * 0.6, Math.cos(a) * PARRY_BAR.radius * 2.4, 0.4, Math.sin(a) * PARRY_BAR.radius * 2.4, 1, 1, 0.6, 0.08, 0.35, 0); }
      this.flashLight = Math.max(this.flashLight, 0.8); this.flashPos = null;
    },
    updateParryBar(dt) {
      this.parryBarT = (this.parryBarT || 0) + dt;
      if (this.parryBarT > PARRY_BAR.holdSec && this.parryBar > 0) this.parryBar = Math.max(0, this.parryBar - PARRY_BAR.drainPerSec * dt);
      if (this.fSim) this.fSim.walkSpeed = 10 * (1 + PARRY_BAR.speed * this.parryBar); // JOHN FISTER runs on the same bar
    },

    // ---------------- saving ----------------
    persist(force = false) { if (this.cloud) this.cloud.push(performance.now() / 1000, force); }, // wall-clock: the game clock stops while paused
    markDirty() { if (this.cloud) this.cloud.dirty = true; },

    // a profile came down from the cloud: re-read everything permanent
    reloadProfile() {
      try {
        const s = JSON.parse(localStorage.getItem('crypthop.settings') || '{}');
        Object.assign(this.settings, s);
        const m = JSON.parse(localStorage.getItem('crypthop.meta') || '{}');
        Object.assign(this.meta, m);
        if (!Array.isArray(this.meta.unlocked)) this.meta.unlocked = [];
        if (!Array.isArray(this.meta.seen)) this.meta.seen = [];
        if (!this.meta.killed) this.meta.killed = {};
        this.bestFloor = Math.max(this.bestFloor, Number(localStorage.getItem('crypthop.best') || 0));
        const life = JSON.parse(localStorage.getItem('crypthop.life') || '{}');
        for (const [k, v] of Object.entries(life)) if (typeof v === 'number') this.stats.life[k] = Math.max(this.stats.life[k] || 0, v);
        if (this.friends && this.friends.load) this.friends.load();
        this.sound.setVolumes(this.settings.sfx, this.settings.music);
        this.ui.toast('CLOUD SAVE LOADED');
      } catch (e) { /* keep what we have */ }
    },

    // DAILY STREAK (a dark pattern, played for laughs: it counts, it never punishes)
    dailyStreak() {
      const today = Math.floor(Date.now() / 86400000);
      const s = this.meta.streak || { day: 0, n: 0 };
      if (s.day === today) return;
      s.n = s.day === today - 1 ? s.n + 1 : 1; s.day = today;
      this.meta.streak = s; this.saveMeta();
    },

    // ---------------- classes ----------------
    classUnlocked(id) { return CLASSES[id] && (CLASS_UNLOCKS[id] == null || this.meta.unlocked.includes(id)); },
    unlockProgress(id) {
      const u = CLASS_UNLOCKS[id]; if (!u) return 1;
      const v = u.stat === 'bestFloor' ? this.bestFloor : u.stat === 'randomlings' ? (this.meta.killed.randomling || 0) : (this.stats.life[u.stat] || 0);
      return Math.min(1, v / u.n);
    },
    checkUnlocks() {
      for (const id of CLASS_IDS) {
        if (this.classUnlocked(id) || this.unlockProgress(id) < 1) continue;
        this.meta.unlocked.push(id); this.saveMeta();
        this.ui.banner(`NEW CLASS UNLOCKED: ${CLASSES[id].name}`, 4);
        this.ui.toast('PICK IT AT THE START OF YOUR NEXT RUN');
        this.sound.play('jackpot');
        this.persist(true);
      }
    },
    // a new run: everyone picks their class, and it's locked in until the run ends
    startClassPick() {
      this.runClass = null; this.classLocked = false;
      this.ui.screen = 'class';
      this.locked = false; this.keys.clear(); this.mouseDown = false;
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
    },
    chooseClass(id) {
      if (!this.classUnlocked(id)) { this.sound.play('deny'); return; }
      this.runClass = id; this.classLocked = true;
      this.settings.lastCls = id; this.saveSettings();
      this.balls = this.spin.max; this.ballT = 0; this.slashCharge = null; this.bombs = this.maxBombs; this.homerun = 0;
      this.coughs = this.maxCoughs;
      this.inv = [starterWeapon(id)]; this.invSel = 0;
      const ws = this.gunStats(); this.weapon.ammo = ws.mag;
      this.ui.screen = null;
      this.ui.banner(id === 'fister' ? 'YOU ARE JOHN FISTER' : `YOU ARE THE ${CLASSES[id].name}`, 2.5);
      this.lock();
    },

    // ---------------- weapons ----------------
    get weaponNow() { return (this.inv && this.inv[this.invSel]) || starterWeapon(this.cls); },
    // this class's weapon multiplier on damage (HORNET's is inside the gun stats)
    wDmg() { const w = this.weaponNow; return this.cls === 'hornet' ? 1 : (w.dmg || 1); },
    wSpeed() { return this.weaponNow.speed || 1; },
    wSize() { return this.weaponNow.size || 1; },
    gunStats() {
      const ws = applyGun(weaponStats(this.myUps, this.honey), this.weaponNow);
      ws.mag = Math.max(1, ws.mag + (this.world ? modFx(this.world.mods, 'mag') : 0));
      return ws;
    },
    selectWeapon(i) {
      if (!this.inv || i < 0 || i >= this.inv.length || i === this.invSel) return;
      this.invSel = i;
      const w = this.weaponNow;
      if (this.cls === 'hornet') { this.weapon.ammo = Math.min(this.weapon.ammo, this.gunStats().mag); this.weapon.cool = Math.max(this.weapon.cool, 0.25); }
      this.sound.play('pump');
      this.ui.toast(`${i + 1}: ${w.name}`);
    },
    cycleWeapon(d) { if (this.inv && this.inv.length > 1) this.selectWeapon((this.invSel + d + this.inv.length) % this.inv.length); },
    addWeapon(w) {
      if (!this.inv) this.inv = [starterWeapon(this.cls)];
      if (this.inv.length < INV_SLOTS) this.inv.push(w);
      else { // full: swap out the weakest one you aren't holding
        let worst = -1, wp = Infinity;
        this.inv.forEach((x, i) => { if (i !== this.invSel && (x.power || 1) < wp) { wp = x.power || 1; worst = i; } });
        if (worst < 0 || wp >= (w.power || 1)) { this.ui.toast(`BAG FULL: LEFT THE ${w.name} BEHIND`); return; }
        this.ui.toast(`DROPPED ${this.inv[worst].name}`);
        this.inv[worst] = w;
      }
      this.ui.banner(`${RARITIES[w.rarity].name}: ${w.name}`, 3);
      this.ui.toast(`[${this.inv.indexOf(w) + 1}] ${describeWeapon(w)}`);
      this.sound.play(w.rarity >= 3 ? 'jackpot' : 'item');
      this.stats.add('weapons');
    },

    // RELOADING IS A MINIGAME: every press of R pushes one shell in. Mash it.
    loadShell() {
      if (this.cls !== 'hornet' || this.dead || this.riding || this.mode !== 'play') return;
      const ws = this.gunStats(), w = this.weapon;
      if (w.ammo >= ws.mag) { if (this.time - (w.fullNag || -9) > 1) { w.fullNag = this.time; this.ui.toast('FULL'); } return; }
      w.ammo = Math.min(ws.mag, w.ammo + (this.mod('hDoubleLoad') ? 2 : 1));
      w.reloadPulse = 0.12; w.reloading = false;
      this.sound.play('shell');
      this.stats.add('shellsLoaded');
      if (w.ammo >= ws.mag) { this.sound.play('pump'); w.pump = 0.3; }
    },

    // ---------------- hive modifiers on this side ----------------
    hm(key) { return this.world ? modFx(this.world.mods, key) : 0; },
    hmPct(key, floor = 0.1) { return this.world ? modPct(this.world.mods, key, floor) : 1; },
    applyModVisuals(map) {
      const th = map.theme;
      const dark = Math.max(0.15, 1 + this.hm('dark') / 100);
      sharedUniforms.uAmbient.value.set(...th.ambient.map((v) => v * dark));
      const fog = Math.max(0.25, 1 + this.hm('fog') / 100);
      sharedUniforms.uFogFar.value = (map.city ? 75 : map.arena ? 48 : 36) * fog;
      sharedUniforms.uFogNear.value = Math.min(sharedUniforms.uFogNear.value, sharedUniforms.uFogFar.value * 0.5);
    },

    // ---------------- VOXEL BUILDING ----------------
    toggleBuild() {
      if (this.inSafeZone()) { this.ui.toast('THE HONEY SHOP OPENS IN THE BOSS ROOM ONCE THE BOSS IS DEAD'); return; }
      if (this.dead || !this.world) return;
      this.building = !this.building;
      this.ui.toast(this.building ? `BUILD MODE: CLICK PLACES WAX, RIGHT CLICK BREAKS (${this.mats} WAX)` : 'BUILD MODE OFF');
      this.sound.play('ui');
    },
    // what you're pointing at: the block you'd break, and the empty cell you'd fill
    voxelTarget() {
      const map = this.world && this.world.map; if (!map) return { hit: null, place: null };
      const o = this.eyePos(), { fwd } = this.aim();
      const set = map.voxels;
      let last = null;
      const solidLevel = (x, y, z) => {
        const i = Math.floor(x / T), j = Math.floor(z / T);
        if (i < 0 || j < 0 || i >= W || j >= H) return true;
        const k = j * W + i;
        return map.type[k] === WALL || y < map.fh[k] || y > map.ch[k];
      };
      for (let t = 0.3; t <= VOXEL.reach; t += 0.05) {
        const x = o.x + fwd.x * t, y = o.y + fwd.y * t, z = o.z + fwd.z * t;
        const key = vkey(cellOf(x), cellOf(y), cellOf(z));
        if (set && set.has(key)) return { hit: key, place: last };
        if (solidLevel(x, y, z)) return { hit: null, place: last };
        last = key;
      }
      return { hit: null, place: null };
    },
    voxelFree(key) { // never build inside a bee
      const [ix, iy, iz] = vdecode(key);
      const bees = [{ x: this.mover.pos.x, y: this.mover.pos.y }, ...[...this.others.values()].filter((o) => !o.dead).map((o) => ({ x: o.model.position.x, y: o.model.position.y, z: o.model.position.z }))];
      bees[0].z = this.mover.pos.z;
      for (const b of bees) if (ix + 1 > b.x - MV.halfWidth && ix < b.x + MV.halfWidth && iz + 1 > b.z - MV.halfWidth && iz < b.z + MV.halfWidth && iy + 1 > b.y && iy < b.y + MV.standHeight) return false;
      return true;
    },
    placeVoxel() {
      if (this.buildCd > 0 || this.dead) return;
      this.buildCd = 0.16;
      if (this.mats <= 0) { this.sound.play('deny'); this.ui.toast('NO WAX: KILL FOES TO GET MORE'); return; }
      const t = this.voxelTarget();
      if (t.place == null || !this.voxelFree(t.place)) { this.sound.play('deny'); return; }
      if (this.world.map.voxels.size >= VOXEL.max) { this.ui.toast('THE HIVE CAN HOLD NO MORE WAX'); return; }
      this.mats--;
      this.toHost({ t: 'vxr', a: 1, k: t.place }, true);
      this.stats.add('blocksBuilt');
    },
    breakVoxel() {
      if (this.buildCd > 0 || this.dead) return;
      this.buildCd = 0.16;
      const t = this.voxelTarget();
      if (t.hit == null) return;
      this.mats++;
      this.toHost({ t: 'vxr', a: 0, k: t.hit }, true);
    },
    onVoxel(msg) {
      const map = this.world && this.world.map;
      if (!map || !Number.isInteger(msg.k)) return;
      if (!map.voxels) map.voxels = new Set();
      if (msg.a === 1) map.voxels.add(msg.k); else map.voxels.delete(msg.k);
      this.voxDirty = true;
      const [ix, iy, iz] = vdecode(msg.k);
      this.particles.burst(ix + 0.5, iy + 0.5, iz + 0.5, msg.a ? 8 : 16, [1, 0.8, 0.35], 3, 0.06, 0.4);
      this.sound.play(msg.a ? 'thunk' : 'break', { x: ix + 0.5, y: iy + 0.5, z: iz + 0.5 });
    },
    rebuildVoxels() {
      this.voxDirty = false;
      if (this.voxMesh) { this.scene.remove(this.voxMesh); this.voxMesh.geometry.dispose(); this.voxMesh = null; }
      const map = this.world && this.world.map;
      if (!map || !map.voxels || !map.voxels.size) return;
      this.voxMesh = buildVoxelMesh(map.voxels, this.tex);
      this.scene.add(this.voxMesh);
    },
    updateBuild(dt) {
      this.buildCd = Math.max(0, (this.buildCd || 0) - dt);
      if (this.voxDirty) this.rebuildVoxels();
      const show = this.building && !this.dead && this.mode === 'play' && this.world && !this.casino.open;
      this.ghost.visible = false;
      if (!show) return;
      const t = this.voxelTarget();
      if (t.place != null) {
        const [ix, iy, iz] = vdecode(t.place);
        this.ghost.position.set(ix + 0.5, iy + 0.5, iz + 0.5);
        this.ghost.visible = true;
        this.ghost.userData.mat.uniforms.uOpacity.value = this.mats > 0 && this.voxelFree(t.place) ? 0.45 + Math.sin(this.time * 8) * 0.1 : 0.15;
      }
    },

    // ---------------- the PESTILENT ----------------
    get maxCoughs() { return COUGH.max + this.mod('coughMax'); },
    cough() {
      if (this.dead || this.casino.open || this.micro.open || this.mode !== 'play') return;
      if (this.coughCd > 0 || this.coughs <= 0) return;
      if (this.inSafeZone()) { this.safeZoneNag(); return; }
      this.coughs--; this.coughCd = COUGH.cd / this.wSpeed();
      const o = this.eyePos(), { fwd } = this.aim();
      const c = this.spawnCloud(o.x + fwd.x * 1.2, o.y - 0.3 + fwd.y, o.z + fwd.z * 1.2, fwd.x * COUGH.speed, fwd.y * COUGH.speed * 0.5, fwd.z * COUGH.speed,
        COUGH.radius * this.modMul('cloudRadiusPct') * this.wSize(), COUGH.time * this.modMul('cloudTimePct'), true);
      this.net.broadcast({ t: 'cl', p: [r2(c.x), r2(c.y), r2(c.z)], v: [r2(c.vx), r2(c.vy), r2(c.vz)], r: r2(c.r), tt: r2(c.t) }, true);
      this.sound.play('spit');
      this.stats.add('coughs');
      this.batAnim = 0.2;
    },
    spawnCloud(x, y, z, vx, vy, vz, r, t, mine) {
      const c = { x, y, z, vx, vy, vz, r: Math.min(8, r), t: Math.min(12, t), t0: Math.min(12, t), mine, tick: 0 };
      this.clouds.push(c);
      if (this.clouds.length > 40) this.clouds.shift();
      return c;
    },
    updateClouds(dt) {
      const map = this.world && this.world.map;
      if (this.cls === 'pestilent') {
        this.coughCd = Math.max(0, this.coughCd - dt);
        if (this.coughs < this.maxCoughs) { this.coughT += dt; if (this.coughT >= COUGH.regen / this.wSpeed() / (1 + 0.2 * this.mod('coughMax'))) { this.coughT = 0; this.coughs++; } } else this.coughT = 0;
      }
      for (const c of this.clouds) {
        c.t -= dt;
        const drag = Math.exp(-dt * 3);
        c.vx *= drag; c.vy *= drag; c.vz *= drag;
        const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
        const i = Math.floor(nx / T), j = Math.floor(nz / T);
        if (map && i >= 0 && j >= 0 && i < W && j < H && map.type[j * W + i] !== WALL) { c.x = nx; c.z = nz; } else { c.vx = 0; c.vz = 0; }
        c.y += c.vy * dt;
        const life = c.t / c.t0;
        for (let n = 0; n < 3; n++) {
          const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * c.r, col = CLOUD_TINT[n];
          this.particles.emit(c.x + Math.cos(a) * rr, c.y + (Math.random() - 0.3) * c.r * 0.6, c.z + Math.sin(a) * rr, (Math.random() - 0.5) * 0.4, 0.15, (Math.random() - 0.5) * 0.4, col[0], col[1], col[2], 0.16 + 0.1 * life, 0.9, -0.05);
        }
        if (!c.mine) continue;
        c.tick -= dt;
        if (c.tick > 0) continue;
        c.tick = 0.25;
        const hits = new Map();
        const ws = weaponStats(this.myUps, this.honey);
        const dmg = COUGH.dps * 0.25 * (ws.pelletDmg / 6) * this.dmgMul() * this.modMul('cloudDmgPct');
        for (const e of this.enemies.values()) {
          if (e.goneT) continue;
          const p = e.model.position;
          if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.4 && p.y < c.y + c.r && p.y + 2.5 > c.y - c.r) { hits.set(e.id, dmg); e.flash = 0.04; e.inCloud = this.time; }
        }
        this.sendHits(hits, 'cloud');
        if (hits.size) this.addStyle(1 + hits.size, 'PESTILENCE');
      }
      this.clouds = this.clouds.filter((c) => c.t > 0);
    },

    // ---------------- BACKFLIP (J): stick it, or land on your head and explode ----------------
    backflip() {
      const m = this.mover;
      if (this.dead || this.riding || this.flip || !m.onGround || this.casino.open || this.mode !== 'play' || !this.world) return;
      if (this.cls === 'fister') { this.ui.toast('JOHN FISTER DOES NOT JUMP'); return; }
      const fail = Math.random() < 0.2; // one in five
      this.flip = { t: 0, fail, dur: fail ? 2.6 : 1.05, yaw: this.yaw, boomed: false };
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      m.vel.y = MV.jumpSpeed * 1.25; m.vel.x -= fx * 3; m.vel.z -= fz * 3; m.onGround = false;
      this.net.broadcast({ t: 'bf', f: fail ? 1 : 0 }, true);
      this.sound.play('jump');
      this.stats.add('backflips');
      if (!this.selfModel) { this.selfModel = makePlayerAvatar(this.colorOf(this.myId), '', this.hat); this.selfModel.rotation.order = 'YXZ'; if (this.selfModel.userData.tag) this.selfModel.userData.tag.visible = false; this.entityRoot.add(this.selfModel); }
    },
    flipPose(model, t, fail) { // a full turn backward in 0.75s, or 1.2 turns and a faceplant
      const k = Math.min(1, t / (fail ? 0.6 : 0.75));
      const ease = k < 1 ? k * k * (3 - 2 * k) : 1;
      model.rotation.x = fail ? ease * Math.PI * 1.15 : ease * Math.PI * 2;
      if (k >= 1 && !fail) model.rotation.x = 0;
    },
    updateFlip(dt) {
      const f = this.flip;
      if (this.selfModel) this.selfModel.visible = !!f && !this.dead;
      if (!f) return;
      f.t += dt;
      const m = this.mover, sm = this.selfModel;
      sm.position.set(m.pos.x, m.pos.y, m.pos.z); sm.rotation.y = f.yaw + Math.PI;
      this.flipPose(sm, f.t, f.fail);
      if (f.fail && !f.boomed && f.t > 0.5 && (m.onGround || f.t > 0.9)) {
        f.boomed = true;
        this.toHost({ t: 'flop' }, true);
        this.ui.banner('YOU LANDED ON YOUR HEAD AND EXPLODED', 2.2);
        this.addStyle(50, 'CATASTROPHIC BACKFLIP');
        this.stats.add('flops');
        this.hitstop = 0.12;
      }
      if (!f.fail && f.t > 0.75 && !f.styled) { f.styled = true; this.addStyle(25, 'BACKFLIP'); }
      if (f.t >= f.dur || this.dead) { this.flip = null; if (sm) { sm.rotation.x = 0; sm.visible = false; } }
    },
    // a third-person camera that swings around you while you flip
    flipCamera() {
      const f = this.flip, sm = this.selfModel;
      if (!f || !sm) return false;
      const p = sm.position;
      const a = f.yaw + Math.PI * 0.75 + f.t * 0.8, dist = f.fail && f.boomed ? 5.5 : 3.6;
      const cx = p.x - Math.sin(a) * dist, cz = p.z - Math.cos(a) * dist;
      const cp = this.safeCamera(p.x, p.y + 0.9, p.z, cx, p.y + 2.2, cz); // zooms in rather than going through a wall
      this.camera.lookAt(p.x, p.y + 0.9, p.z);
      this.sound.listener = { x: cp.x, y: cp.y, z: cp.z, yaw: this.yaw };
      return true;
    },

    // ---------------- events from the host (new kinds) ----------------
    onFeatureEvent(m) {
      switch (m.k) {
        case 'bossin': {
          const name = ENEMY_NAMES[m.type] || 'A BOSS';
          this.ui.banner(m.total > 1 ? `BOSS ${m.total - m.left}/${m.total}: ${name}` : name, 3);
          this.sound.play('boss'); this.flashLight = 1;
          this.buddy.event('boss', true);
          this.seeEnemy(ENEMY_TYPES[m.type]);
          return true;
        }
        case 'bossdone': this.ui.banner(m.rush ? 'BOSS RUSH CLEARED' : 'THE BOSS IS DEAD. THE WAY OUT IS OPEN', 3); this.sound.play('jackpot'); this.stats.add('bosses'); return true;
        case 'giga': {
          const pool = GIGA_IDS.slice(), pick = [];
          while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
          pick.giga = true;
          this.offers.unshift(pick);
          this.ui.banner('GIGA UPGRADE! PICK ONE (SHIFT + 1 2 3)', 4);
          this.sound.play('jackpot');
          return true;
        }
        case 'chest':
          this.particles.burst(m.x, m.y + 1, m.z, 80, [1, 0.8, 0.2], 8, 0.12, 1, 0.3);
          this.sound.play('jackpot');
          this.ui.toast(m.pid === this.myId ? 'YOU OPENED THE BOSS CHEST' : `${this.net.nameOf(m.pid)} OPENED THE BOSS CHEST`);
          return true;
        case 'shock': this.addShockFx(m); return true;
        case 'leap': { const e = this.enemies.get(m.id); if (e) this.sound.play('growl', e.model.position); return true; }
        case 'phoenix':
          this.particles.burst(m.x, m.y + 1, m.z, 90, [1, 0.6, 0.1], 10, 0.14, 1.2, -0.3);
          this.ui.banner(m.id === this.myId ? 'PHOENIX WAX: YOU CHEATED DEATH' : `${this.net.nameOf(m.id)} CHEATED DEATH`, 2.5);
          this.sound.play('win');
          return true;
        case 'last': {
          const id = m.id || null, was = this.lastStandId;
          this.lastStandId = id;
          if (id && id === this.myId) { this.ui.banner('LAST BEE STANDING: -50% DAMAGE TAKEN, MUCH FASTER', 4); this.sound.play('rank'); this.addStyle(80, 'LAST BEE STANDING'); this.stats.add('lastStands'); }
          else if (id) this.ui.banner(`${this.net.nameOf(id)} IS THE LAST BEE STANDING`, 3);
          else if (was) this.ui.toast('THE LAST STAND IS OVER');
          return true;
        }
      }
      return false;
    },
    // the shockwave ring rolling out (JUMP IT)
    addShockFx(m) {
      this.shockFx = this.shockFx || [];
      this.shockFx.push({ x: m.x, y: m.y, z: m.z, r: 0.5, v: m.v, max: m.m });
      this.fxSlam(m.x, m.y, m.z, m.m, [1, 0.55, 0.2], Math.max(0.1, (m.m - 0.5) / Math.max(0.1, m.v)), { from: 0.5, linear: true, alpha: 0.95 }); // the ring rolls out at the wave's real speed
      this.sound.play('boom', { x: m.x, y: m.y, z: m.z });
      if (Math.hypot(m.x - this.mover.pos.x, m.z - this.mover.pos.z) < m.m && !this.shockTip) { this.shockTip = true; this.ui.banner('SHOCKWAVE! JUMP OVER THE RING', 1.8); }
    },
    updateShockFx(dt) {
      if (!this.shockFx) return;
      for (const s of this.shockFx) {
        s.r += s.v * dt;
        const d = Math.hypot(s.x - this.mover.pos.x, s.z - this.mover.pos.z);
        if (Math.abs(d - s.r) < 1.2 && !this.dead) this.landDip = Math.max(this.landDip || 0, 0.05);
      }
      this.shockFx = this.shockFx.filter((s) => s.r < s.max);
    },

    // the archive (the in-game bestiary): every kind of foe you've laid eyes on
    seeEnemy(type) {
      if (!type || this.meta.seen.includes(type)) return;
      this.meta.seen.push(type); this.saveMeta();
      if (this.meta.seen.length > 1 && LORE[type]) this.ui.toast(`NEW IN THE ARCHIVE: ${ENEMY_NAMES[ENEMY_TYPES.indexOf(type)]}`);
    },
    noteKill(typeIdx) {
      const type = ENEMY_TYPES[typeIdx];
      if (!type) return;
      this.meta.killed[type] = (this.meta.killed[type] || 0) + 1;
      if (RANDOMLINGS.includes(type)) { this.meta.killed.randomling = (this.meta.killed.randomling || 0) + 1; this.saveMeta(); this.checkUnlocks(); }
    },

    // ---------------- the horse ----------------
    horseScare() {
      if (this.scare) return;
      const m = makeHorseScare();
      m.position.set(0, -0.05, -0.55);
      this.viewScene.add(m);
      this.scare = { model: m, start: performance.now() };
      this.sound.play('scream'); this.sound.play('neigh');
      this.stats.add('horseScares');
    },
    endScareIfDone() {
      if (!this.scare) return;
      if (performance.now() - this.scare.start >= HORSE_SCARE_MS) { this.viewScene.remove(this.scare.model); this.scare = null; }
    },
    rollHorseScare() { if (Math.random() < HORSE_SCARE_CHANCE) this.horseScare(); },

    // ---------------- per frame ----------------
    updateFeatures(dt) {
      if (this.mode === 'play' && this.world) {
        this.updateParryBar(dt);
        if (this.updateEconomy) this.updateEconomy(dt); // rooftop clock, post-boss shop (economy.js)
        this.updatePorridge(dt);
        if (this.updateFlair) this.updateFlair(dt); // PIXEL PORRIDGE flair on everyone (porridge.js)
        this.updateClouds(dt);
        this.updateFlip(dt);
        this.updateShockFx(dt);
        if (this.typeBuff) { this.typeBuff.t -= dt; if (this.typeBuff.t <= 0) { this.typeBuff = null; this.ui.toast('YOUR TYPING BUFF WORE OFF'); } }
        if (this.riding && this.diamondRide && !this.dead) { this.diamondT += dt; if (this.diamondT >= DIAMOND_HORSE.waferEvery) { this.diamondT = 0; this.addWafers(1); this.ui.toast('THE DIAMOND HORSE SHED A WAFER'); this.sound.play('wafer'); } }
        // stompers shake the ground with every step; QUAKING HIVE never stops
        let shake = this.hm('shake') ? 0.012 : 0;
        for (const e of this.enemies.values()) {
          if (ENEMY_TYPES[e.type] !== 'stomper' || !(e.speed > 0.3)) continue;
          e.stepT = (e.stepT || 0) + dt;
          if (e.stepT >= 0.75) {
            e.stepT = 0;
            const d = Math.hypot(e.tx - this.mover.pos.x, e.tz - this.mover.pos.z);
            if (d < 18) { this.sound.play('thunk', e.model.position); this.stompShake = Math.max(this.stompShake || 0, 0.1 * (1 - d / 18)); }
          }
        }
        this.stompShake = Math.max(0, (this.stompShake || 0) - dt * 0.4);
        this.shake = shake + this.stompShake;
      }
      this.updateBuild(dt);
      this.updateOtherVR();
      if (this.cloud) this.cloud.tick(performance.now() / 1000);
      if (this.musicCheckT === undefined || (this.musicCheckT -= dt) <= 0) { this.musicCheckT = 0.5; this.pickTrack(); }
    },
    pickTrack() {
      if (!this.sound.ctx || this.calm) { if (this.sound.ctx) this.sound.setTrack(null); return; }
      let t = null;
      if (this.mode === 'play' && this.world) {
        if (this.lastStandId) t = 'last';
        else if (this.world.stage === 'hive' && !this.casino.open) t = 'main';
      }
      this.sound.setTrack(t);
    },

    rollWeaponNow(minRarity = 0) { return rollWeapon((Math.random() * 0xfffffff) >>> 0, (this.world && this.world.floor) || 1, this.cls, Math.max(0, Math.min(4, minRarity | 0))); },

    // other players in VR: their hands float where their real hands are, their head turns with them
    updateOtherVR() {
      for (const o of this.others.values()) {
        const live = o.vr && this.time - (o.vrT || -9) < 1.0 && !o.dead;
        if (live && !o.vrHands) {
          o.vrHands = [makeVRHand(undefined, true), makeVRHand(undefined, false)];
          for (const h of o.vrHands) { h.scale.setScalar(1.3); this.entityRoot.add(h); }
        }
        if (!live && o.vrHands) { for (const h of o.vrHands) this.entityRoot.remove(h); o.vrHands = null; }
        if (!o.vrHands) continue;
        const base = o.model.position, v = o.vr;
        o.vrHands.forEach((h, i) => { const b = 3 + i * 7; h.position.set(base.x + v[b], base.y + v[b + 1], base.z + v[b + 2]); h.quaternion.set(v[b + 3], v[b + 4], v[b + 5], v[b + 6]); });
      }
    },

    // ---------------- PIXEL PORRIDGE: parasitic game design, as a feature ----------------
    // Relics sometimes come with a PIXEL PORRIDGE TOKEN. Tokens nag you, nibble your honey while you
    // hold them, and can only be spent on the EXCLUSIVE SHOP (porridge.js): 30 seconds of cosmetics at
    // 5,000 honey and up. (Once they opened PORRIDGE CRATES, which mostly contained cold porridge and
    // sometimes another token.) It is a joke about storefronts and loot boxes; it costs nothing real.
    maybePorridge() {
      if (Math.random() >= 0.25) return;
      this.meta.porridge = (this.meta.porridge || 0) + 1; this.saveMeta();
      this.ui.banner(`+1 PIXEL PORRIDGE TOKEN (YOU HAVE ${this.meta.porridge})`, 3);
      this.ui.toast('SPEND IT FROM THE PAUSE MENU: THE EXCLUSIVE SHOP OPENS FOR 30 SECONDS. BRING 5,000 HONEY.');
      this.sound.play('jackpot');
    },
    updatePorridge(dt) {
      const n = this.meta.porridge || 0;
      if (!n || this.mode !== 'play' || this.dead) return;
      this.porridgeT = (this.porridgeT || 0) + dt;
      this.porridgeNib = (this.porridgeNib || 0) + dt;
      if (this.porridgeNib >= 60) { this.porridgeNib = 0; if (this.honey > 0) { this.spendHoney(Math.min(this.honey, n), 'porridge'); this.ui.toast(`YOUR ${n} PORRIDGE TOKEN${n > 1 ? 'S' : ''} ATE ${n} HONEY`); } }
      if (this.porridgeT >= 90) {
        this.porridgeT = 0;
        const nags = [`YOU HAVE ${n} UNSPENT PIXEL PORRIDGE TOKENS`, 'YOUR PORRIDGE IS GETTING COLD', 'OTHER BEES HAVE ALREADY BOUGHT THE WHALE FIN', 'LIMITED TIME: THE EXCLUSIVE SHOP IS STILL EXCLUSIVE', 'THE EXCLUSIVE SHOP STARTS AT 5,000 HONEY. START SAVING.', 'DID YOU FORGET YOUR TOKENS? THEY DID NOT FORGET YOU'];
        this.ui.banner(nags[Math.floor(Math.random() * nags.length)], 3);
      }
    },
    // the old crate button now spends a token on the EXCLUSIVE SHOP instead
    openPorridgeCrate() { return this.openPorridgeShop ? this.openPorridgeShop() : 'NO TOKENS'; },

    // offers: at least one card is always for your class only
    rollClassOffer() {
      const pool = UPGRADE_IDS.filter((u) => upgradeFits(u, this.cls));
      const mine = pool.filter((u) => UPGRADES[u].cls === this.cls);
      const out = [];
      if (mine.length) out.push(mine[Math.floor(Math.random() * mine.length)]);
      const rest = pool.filter((u) => !out.includes(u));
      while (out.length < 3 && rest.length) out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      return out;
    },

    // what ui.js shows under the floor name
    modLines() { return (this.world && this.world.mods || []).map((id) => HIVE_MODS[id]).filter(Boolean); },
  }));
}

export { BOSS_TYPES, isRushFloor, RARITIES, describeWeapon, unpackDrop, rollWeapon };
