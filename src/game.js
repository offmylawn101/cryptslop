// The client: local player, weapons, rendering of the shared world, and glue to the host simulation.
import * as THREE from 'three';
import { generateFloor, raycastLevel, openVault, gateAt, spawnSlot, inLounge, describeSpot, isPit, WORLDS, T, W, H, WALL, themeFor, GATE_KINDS, REAL_ROOMS } from './mapgen.js';
import { generateArena } from './arena.js';
import { installFeatures } from './features.js';
import { installEconomy } from './economy.js';
import { installFister } from './fisterPort.js';
import { installClasses2 } from './classes2.js';
import { installPorridge } from './porridge.js';
import { installWishes } from './wishes.js';
import { installShapeFx } from './shapefx.js';
import { installChangelog } from './changelogUI.js';
import { installBugsClient } from './bugs.js';
import { installBestiaryClient } from './bestiary.js';
import { installRooftopsClient } from './rooftops.js';
import { installWishBatch1Client } from './wishbatch1.js';
import { installWishBatch2Client } from './wishbatch2.js';
import { installWishBatch3Client } from './wishbatch3.js';
import { installWishBatch4Client } from './wishbatch4.js';
import { installElites } from './elites.js';
import { installSaber, makeSaber } from './saber.js';
import { installPerks } from './perks.js';
import { installQuests } from './quests.js';
import { installParryFx } from './parryfx.js';
import { GamepadInput } from './gamepad.js';
import { XRSupport } from './xr.js';
import { hasVoxel } from './voxels.js';
import { unpackDrop, rollWeapon } from './weapons.js';
import { Mover, MV, TICK, U } from './movement.js';
import { RetroRenderer, sharedUniforms, makeLevelTextures, MAX_LIGHTS } from './retro.js';
import { buildLevel, disposeLevel } from './level.js';
import { Particles } from './particles.js';
import {
  ENEMY_BUILDERS, animateEnemy, setFlash, makePlayerModel, animatePlayer, makeOrb, makeHoneyDrop, makeWafer, makeKeyModel, makeMedkit,
  makeItemPickup, makeKnife, makeMolotov, makeProjectile, makeNameTag, makeBomb, setXray, xrayPulse, makeViewmodel, makeHorse, animateHorse, makeJavelin, makeSpinBall,
  makePlayerAvatar, makeDiamondHorse, makeWeaponDrop, makeChest,
} from './models.js';
import {
  ENEMIES, ENEMY_TYPES, ENEMY_NAMES, UPGRADE_IDS, UPGRADES, weaponStats, moveStats, colorForId, countUp, HONEY_FOR_KILL,
  RANKS, STYLE_CAP, rankFor, ITEMS, ITEM_IDS, BASE_SLOTS, BOSS_TYPES, HAT_IDS, PLAYER_COLORS, spinStats, modSum, TIERS, AFFIX_IDS, AFFIXES, champName,
  CLASSES, CLASS_IDS, BAT, BOMB, bombDamage, rocketPush, hasMove, upgradeFits, SPINNER, REVIVE, XRAY_LEFT,
  isRushFloor, LAST_STAND, DIAMOND_HORSE, DIAMOND_HORSE_CHANCE, matsForKill, saysCurse, RANDOMLINGS,
} from './data.js';
import { CHARACTERS } from './dating.js';
import { Sim } from './sim.js';
import { SoloNet, WavedashNet, LocalNet } from './net.js';
import { SoundSystem } from './audio.js';
import { UI } from './ui.js';
import { Stats } from './stats.js';
import { Casino } from './casino.js';
import { DevConsole } from './console.js';
import { Buddy } from './buddy.js';
import { Microgames } from './microgame.js';
import { Friends, pickLobby } from './friends.js';
import { QTE } from './qte.js';
import { Clutter } from './clutter.js';
import { generateCity, STREET } from './city.js';
import { TouchControls } from './touch.js';

const BLOOD = [[1, 0.8, 0.15], [0.9, 0.4, 0.1], [0.3, 0.6, 0.7], [1, 0.9, 0.3], [1, 0.45, 0.9], [0.8, 0.75, 0.6], [0.5, 0.9, 0.3], [0.3, 0.25, 0.35], [1, 0.95, 0.3], [0.9, 0.75, 0.5], [0.7, 0.25, 0.15], [0.6, 0.4, 0.2], [0.6, 0.85, 0.3], [0.5, 0.3, 0.6], [1, 0.3, 1], [0.6, 0.1, 0.2], [0.6, 0.6, 0.5], [1, 0.6, 0.2], [0.4, 0.9, 0.9], [0.9, 0.5, 0.2], [1, 0.85, 0.2], [0.6, 0.6, 0.7], [0.7, 0.15, 0.1], [0.6, 0.8, 0.4], [0.6, 0.45, 0.3],
  [0.7, 0.7, 0.75], [0.6, 0.1, 0.15], [0.4, 0.8, 1], [0.95, 0.9, 0.75], [0.9, 0.4, 0.7], [0.95, 0.95, 0.9], [1, 0.75, 0.25], [0.8, 0.7, 0.5], [0.4, 0.3, 0.2], [0.8, 0.1, 0.2], [0.6, 0.05, 0.05]];
const FINGLER = ENEMY_TYPES.indexOf('fingler'); // ichor, honey, hologram...

function loadSettings() {
  const def = { sens: 2.0, fov: 90, res: 240, autoBhop: true, sfx: 0.6, music: 0.35, scan: true, name: '', clutter: 2 };
  try {
    const s = JSON.parse(localStorage.getItem('crypthop.settings') || '{}');
    return { ...def, ...s };
  } catch (e) { return def; }
}

function loadMeta() {
  const def = { wafers: 0, ups: {}, bestHearts: {}, jackpots: 0 };
  try { return { ...def, ...JSON.parse(localStorage.getItem('crypthop.meta') || '{}') }; } catch (e) { return def; }
}

export class Game {
  constructor(canvas, WD) {
    this.WD = WD; // Wavedash SDK or null
    this.canvas = canvas;
    this.settings = loadSettings();
    this.meta = loadMeta();
    this.rr = new RetroRenderer(canvas);
    this.rr.setLowHeight(this.settings.res);
    this.rr.postMat.uniforms.uScan.value = this.settings.scan ? 0.12 : 0;
    this.sound = new SoundSystem();
    this.sound.setVolumes(this.settings.sfx, this.settings.music);
    this.tex = makeLevelTextures();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 120);
    this.camera.rotation.order = 'YXZ';
    this.viewScene = new THREE.Scene();
    this.viewCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.particles = new Particles(this.scene);
    this.entityRoot = new THREE.Group(); this.scene.add(this.entityRoot);

    this.mover = new Mover();
    this.yaw = 0; this.pitch = 0;
    this.keys = new Set();
    this.mouseDown = false;
    this.wheelJump = 0;
    this.locked = false;
    this.time = 0;

    this.mode = 'menu';
    this.net = null; this.sim = null;
    this.world = null;
    this.level = null;
    this.enemies = new Map(); this.projs = new Map(); this.orbs = new Map(); this.others = new Map();
    this.ups = new Map(); // playerId -> upgrade list
    this.hpMap = {};
    this.lastSeq = 0;
    this.offers = [];
    this.chat = []; this.chatOpen = false; this.chatText = '';
    this.hurtFlash = 0; this.hurtDirs = [];
    this.hitMarker = 0; this.killMarker = 0;
    this.flashLight = 0;
    this.sendTimer = 0;
    this.welcomed = false;
    this.helloTimer = 0;
    this.stepTimer = 0;
    this.titleCard = null;
    this.runOver = null;
    this.bestFloor = 0;
    try { this.bestFloor = Number(localStorage.getItem('crypthop.best') || 0); } catch (e) { /* ignore */ }

    this.weapon = { ammo: 6, cool: 0, reloading: false, reloadT: 0, kick: 0, pump: 0 };
    this.viewmodel = null;
    this.stats = new Stats();
    this.resetRunState();
    this.casino = new Casino(this);
    this.ui = new UI(this);
    this.console = new DevConsole(this);
    this.buddy = new Buddy(this);
    this.friends = new Friends();
    this.colors = new Map(); // other players' chosen name colors
    this.palette = PLAYER_COLORS;
    this.pings = [];
    this.micro = new Microgames(this);
    this.qte = new QTE(this);
    this.clutter = new Clutter(this);
    this.touch = new TouchControls(this);
    this.initFeatures();
    this.pad = new GamepadInput(this);
    this.xr = new XRSupport(this);
    this.setupInput();
    this.rr.onResize = () => this.onResize();
    this.onResize();
    this.buildDemo();
  }

  resetRunState() {
    this.honey = 0; this.items = []; this.active = null; this.activeCd = 0;
    this.style = 0; this.rank = 0; this.styleFeed = [];
    this.wbuff = { stacks: 0, t: 0 }; this.wLast = new Map();
    this.riding = false; this.horse = null;
    this.throws = []; this.quiver = 3; this.quiverT = 0; this.balls = 2 + (this.meta ? this.metaLvl("spin") : 0); this.ballT = 0;
    this.parryCd = 0; this.parryAnim = 0; this.hitstop = 0;
    this.history = []; this.histT = 0;
    this.speedBoost = 0; this.infAmmo = 0; this.dmgBoost = 0;
    this.slamming = false;
    this.floorKey = 0; this.picked = new Set(); this.pickMeshes = new Map(); // floorKey: how many ROYAL KEYS you hold (they carry between floors)
    this.explored = new Uint8Array(W * H);
    this.dates = { used: -1, aff: {}, step: {}, blessed: [] };
    this.lastKillT = -9; this.multi = 0;
    this.gateToastT = 0;
    if (this.micro) this.micro.reset();
    if (this.qte) this.qte.reset();
    this.knives = 5; this.knifeT = 0; this.molotovs = 2; this.molotovT = 0; this.fires = [];
    this.bombs = BOMB.max; this.bombT = 0; this.batCd = 0; this.batAnim = 0; this.homerun = 0; this.lures = [];
    this.resetFeatureRun();
  }

  get myId() { return this.net ? this.net.myId : 'solo'; }
  get spin() {
    const s = spinStats(this.myUps, this.metaLvl('spin'));
    if (this.cls === 'spinner') { // spin balls are the whole kit: more of them, faster, harder
      s.max += SPINNER.maxBonus; s.recharge /= SPINNER.rechargeDiv; s.bounces += SPINNER.bouncesBonus; s.dmg *= SPINNER.dmgMul; s.goldWindow *= SPINNER.goldWindowMul;
      if (this.inv) { const w = this.weaponNow; s.recharge /= w.speed || 1; s.bounces += w.extra || 0; }
    }
    return s;
  }
  mod(key) { return modSum(this.myUps, key); }
  modMul(key, floor = 0.1) { return Math.max(floor, 1 + this.mod(key) / 100); }
  get maxKnives() { return 5 + this.mod('knives'); }
  get maxMolotovs() { return 2 + this.mod('molotovs'); }
  // DOPAMINE RUSH off = calm mode: no microgames, no buddy, minimal HUD, no rank fanfare, gentler music
  get calm() { return this.settings.dopamine === false; }
  get hat() { return this.meta.hat || 'none'; }
  setHat(h) { this.meta.hat = HAT_IDS.includes(h) ? h : 'none'; this.saveMeta(); }
  colorOf(id) {
    if (id === this.myId) return /^#[0-9a-f]{6}$/i.test(this.settings.color || '') ? this.settings.color : colorForId(id);
    return this.colors.get(id) || colorForId(id);
  }
  get myUps() { return this.ups.get(this.myId) || []; }
  get playerName() {
    if (this.WD) { try { return (this.WD.getUsername() || 'PLAYER').slice(0, 16); } catch (e) { /* ignore */ } }
    if (!this.settings.name) this.settings.name = 'HOPPER' + Math.floor(10 + Math.random() * 90);
    return this.settings.name.slice(0, 16);
  }
  metaLvl(id) { return this.meta.ups[id] || 0; }
  get slotsMax() { let n = BASE_SLOTS + this.metaLvl('pockets'); for (const i of this.items) n += (ITEMS[i].fx && ITEMS[i].fx.slots) || 0; return n; }
  itemFx(key) { let v = 0; for (const i of this.items) v += (ITEMS[i].fx && ITEMS[i].fx[key]) || 0; return v; }
  blessed(fx) { return this.dates.blessed.some((id) => { const c = CHARACTERS.find((q) => q.id === id); return c && c.blessing.fx === fx; }); }
  get paused() { return !!(this.net && this.net.mode === 'solo' && this.mode === 'play' && (!this.locked || this.casino.open || this.console.open || (this.micro && this.micro.open))); }

  saveSettings() {
    try { localStorage.setItem('crypthop.settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
    if (this.cloud) this.cloud.dirty = true;
    this.sound.setVolumes(this.settings.sfx, this.settings.music);
    this.rr.postMat.uniforms.uScan.value = this.settings.scan ? 0.12 : 0;
    if (this.rr.lowHeight !== this.settings.res) this.rr.setLowHeight(this.settings.res);
    this.onResize();
  }
  saveMeta() { try { localStorage.setItem('crypthop.meta', JSON.stringify(this.meta)); } catch (e) { /* ignore */ } if (this.cloud) this.cloud.dirty = true; }

  onResize() {
    const a = this.rr.aspect;
    const vfov = 2 * Math.atan(Math.tan((this.settings.fov * Math.PI) / 360) * 0.75) * (180 / Math.PI);
    this.camera.fov = vfov; this.camera.aspect = a; this.camera.updateProjectionMatrix();
    this.viewCam.aspect = a; this.viewCam.updateProjectionMatrix();
    this.particles.setScale(this.rr.height, vfov);
  }

  // ---------------- input ----------------
  setupInput() {
    const c = this.canvas;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked) { this.keys.clear(); this.mouseDown = false; this.casino.close(); }
    });
    document.addEventListener('mousemove', (e) => {
      this.ui.mouseMove(e);
      if (this.buddy.dragging) { this.buddy.pointerMove(this.ui.mx, this.ui.my); return; }
      if (this.micro.open && this.locked) { this.micro.mouse(e.movementX, e.movementY); return; }
      if (!this.locked || this.casino.open || this.console.open) return;
      this.lookBy(e.movementX, e.movementY);
    });
    c.addEventListener('mousedown', (e) => {
      this.sound.unlock();
      if (!this.locked) { this.ui.mouseMove(e); if (e.button === 0 && this.buddy.pointerDown(this.ui.mx, this.ui.my)) return; this.ui.click(e); return; }
      if (this.micro.open) { if (e.button === 0) this.micro.click(); return; }
      if (this.console.open) return;
      if (this.casino.open) { if (e.button === 0) this.casino.key({ code: 'Space' }); return; }
      if (this.dead && this.mode === 'play') { // spectating: switch who you watch
        if (e.button === 0) this.specCycle(1); else if (e.button === 2) this.specCycle(-1); else if (e.button === 1) this.doPing();
        return;
      }
      if (e.button === 1) { this.doPing(); e.preventDefault(); return; }
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) { if (this.cls === 'fister' && !this.building) this.fParry = true; else this.parry(); }
      if (e.button === 3 || e.button === 4) this.keys.add('Dash');
      e.preventDefault();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseDown = false; this.buddy.pointerUp(); }
      if (e.button === 2) this.fParry = false;
      if (e.button === 3 || e.button === 4) this.keys.delete('Dash');
    });
    c.addEventListener('wheel', (e) => {
      if (this.locked && !this.casino.open && !this.console.open) { this.wheelJump = 0.06; e.preventDefault(); }
      else if (!this.locked && this.ui.onWheel && this.ui.onWheel(e)) e.preventDefault(); // scrolling the changelog
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (this.wishOpen) return; // typing a wish (wishes.js): the game hears nothing
      this.sound.unlock();
      // the developer console: ` / ~ / F1, like Source
      if ((e.code === 'Backquote' || e.code === 'F1') && !this.chatOpen) { e.preventDefault(); this.console.toggle(); return; }
      if (this.console.open) { e.preventDefault(); this.console.key(e); return; }
      if (this.micro.open && this.mode === 'play') { e.preventDefault(); this.micro.key(e); return; }
      if (this.chatOpen) { this.chatKey(e); e.preventDefault(); return; }
      if (e.code === 'KeyY' && this.mode === 'play' && !e.repeat && !(this.casino && this.casino.open)) { e.preventDefault(); this.openWishes(); return; } // Y: make a wish, any time in a run (wishes.js)
      if (this.mode === 'play' && this.locked) {
        if (['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyC', 'KeyQ', 'KeyE', 'KeyF', 'KeyG', 'KeyI', 'KeyM', 'KeyV', 'KeyB', 'KeyJ', 'KeyR', 'KeyN', 'KeyL'].includes(e.code)) e.preventDefault();
        if (this.casino.open) { if (!e.repeat) this.casino.key(e); return; }
        if (e.repeat) { this.keys.add(e.code); return; }
        if (e.code === 'Enter' || e.code === 'KeyT') { if (this.net) { this.chatOpen = true; this.chatText = ''; e.preventDefault(); return; } }
        // number keys switch weapons; SHIFT + number picks a boon
        if (/^Digit[1-9]$/.test(e.code)) { const n = Number(e.code.slice(5)) - 1; if (e.shiftKey) this.pickUpgrade(n); else this.selectWeapon(n); }
        if (e.code === 'KeyR') this.loadShell(); // reloading is a minigame: one shell per press
        if (e.code === 'KeyJ') this.backflip();
        if (e.code === 'KeyE') this.interact();
        if (e.code === 'KeyF') this.useActive();
        if (e.code === 'KeyG') { if (this.cls === 'fister') this.fGrab = true; else this.throwBall(); }
        if (e.code === 'KeyV') this.startSlash();
        if (e.code === 'KeyZ') this.doPing();
        if (e.code === 'KeyX') this.dropkick();
        if (e.code === 'KeyK') this.throwKnife();
        if (e.code === 'KeyH') this.throwMolotov();
        if (e.code === 'KeyN') this.useMedkit();
        if (e.code === 'KeyL') this.toggleSaber();
        this.qte.key(e.code);
        if (e.code === 'KeyP' && this.usePower) this.usePower(); // POWERS (wishbatch2.js)
        if (e.code === 'KeyB') this.toggleBuild(); // the HONEY SHOP in the lounge, BUILD MODE everywhere else
        if (e.code === 'KeyI') this.casino.openInventory(0);
        if (e.code === 'KeyM') this.casino.openInventory(3);
      } else if (this.mode === 'menu' || !this.locked) {
        this.ui.key(e);
      }
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.micro.keyUp(e); if (e.code === 'KeyV') this.releaseSlash(); if (e.code === 'KeyG') this.fGrab = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
  }

  chatKey(e) {
    if (e.code === 'Escape') { this.chatOpen = false; return; }
    if (e.code === 'Enter') {
      const text = this.chatText.trim().slice(0, 80);
      this.chatOpen = false;
      if (text) {
        this.net.broadcast({ t: 'chat', text }, true);
        this.addChat(this.playerName, text, this.colorOf(this.myId));
        this.checkW(this.myId, text);
        this.stats.add('chats');
        this.chatConsequences(text);
      }
      return;
    }
    if (e.code === 'Backspace') { this.chatText = this.chatText.slice(0, -1); return; }
    if (e.key.length === 1 && this.chatText.length < 80) this.chatText += e.key.toUpperCase();
  }

  addChat(name, text, color) {
    this.chat.push({ name, text, color, t: 10 });
    if (this.chat.length > 6) this.chat.shift();
    this.sound.play('chat');
  }

  // spam W's in chat: every all-W message stacks a party-wide buff
  checkW(from, text) {
    if (!/^[W\s!]+$/i.test(text) || !/W/i.test(text)) return;
    const last = this.wLast.get(from) || -9;
    if (this.time - last < 0.4) return;
    this.wLast.set(from, this.time);
    this.wbuff.stacks = Math.min(10, this.wbuff.stacks + 1);
    this.wbuff.t = 10;
    this.stats.add('ws');
    this.ui.toast(`W x${this.wbuff.stacks}: +${this.wbuff.stacks * 3}% DMG +${this.wbuff.stacks * 2}% SPEED`);
  }

  lock() {
    this.sound.unlock();
    if (this.ui && this.ui.screen === 'class') return; // pick a class first
    if (this.xr && this.xr.session) { this.locked = true; return; }
    if (this.pad && this.pad.active) { this.locked = true; return; } // a controller has no pointer to lock
    if (this.touch && this.touch.enabled) { // phones have no pointer lock: just start playing (fullscreen, sideways)
      this.locked = true;
      try { const de = document.documentElement; if (!document.fullscreenElement && de.requestFullscreen) { const p = de.requestFullscreen(); if (p && p.then) p.then(() => { try { const o = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (o && o.catch) o.catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {}); } } catch (e) { /* ignore */ }
      return;
    }
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { /* user must click again */ });
    } catch (e) { /* ignore */ }
  }

  // ---------------- demo scene behind the title menu ----------------
  buildDemo() {
    const map = generateFloor(424242, 1);
    this.setLevel(map);
    this.demoT = 0;
  }

  setLevel(map) {
    if (this.level) { this.scene.remove(this.level.group); disposeLevel(this.level); }
    this.map = map;
    this.level = buildLevel(map, this.tex);
    this.scene.add(this.level.group);
    this.particles.map = map;
    this.particles.clear();
    const th = map.theme;
    sharedUniforms.uFogColor.value.set(...th.fog);
    sharedUniforms.uAmbient.value.set(...th.ambient);
    sharedUniforms.uFogNear.value = map.city ? 10 : 4;
    sharedUniforms.uFogFar.value = map.city ? 75 : 36;
  }

  rebuildLevel() {
    if (!this.map) return;
    if (this.level) { this.scene.remove(this.level.group); disposeLevel(this.level); }
    this.level = buildLevel(this.map, this.tex);
    this.scene.add(this.level.group);
  }

  // ---------------- session lifecycle ----------------
  makeOut() {
    return {
      broadcast: (msg, rel) => { this.net.broadcast(msg, rel); this.stats.add('netOut'); this.onHostMsg(msg); },
      sendTo: (id, msg, rel) => { if (id === this.net.myId) this.onHostMsg(msg); else { this.net.sendTo(id, msg, rel); this.stats.add('netOut'); } },
      nameOf: (id) => this.net.nameOf(id),
    };
  }

  resetSession() {
    for (const e of this.enemies.values()) this.entityRoot.remove(e.model);
    for (const p of this.projs.values()) this.entityRoot.remove(p.mesh);
    for (const o of this.orbs.values()) this.entityRoot.remove(o.mesh);
    for (const o of this.others.values()) { this.entityRoot.remove(o.model); if (o.fModel) this.entityRoot.remove(o.fModel); for (const h of o.vrHands || []) this.entityRoot.remove(h); }
    this.clearFloorEntities();
    this.enemies.clear(); this.projs.clear(); this.orbs.clear(); this.others.clear();
    this.ups.clear(); this.hpMap = {}; this.lastSeq = 0; this.offers = [];
    this.world = null; this.sim = null; this.welcomed = false; this.runOver = null; this.titleCard = null;
    this.chat = []; this.hurtDirs = [];
    this.casino.close();
    this.resetRunState();
    if (this.viewmodel) { this.viewScene.remove(this.viewmodel); this.viewmodel = null; }
    if (this.viewHorse) { this.viewScene.remove(this.viewHorse); this.viewHorse = null; }
  }

  attachNet(net) {
    this.net = net;
    net.on('message', (from, msg) => this.onNetMsg(from, msg));
    net.on('joined', () => this.onJoined());
    net.on('peerReady', (id) => this.onPeerReady(id));
    net.on('peerLeft', (id) => this.onPeerLeft(id));
    net.on('hostChanged', (id, old) => this.onHostChanged(id, old));
    net.on('kicked', () => { this.leave(); this.ui.toast('REMOVED FROM LOBBY'); });
    net.on('invite', (p) => this.ui.showInvite(p));
  }

  startSolo() {
    this.resetSession();
    const net = new SoloNet(this.playerName);
    this.attachNet(net);
    this.enterPlay();
    this.sim = new Sim(this.makeOut());
    this.sim.ensurePlayer(net.myId);
    this.sim.startRun();
  }

  makeOnlineNet() {
    if (this.WD) {
      if (!this.wdNet) {
        this.wdNet = new WavedashNet(this.WD);
        try { this.wdNet.setMaxPayload(this.WD.getP2PMaxPayloadSize()); } catch (e) { this.wdNet.setMaxPayload(2048); }
      }
      return this.wdNet;
    }
    if (!this.localNet) this.localNet = new LocalNet(this.playerName);
    return this.localNet;
  }

  async hostCoop() {
    this.resetSession();
    const net = this.makeOnlineNet();
    this.attachNet(net);
    this.ui.screen = 'connecting'; this.ui.status = 'CREATING LOBBY...';
    try { await net.host(); } catch (e) { this.ui.screen = 'title'; this.ui.toast(String(e.message || e)); }
  }

  async joinCoop(lobbyId) {
    this.resetSession();
    const net = this.makeOnlineNet();
    this.attachNet(net);
    this.ui.screen = 'connecting'; this.ui.status = 'JOINING LOBBY...';
    try { await net.join(lobbyId); return true; } catch (e) { this.ui.screen = 'title'; this.ui.toast(String(e.message || e)); return false; }
  }

  // PLAY: multiplayer first. Drop into the busiest open lobby (friends' lobbies first), or host a new one.
  async quickPlay() {
    this.ui.screen = 'connecting'; this.ui.status = 'FINDING A LOBBY...';
    const net = this.makeOnlineNet();
    let list = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try { list = await net.list(); } catch (e) { list = []; }
      if (list.length || net.mode !== 'local') break;
      await new Promise((r) => setTimeout(r, 1300)); // tab lobbies announce themselves every second
    }
    const pick = pickLobby(list, this.friends);
    if (pick) {
      this.ui.toast(`JOINING ${pick.label} (${pick.count}/${pick.max})`);
      if (await this.joinCoop(pick.id)) return;
    }
    this.ui.toast('NO OPEN LOBBIES - STARTING ONE. OTHERS WILL DROP IN.');
    await this.hostCoop();
  }

  onJoined() {
    // The platform can report "joined" after the host's welcome already arrived, or again later
    // (reconnects). Once we're in this lobby and playing, a repeat is a no-op.
    if (this.sim || this.welcomed) return;
    if (this.net.isHost()) {
      this.enterPlay();
      this.sim = new Sim(this.makeOut());
      this.sim.ensurePlayer(this.net.myId);
      this.sim.startRun();
      this.net.setMeta('label', `${this.playerName}'S RUN`);
      this.publishMembers();
    } else {
      // the first-person view is built when the host's welcome lands (onWelcome), not before:
      // a gun with no world to stand in is the "shotgun in your head" bug
      this.lock();
      this.ui.screen = 'connecting'; this.ui.status = 'WAITING FOR HOST...';
      this.mode = 'menu';
      this.helloTimer = 0;
    }
  }

  publishMembers() {
    if (this.net && this.net.isHost() && this.net.online) this.net.setMeta('members', [this.net.myId, ...this.net.connected].join(','));
  }

  onPeerReady(id) {
    this.friends.noteRecent(id, this.net.nameOf(id));
    this.publishMembers();
    if (!this.net.isHost() && id === this.net.hostId) this.sendHello();
    this.ui.toast(`${this.net.nameOf(id)} CONNECTED`);
  }

  sendHello() { this.net.sendTo(this.net.hostId, { t: 'hello', name: this.playerName }, true); }

  onPeerLeft(id) {
    const o = this.others.get(id);
    if (o) { this.entityRoot.remove(o.model); if (o.fModel) this.entityRoot.remove(o.fModel); for (const h of o.vrHands || []) this.entityRoot.remove(h); this.others.delete(id); }
    this.ui.toast(`${this.net.nameOf(id)} LEFT`);
    if (this.sim) this.sim.removePlayer(id);
    this.publishMembers();
    delete this.hpMap[id];
  }

  onHostChanged(id, old) {
    this.lastSeq = 0;
    const gone = this.others.get(old);
    if (gone) { this.entityRoot.remove(gone.model); if (gone.fModel) this.entityRoot.remove(gone.fModel); this.others.delete(old); }
    delete this.hpMap[old];
    if (id === this.net.myId) {
      this.ui.toast('HOST LEFT - YOU ARE NOW THE HOST');
      if (this.world && this.world.map) {
        this.sim = new Sim(this.makeOut());
        this.sim.adopt({
          run: this.world.run, floor: this.world.floor, seed: this.world.seed, kills: this.world.kills,
          portalOpen: this.world.portalOpen, brk: this.world.map.broken.slice(), transit: !!this.world.transit, roofT: this.world.roofT,
          enemies: [...this.enemies.values()].map((e) => ({ id: e.id, type: e.type, x: e.tx, y: e.ty, z: e.tz, hp: e.hp, tier: e.tier, aff: e.affixes, el: e.el || 0, shirt: e.shirt })), runT: this.world.runT,
          playerIds: [this.net.myId, ...[...this.others.keys()].filter((k) => k !== old)],
          ups: Object.fromEntries(this.ups), hp: this.hpMap,
        });
        for (const p of this.projs.values()) this.entityRoot.remove(p.mesh); this.projs.clear();
        for (const o of this.orbs.values()) this.entityRoot.remove(o.mesh); this.orbs.clear();
      } else {
        this.sim = new Sim(this.makeOut());
        this.sim.ensurePlayer(this.net.myId);
        this.sim.startRun();
      }
      this.net.setMeta('label', `${this.playerName}'S RUN`);
      this.net.setMeta('floor', this.world ? this.world.floor : 1);
    } else {
      this.sim = null;
      this.ui.toast(`${this.net.nameOf(id)} IS NOW THE HOST`);
      this.sendHello();
    }
  }

  async leave() {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
    this.stats.commit();
    if (this.net) { const n = this.net; this.net = null; await n.leave(); }
    this.resetSession();
    this.mode = 'menu';
    this.ui.screen = 'title';
    this.sound.stopMusic();
    this.buildDemo();
  }

  enterPlay() {
    this.mode = 'play';
    this.ui.screen = null;
    // joining a lobby calls this twice (on join, then on the host's welcome). Never stack a second
    // first-person rig: an orphaned gun sits frozen at the camera origin and fills the whole screen.
    for (const o of [...this.viewScene.children]) this.viewScene.remove(o);
    this.viewmodel = makeViewmodel(this.colorOf(this.myId));
    this.viewScene.add(this.viewmodel);
    this.viewHorse = makeHorse();
    this.viewHorse.position.set(0, -2.6, -0.5); // measured: no vertex comes within 0.45m of the camera, even at the top of the gallop bob
    this.viewHorse.rotation.y = Math.PI;
    this.viewHorse.visible = false;
    this.viewScene.add(this.viewHorse);
    this.lock();
  }

  // ---------------- messages ----------------
  onNetMsg(from, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    this.stats.add('netIn');
    switch (msg.t) {
      case 's': case 'ev': case 'floor': case 'welcome': case 'w2s': // w2s: THE SWAP CURSE, host to one player (wishbatch2.js)
        if (from === this.net.hostId) this.onHostMsg(msg);
        break;
      case 'brk':
        if (from === this.net.hostId) this.onHostMsg(msg);
        else if (this.sim) this.sim.handle(from, msg);
        break;
      case 'hello': case 'hit': case 'parry': case 'heal': case 'curse': case 'stun': case 'sunburn': case 'doom': case 'kick': case 'fall': case 'pull':
      case 'vxr': case 'hex': case 'nuke': case 'flop': case 'clashlose': case 'pz': case 'gold': case 'swin': case 'soak': case 'sac': // sac: THE SACRIFICE SHOP (wishbatch4.js) // soak: THE SOAKER (wishbatch3.js) // swin: a cursed player's keys (wishbatch2.js) // gold: THE GOLDEN ONE / THE PEBBLE EDGE (wishbatch1.js) // pz: a rooftop wire puzzle fixed (rooftops.js)
        if (this.sim) this.sim.handle(from, msg);
        break;
      case 'vx': if (from === this.net.hostId) this.onHostMsg(msg); break;
      case 'kc': if (this.onClashMsg) this.onClashMsg(from, msg); break;
      case 'bf': { const o = this.others.get(from); if (o) { o.flip = { t: 0, fail: !!msg.f }; o.model.rotation.order = 'YXZ'; } break; }
      case 'cl':
        if (Array.isArray(msg.p) && Array.isArray(msg.v) && [...msg.p, ...msg.v, msg.r, msg.tt].every(Number.isFinite)) this.spawnCloud(msg.p[0], msg.p[1], msg.p[2], msg.v[0], msg.v[1], msg.v[2], msg.r, msg.tt, false);
        break;
      case 'p':
        this.onOtherState(from, msg);
        if (this.sim) this.sim.handle(from, msg);
        break;
      case 'up': {
        if (typeof msg.u !== 'string') break;
        const list = this.ups.get(from) || [];
        list.push(msg.u); this.ups.set(from, list);
        if (this.sim) this.sim.handle(from, msg);
        break;
      }
      case 'fx': this.onOtherFire(from, msg); break;
      case 'th': this.onOtherThrow(from, msg); break;
      case 'sl': if ([msg.x, msg.y, msg.z, msg.yw, msg.r].every(Number.isFinite)) this.slashFx(msg.x, msg.y, msg.z, msg.yw, Math.min(8, msg.r)); break;
      case 'ping':
        if ([msg.x, msg.y, msg.z].every(Number.isFinite) && typeof msg.l === 'string') this.addPing(from, msg.x, msg.y, msg.z, msg.l.slice(0, 20).toUpperCase());
        break;
      case 'brag': if (typeof msg.text === 'string') this.ui.toast(`${this.net.nameOf(from)} ${msg.text.slice(0, 40)}`); break;
      case 'chat':
        if (typeof msg.text === 'string') {
          const text = msg.text.slice(0, 80).toUpperCase();
          this.addChat(`${this.friends.isFriend(from) ? '*' : ''}${this.net.nameOf(from)}`, text, this.colorOf(from));
          this.checkW(from, text);
        }
        break;
    }
  }

  toHost(msg, reliable) {
    if (this.sim) this.sim.handle(this.myId, msg);
    else { this.net.sendTo(this.net.hostId, msg, reliable); this.stats.add('netOut'); }
  }

  onHostMsg(msg) {
    switch (msg.t) {
      case 'floor': this.onFloor(msg); break;
      case 'welcome': this.onWelcome(msg); break;
      case 's': this.onSnapshot(msg); break;
      case 'ev': this.onEvent(msg); break;
      case 'brk': this.applyBreak(msg.v | 0, msg.by === this.myId); break;
      case 'vx': this.onVoxel(msg); break;
    }
  }

  onWelcome(msg) {
    this.welcomed = true;
    if (this.mode !== 'play') this.enterPlay();
    this.onFloor({ floor: msg.floor, seed: msg.seed, run: msg.run, kills: msg.kills, portal: msg.portal, brk: msg.brk, tr: msg.tr, br: msg.br, mods: msg.mods, vx: msg.vx });
    for (const [id, list] of Object.entries(msg.ups || {})) {
      if (id === this.myId) continue; // we always know our own picks
      if (Array.isArray(list)) this.ups.set(id, list.slice());
    }
  }

  clearFloorEntities() {
    for (const m of this.pickMeshes.values()) this.entityRoot.remove(m);
    this.pickMeshes = new Map();
    if (this.horseModel) { this.entityRoot.remove(this.horseModel); this.horseModel = null; }
    for (const t of this.throws) this.entityRoot.remove(t.mesh);
    this.throws = [];
    for (const r of this.ragdolls || []) this.entityRoot.remove(r.model);
    this.ragdolls = [];
    this.fires = [];
  }

  onFloor(msg) {
    const prev = this.world;
    const sameFloor = prev && prev.run === msg.run && prev.seed === msg.seed && prev.floor === msg.floor;
    if (sameFloor) {
      for (const vi of msg.brk || []) this.applyBreak(vi, false);
      return;
    }
    const newRun = !prev || prev.run !== msg.run;
    if (newRun) {
      if (prev) this.stats.commit();
      const keepRide = false;
      this.resetRunState();
      this.riding = keepRide;
      this.ups.clear(); this.offers = []; this.runOver = null;
      this.stats.newRun();
      this.sound.stopMusic();
      this.applyMetaAtRunStart();
      this.startClassPick();
    } else if (msg.floor > prev.floor) {
      this.offers.push(this.rollOffer());
      if (msg.floor - prev.floor > 1 && this.onFloorSkip) this.onFloorSkip(prev.floor, msg.floor); // started deeper (economy.js)
      this.stats.add('floors');
      if (this.typeBuff) { this.typeBuff = null; this.ui.toast('YOUR TYPING BUFF WORE OFF'); }
    }
    const map = msg.tr ? generateCity(msg.seed, msg.floor) : msg.br ? generateArena(msg.seed, msg.floor) : generateFloor(msg.seed, msg.floor);
    for (const vi of msg.brk || []) openVault(map, vi);
    map.voxels = new Set(Array.isArray(msg.vx) ? msg.vx.filter(Number.isInteger) : []);
    const stage = msg.tr ? 'city' : msg.br ? 'boss' : 'hive';
    this.world = { run: msg.run, floor: msg.floor, seed: msg.seed, map, kills: msg.kills || 0, portalOpen: !!msg.portal || !!msg.tr, countdown: -1, bossAlive: false, transit: !!msg.tr, stage, mods: Array.isArray(msg.mods) ? msg.mods.filter((x) => typeof x === 'string') : [] };
    this.clearFloorEntities();
    this.setLevel(map);
    this.applyModVisuals(map);
    this.voxDirty = true; this.building = false; this.flip = null;
    if (this.shockFx) this.shockFx = [];
    for (const e of this.enemies.values()) this.entityRoot.remove(e.model); this.enemies.clear();
    for (const p of this.projs.values()) this.entityRoot.remove(p.mesh); this.projs.clear();
    for (const o of this.orbs.values()) this.entityRoot.remove(o.mesh); this.orbs.clear();
    this.lastSeq = 0;
    this.picked = new Set(); this.explored = new Uint8Array(W * H); // ROYAL KEYS are kept: you can hold more than one
    this.spawnPickups(map);
    if (map.horse) map.horse.diamond = (((msg.seed * 2654435761) >>> 0) % 1000) / 1000 < DIAMOND_HORSE_CHANCE;
    if (map.horse && !this.riding) {
      this.horseModel = map.horse.diamond ? makeDiamondHorse() : makeHorse();
      this.horseDiamond = !!map.horse.diamond;
      this.horseModel.position.set(map.horse.x, 0, map.horse.z);
      this.horseModel.rotation.y = -Math.PI / 2;
      this.entityRoot.add(this.horseModel);
      this.horse = { x: map.horse.x, z: map.horse.z };
    } else this.horse = null;
    // spawn spread so co-op players don't stack
    // count every connected peer, not just ones we've already seen move: a fresh joiner knows no
    // avatars yet and would otherwise take slot 0 and spawn inside the host
    const ids = [...new Set([this.myId, ...(this.net ? this.net.connected : []), ...this.others.keys(), this.net ? this.net.hostId : this.myId])].sort();
    const slot = Math.max(0, ids.indexOf(this.myId));
    const sp = spawnSlot(map, slot);
    this.mover.noclip = false;
    this.mover.ducked = false;
    this.mover.teleport(sp.x, sp.y || 0, sp.z);
    this.lastSafe = { x: sp.x, y: sp.y || 0, z: sp.z };
    this.wasSafe = undefined; // new map: no stale lounge toasts
    this.mover.dashes = moveStats(this.myUps).maxDashes + this.metaLvl('wings');
    this.yaw = Math.random() * Math.PI * 2; this.pitch = 0;
    this.dead = false; this.downPos = null;
    this.history = [];
    const ws = this.gunStats();
    this.weapon = { ammo: ws.mag, cool: 0.3, reloading: false, reloadT: 0, kick: 0, pump: 0 };
    const th = themeFor(msg.floor);
    const wn = map.city ? 'THE CITY' : WORLDS[map.world] ? WORLDS[map.world].name : '';
    const rush = isRushFloor(msg.floor);
    const modNote = this.world.mods.length ? ` - ${this.world.mods.length} CURSE${this.world.mods.length > 1 ? 'S' : ''}` : '';
    if (map.city) this.titleCard = { t: 3.5, title: 'YOU JUMPED OUT OF THE HIVE', sub: 'CROSS THE ROOFTOPS TO THE NEXT HIVE' };
    else if (map.arena) this.titleCard = { t: 3.5, title: rush ? 'BOSS RUSH' : 'THE BOSS ROOM', sub: rush ? 'FIVE BOSSES. ONE GIGA UPGRADE AT THE END.' : 'ONE BOSS GUARDS THIS HIVE' };
    else this.titleCard = { t: 3.5, title: `FLOOR ${msg.floor}`, sub: (map.realRooms && map.realRooms.length ? `${th.name} - ${map.realMode === 'hall' ? 'A HALLWAY THAT SHOULD NOT BE HERE' : map.realRooms.length > 1 ? 'SOMETHING IS WRONG WITH SOME ROOMS' : 'SOMETHING IS WRONG WITH ONE ROOM'}` : map.horse ? `${th.name} - ${wn} - A ${map.horse.diamond ? 'DIAMOND ' : ''}HORSE IS HERE` : `${th.name} - ${wn}`) + modNote };
    if (map.arena) this.sound.play('boss');
    this.buddy.event(map.arena ? 'boss' : 'floor', !!map.arena);
    this.rollHorseScare();
    this.checkUnlocks();
    this.persist();
    if (map.horse) this.sound.play('neigh', { x: map.horse.x, y: 1, z: map.horse.z });
    this.sound.play('descend');
    if (!this.sound.musicOn) this.sound.startMusic(msg.floor); else this.sound.setTheme(msg.floor);
    if (this.sim) this.net.setMeta('floor', msg.floor);
    if (msg.floor > this.bestFloor) { this.bestFloor = msg.floor; try { localStorage.setItem('crypthop.best', String(msg.floor)); } catch (e) { /* ignore */ } }
  }

  applyMetaAtRunStart() {
    for (let i = 0; i < this.metaLvl('chitin'); i++) this.applyUp('hp', true);
    this.honey = 50 * this.metaLvl('sweet');
  }

  spawnPickups(map) {
    for (const p of map.pickups) {
      let m;
      if (p.kind === 'item') { const it = ITEMS[ITEM_IDS[p.item % ITEM_IDS.length]]; m = makeItemPickup(it.color); }
      else if (p.kind === 'wafer') m = makeWafer();
      else m = makeKeyModel();
      m.position.set(p.x, p.y + (p.kind === 'item' ? 0 : 0.8), p.z);
      this.entityRoot.add(m);
      this.pickMeshes.set(p.id, m);
    }
  }

  applyBreak(vi, mine) {
    const map = this.world && this.world.map;
    if (!map) return;
    const v = map.vaults[vi];
    if (!openVault(map, vi)) return;
    this.rebuildLevel();
    if (v) {
      for (const k of v.door) {
        const x = ((k % W) + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
        this.particles.burst(x, 1.5, z, 50, v.kind === 'seal' ? [0.9, 0.3, 0.6] : [1, 0.8, 0.3], 7, 0.12, 1.2, 1, 2);
      }
      this.sound.play('break', { x: v.x, y: 1, z: v.z });
    }
    if (mine) { this.stats.add('gates'); this.addStyle(25, `${GATE_KINDS[v.kind].name} OPENED`); }
  }

  rollOffer() { return this.rollClassOffer(); } // at least one card is always for your class

  // push a boon (or an item's granted boon) through the synced path
  applyUp(u, silent) {
    const list = this.ups.get(this.myId) || [];
    list.push(u); this.ups.set(this.myId, list);
    this.net.broadcast({ t: 'up', u }, true);
    if (this.sim) this.sim.handle(this.myId, { t: 'up', u });
    if (!silent) {
      this.sound.play('upgrade');
      this.ui.toast(`${UPGRADES[u].name}: ${UPGRADES[u].desc}`);
    }
    const ws = weaponStats(list, this.honey);
    if (u === 'mag') this.weapon.ammo = Math.min(ws.mag, this.weapon.ammo + 3);
    if (u === 'dash') this.mover.dashes++;
  }

  pickUpgrade(n) {
    if (!this.offers.length) return;
    const offer = this.offers[0];
    if (offer.giga && n > 2) return; // a GIGA pick is a pick: no flipping, no rerolls
    if (offer.giga && offer[n]) { this.offers.shift(); this.applyUp(offer[n]); this.ui.banner(`GIGA: ${UPGRADES[offer[n]].name}`, 3); this.stats.add('gigas'); return; }
    if (n === 3) { // DOUBLE OR NOTHING: two random boons, or none
      this.offers.shift();
      this.stats.add('boonFlips');
      if (Math.random() < 0.5) {
        const a = offer[Math.floor(Math.random() * 3)], b = UPGRADE_IDS[Math.floor(Math.random() * UPGRADE_IDS.length)];
        this.applyUp(a, true); this.applyUp(b, true);
        this.sound.play('win');
        this.ui.banner(`DOUBLE! ${UPGRADES[a].name} + ${UPGRADES[b].name}`, 3);
        this.stats.add('boonFlipWins');
      } else { this.sound.play('lose'); this.ui.banner('NOTHING. THE HOUSE WINS.', 3); }
      return;
    }
    if (n === 4) { // REROLL for honey
      const cost = 15 + 5 * (this.world ? this.world.floor : 1);
      if (this.honey < cost) { this.sound.play('deny'); this.ui.toast(`REROLL COSTS ${cost} HONEY`); return; }
      this.spendHoney(cost, 'reroll');
      this.offers[0] = this.rollOffer();
      this.sound.play('coin');
      return;
    }
    const u = offer[n]; if (!u) return;
    this.offers.shift();
    this.applyUp(u);
  }

  // ---------------- honey (fake money) ----------------
  honeyMul() {
    return (1 + this.itemFx('honeyMul') + (this.blessed('honey') ? 0.25 : 0)) * (countUp(this.myUps, 'greed') ? 2 : 1) * this.modMul('honeyPct');
  }
  addHoney(n, why) {
    n = Math.max(0, Math.round(n));
    if (!n) return;
    this.honey += n;
    this.stats.add('honeyIn', n);
    if (why === 'won') this.stats.add('honeyWon', n);
    this.stats.max('honeyPeak', this.honey);
  }
  spendHoney(n, why) {
    n = Math.max(0, Math.min(this.honey, Math.round(n)));
    this.honey -= n;
    this.stats.add('honeyOut', n);
    if (why === 'bet') this.stats.add('wagered', n);
    return n;
  }
  addWafers(n) { this.meta.wafers += n; this.stats.add('wafers', n); this.saveMeta(); }

  // ---------------- style (BUZZ RANK) ----------------
  addStyle(pts, label) {
    pts *= (1 + this.itemFx('style') + (this.blessed('style') ? 0.5 : 0)) * this.modMul('styleGainPct');
    this.style = Math.min(STYLE_CAP, this.style + pts);
    this.styleFeed.unshift({ text: `+${label}`, t: 2 });
    if (this.styleFeed.length > 6) this.styleFeed.pop();
    const r = rankFor(this.style);
    if (r > this.rank && !this.calm) { this.sound.play('rank'); if (r >= 4) this.ui.banner(`${RANKS[r].name} - ${RANKS[r].title}`, 1.5); }
    this.rank = r;
    this.stats.max('bestRank', r);
  }

  onSnapshot(msg) {
    if (!this.world || msg.run !== this.world.run || msg.floor !== this.world.floor) return;
    if (msg.n <= this.lastSeq && this.lastSeq - msg.n < 1000) return;
    this.lastSeq = msg.n;
    const seen = new Set();
    let boss = null;
    for (const a of msg.e) {
      const [id, type, x, y, z, yaw, hp, st, tier, aff] = a;
      seen.add(id);
      let e = this.enemies.get(id);
      if (!e) {
        this.seeEnemy(ENEMY_TYPES[type]);
        const model = (ENEMY_BUILDERS[type] || ENEMY_BUILDERS[0])();
        model.position.set(x, y, z);
        const tr = TIERS[tier || 0] || TIERS[0];
        model.scale.setScalar(tr.scale);
        const affixes = String(aff || '').split('').map((c) => AFFIX_IDS[Number(c)]).filter(Boolean);
        if (tier === 2) { // champions wear their name
          const tag = makeNameTag(champName(id), tr.color); tag.position.y = (ENEMIES[ENEMY_TYPES[type]].height + 0.6) / tr.scale; model.add(tag);
        }
        this.entityRoot.add(model);
        e = { id, type, model, x, y, z, yaw, tx: x, ty: y, tz: z, tyaw: yaw, hp, st, flash: 0, speed: 0, spin: 0, tier: tier || 0, affixes, scale: tr.scale };
        this.enemies.set(id, e);
      }
      e.speed = Math.hypot(x - e.tx, z - e.tz) * 20;
      e.tx = x; e.ty = y; e.tz = z; e.tyaw = yaw; e.hp = hp; e.st = st;
      if (BOSS_TYPES.includes(type)) boss = e;
    }
    for (const [id, e] of this.enemies) {
      if (seen.has(id)) { e.goneT = 0; continue; }
      if (!e.goneT) e.goneT = this.time; // gone from the snapshot: wait a beat for its kill event
      else if (this.time - e.goneT > 0.6) { this.entityRoot.remove(e.model); this.enemies.delete(id); }
    }
    this.world.boss = boss;
    const ps = new Set();
    for (const [id, x, y, z, rf] of msg.pr) {
      ps.add(id);
      let p = this.projs.get(id);
      if (p && !!p.rf !== !!rf) { this.entityRoot.remove(p.mesh); this.projs.delete(id); p = null; }
      if (!p) {
        const mesh = makeProjectile(this.world.boss != null, !!rf);
        mesh.position.set(x, y, z);
        this.entityRoot.add(mesh);
        p = { mesh, x, y, z, vx: 0, vy: 0, vz: 0, rf: !!rf };
        this.projs.set(id, p);
      } else {
        p.vx = (x - p.x) * 20; p.vy = (y - p.y) * 20; p.vz = (z - p.z) * 20;
      }
      p.x = x; p.y = y; p.z = z;
    }
    for (const [id, p] of this.projs) if (!ps.has(id)) { this.entityRoot.remove(p.mesh); this.projs.delete(id); }
    const os = new Set();
    for (const [id, x, y, z, kind] of msg.o) {
      os.add(id);
      let o = this.orbs.get(id);
      if (!o) {
        const mesh = (this.orbMesh && this.orbMesh(kind)) || (kind === 1 ? makeHoneyDrop() : kind === 2 ? makeWafer() : kind === 5 ? makeMedkit() : kind === 6 ? makeSaber('#40c0ff', 0.9) : makeOrb());
        mesh.position.set(x, y, z); this.entityRoot.add(mesh);
        o = { mesh, x, y, z }; this.orbs.set(id, o);
      }
      o.x = x; o.y = y; o.z = z;
    }
    for (const [id, o] of this.orbs) if (!os.has(id)) { this.entityRoot.remove(o.mesh); this.orbs.delete(id); }
    this.hpMap = msg.pl;
    const mine = msg.pl[this.myId];
    if (mine) {
      const wasDead = this.dead;
      this.hp = mine[0]; this.maxHp = mine[1]; this.dead = !!mine[2];
      if (this.dead && !wasDead) this.onLocalDeath();
      if (!this.dead && wasDead && this.downPos) this.onLocalRevive(this.downPos);
    }
    this.world.countdown = msg.cd;
    this.world.portalOpen = !!msg.po;
    if (typeof msg.st === 'string') this.world.stage = msg.st;
    this.world.bossLeft = msg.bq || 0;
    this.world.roofT = Number.isFinite(msg.rt) ? msg.rt : null; this.world.roofAt = this.time; // the ROOFTOP CLOCK (economy.js)
    if (typeof msg.ls === 'string' && (msg.ls || null) !== this.lastStandId) this.lastStandId = msg.ls || null; // late joiners learn it here
    this.world.left = msg.e.filter((a) => a[1] !== FINGLER).length;
    if (msg.ro >= 0 && !this.runOver) this.runOver = { t: msg.ro };
    if (msg.ro < 0 && this.runOver && this.runOver.done) this.runOver = null;
  }

  onLocalDeath() {
    this.sound.play('die');
    this.downPos = { x: this.mover.pos.x, y: this.mover.pos.y, z: this.mover.pos.z };
    this.building = false;
    if (this.evilHorse) { this.evilHorse = false; this.ui.banner('THE HORSE SKINNED YOU ALIVE', 3); this.sound.play('neigh'); }
    {
      const body = makePlayerAvatar(this.colorOf(this.myId), '', this.hat);
      if (body.userData.tag) body.userData.tag.visible = false;
      const p = this.mover.pos;
      body.position.set(p.x, p.y, p.z); body.rotation.y = this.yaw + Math.PI;
      this.entityRoot.add(body);
      const from = this.lastHurtFrom || { x: p.x - Math.sin(this.yaw), z: p.z - Math.cos(this.yaw) };
      const rag = this.addRagdoll(body, p.x - from.x, p.z - from.z, 7);
      this.deathCam = { t: 2.6, rag, ang: this.yaw };
    }
    this.stats.add('deaths');
    if (this.riding) this.dismount();
    this.casino.close();
    this.mover.noclip = true;
    this.mover.vel.x = this.mover.vel.y = this.mover.vel.z = 0;
    this.mover.pos.y += 1.0;
    this.style = 0; this.rank = 0;
    this.spec = null; this.freeCam = false;
    const kind = ['YOU DID GREAT. THE HIVE IS PROUD OF YOU.', 'EVERY BEE FALLS SOMETIMES. YOU WILL FLY AGAIN.', 'THAT WAS BRAVE. TAKE A BREATH.',
      'YOU MATTER MORE THAN ANY FLOOR.', 'REST FOR A MOMENT. YOU EARNED IT.', 'HEY. YOU ARE DOING BETTER THAN YOU THINK.',
      'THE QUEEN IS NOT MAD. SHE IS JUST A BUG.', 'DRINK SOME WATER. THE REAL KIND.', 'BUZZBY STILL BELIEVES IN YOU.', 'IT IS OKAY. TRY AGAIN WHEN YOU ARE READY.'];
    this.deathMsg = kind[Math.floor(Math.random() * kind.length)];
    this.buddy.event('death', true);
    this.ui.toast('YOU DIED - FLY AROUND UNTIL THE NEXT FLOOR');
  }

  onEvent(m) {
    const at = (x, y, z) => ({ x, y, z });
    if (this.onFeatureEvent(m)) return;
    switch (m.k) {
      case 'evilhorse':
        if (m.id === this.myId) { this.evilHorse = true; this.ui.banner('YOU CURSED. THE HORSE HEARD YOU.', 3.5); this.sound.play('neigh'); this.sound.play('growl'); }
        else this.ui.toast(`${this.net.nameOf(m.id)} CURSED. THE HORSE IS COMING FOR THEM.`);
        break;
      case 'nuke':
        this.flashLight = 1; this.hurtFlash = 0; this.nukeFlash = 1.4;
        this.sound.play('boom'); this.sound.play('boom', at(m.x, m.y, m.z));
        this.fxBoom(m.x, m.y + 2, m.z, 45, [1, 0.95, 0.75], 1.3); this.fxBoom(m.x, m.y + 2, m.z, 28, [1, 0.55, 0.15], 0.9); this.fxSlam(m.x, m.y, m.z, 60, [1, 0.8, 0.4], 1.1);
        this.ui.banner(m.by === this.myId ? 'NUCLEAR FOOTBALL: DETONATED' : `${this.net.nameOf(m.by)} USED THE NUCLEAR FOOTBALL`, 3);
        break;
      case 'kill': {
        const e = this.enemies.get(m.id);
        const type = m.type;
        this.noteKill(type);
        // CONTAGION: a foe that dies in your cloud bursts into a new one
        if (e && e.inCloud && this.time - e.inCloud < 0.6 && this.cls === 'pestilent') {
          if (this.mod('cloudSpread')) { const c = this.spawnCloud(m.x, m.y + 1, m.z, 0, 0, 0, 2.4 * this.modMul('cloudRadiusPct'), 3, true); this.net.broadcast({ t: 'cl', p: [c.x, c.y, c.z], v: [0, 0, 0], r: c.r, tt: c.t }, true); }
          if (this.mod('cloudHeal')) this.toHost({ t: 'heal', a: this.mod('cloudHeal') }, true);
        }
        const col = BLOOD[type] || BLOOD[0];
        const big = type === 2 ? 2 : BOSS_TYPES.includes(type) ? 4 : 1;
        this.particles.burst(m.x, m.y + 1 * big, m.z, 40 * big, col, 7, 0.1, 1.4, 1, 3);
        this.particles.burst(m.x, m.y + 1 * big, m.z, 8 * big, col.map((v) => v * 0.6), 6, 0.3, 2.5, 1, 4);
        if (e) {
          // fling the body away from whoever killed it
          let fx = Math.random() - 0.5, fz = Math.random() - 0.5;
          const killer = m.by === this.myId ? this.mover.pos : m.by && this.others.get(m.by) ? this.others.get(m.by).model.position : null;
          if (killer) { fx = m.x - killer.x; fz = m.z - killer.z; }
          const power = m.src === 'kick' ? 16 : m.src === 'boom' ? 10 : BOSS_TYPES.includes(type) ? 3 : 6;
          this.addRagdoll(e.model, fx, fz, power);
          this.enemies.delete(m.id);
        } else if (ENEMY_BUILDERS[type] && [m.x, m.y, m.z].every(Number.isFinite)) {
          const body = ENEMY_BUILDERS[type]();
          body.position.set(m.x, m.y, m.z);
          this.entityRoot.add(body);
          const killer = m.by === this.myId ? this.mover.pos : null;
          this.addRagdoll(body, killer ? m.x - killer.x : Math.random() - 0.5, killer ? m.z - killer.z : Math.random() - 0.5, m.src === 'kick' ? 16 : 6);
        }
        this.sound.play('kill', at(m.x, m.y, m.z));
        if (this.world) this.world.kills++;
        if (type === FINGLER) for (let i = 0; i < 6; i++) this.particles.burst(m.x, m.y + 1, m.z, 30, [[1, 0.2, 0.2], [1, 1, 0.2], [0.2, 1, 0.3], [0.2, 0.6, 1], [0.7, 0.3, 1], [1, 0.4, 0.9]][i], 8, 0.1, 1, 0.6);
        if (m.tier === 2) { this.offers.push(this.rollOffer()); this.ui.banner('CHAMPION SLAIN! A FREE BOON FOR EVERYONE', 3); this.sound.play('jackpot'); }
        if (BOSS_TYPES.includes(type)) { this.ui.banner(type === 4 ? 'VOX POPULI: FAREWELL TOUR' : type === 3 ? 'THE WASP QUEEN FALLS' : `${ENEMY_NAMES[type]} IS DEAD`, 3); this.flashLight = 1; }
        if (ENEMY_TYPES[type] === 'evilhorse' && m.by === this.myId) { this.evilHorse = false; this.ui.banner('YOU PUT THE EVIL HORSE DOWN. WATCH YOUR MOUTH.', 3); }
        if (m.by === this.myId) this.onMyKill(m);
        break;
      }
      case 'hurt':
        if (m.id === this.myId) {
          this.hurtFlash = Math.min(1, this.hurtFlash + 0.25 + m.dmg / 60);
          if (!m.s) { this.hurtDirs.push({ ang: Math.atan2(m.x - this.mover.pos.x, m.z - this.mover.pos.z), t: 1 }); this.lastHurtFrom = { x: m.x, z: m.z }; }
          this.sound.play('hurt');
          if (!m.s && m.dmg >= 4 && this.time - (this.lastScream ?? -9) > 0.7) { this.lastScream = this.time; this.sound.play('scream'); }
          this.stats.add('dmgTaken', m.dmg);
          if (!m.s) this.buddy.event((this.hp ?? 100) - m.dmg < 35 ? 'lowhp' : 'hurt');
          this.style = Math.max(0, this.style - 40); this.rank = rankFor(this.style);
        }
        break;
      case 'pdie':
        if (m.id !== this.myId) {
          this.ui.toast(`${this.net.nameOf(m.id)} IS DOWN - STAND ON THEIR BODY TO REVIVE`);
          const o = this.others.get(m.id);
          if (o) {
            const body = makePlayerAvatar(o.color || this.colorOf(m.id), '', o.hat || 'none');
            if (body.userData.tag) body.userData.tag.visible = false;
            body.position.copy(o.model.position); body.rotation.y = o.model.rotation.y;
            this.entityRoot.add(body);
            this.addRagdoll(body, Math.random() - 0.5, Math.random() - 0.5, 5);
          }
        }
        break;
      case 'revive':
        if (m.id === this.myId) this.onLocalRevive({ x: m.x, y: m.y, z: m.z }, m.by);
        else {
          this.ui.toast(m.by === this.myId ? `YOU REVIVED ${this.net.nameOf(m.id)}` : `${this.net.nameOf(m.by)} REVIVED ${this.net.nameOf(m.id)}`);
          if (m.by === this.myId) { this.addStyle(40, 'REVIVE'); this.stats.add('revives'); this.sound.play('upgrade'); }
        }
        this.particles.burst(m.x, m.y + 1, m.z, 50, [0.5, 1, 0.6], 6, 0.1, 0.8, 0.5);
        break;
      case 'portal':
        if (this.world) this.world.portalOpen = true;
        this.ui.banner(m.st === 'hive' || (this.world && this.world.stage === 'hive') ? 'HIVE CLEARED - THE BOSS DOOR IS OPEN' : 'THE HIVE EXIT IS OPEN - JUMP OUT', 3);
        this.sound.play('portal');
        break;
      case 'enter': {
        const who = m.id === this.myId ? 'YOU' : this.net.nameOf(m.id), st = this.world && this.world.stage;
        this.ui.banner(st === 'city' ? `${who} REACHED THE NEXT HIVE` : st === 'hive' ? `${who} OPENED THE BOSS DOOR` : `${who} JUMPED OUT OF THE HIVE`, 2);
        this.sound.play('portal');
        break;
      }
      case 'atk': { const e = this.enemies.get(m.id); if (e) this.sound.play('swing', e.model.position); break; }
      case 'growl': { const e = this.enemies.get(m.id); if (e) this.sound.play('buzz', e.model.position); break; }
      case 'wake': { const e = this.enemies.get(m.id); if (e && Math.random() < 0.5) this.sound.play('buzz', e.model.position); break; }
      case 'spit': { const e = this.enemies.get(m.id); if (e) this.sound.play('spit', e.model.position); break; }
      case 'ring': case 'summon': { const e = this.enemies.get(m.id); if (e) { this.sound.play('boom', e.model.position); this.particles.burst(e.tx, e.ty + 2.5, e.tz, 50, [1, 0.8, 0.1], 10, 0.12, 0.8, 0.2); } break; }
      case 'splat':
        this.particles.burst(m.x, m.y, m.z, 10, m.r ? [1, 0.85, 0.2] : [0.7, 1, 0.2], 3, 0.08, 0.5);
        this.sound.play('splat', at(m.x, m.y, m.z));
        break;
      case 'boom':
        this.fxBoom(m.x, m.y, m.z, m.r || 3.5, [1, 0.6, 0.12], 0.34);
        this.sound.play('boom', at(m.x, m.y, m.z));
        this.flashLight = Math.max(this.flashLight, 0.8); this.flashPos = new THREE.Vector3(m.x, m.y, m.z);
        break;
      case 'orb':
        if (m.pid === this.myId) {
          if (m.kind === 1) { this.addHoney((m.v || 1) * this.honeyMul(), 'drop'); this.sound.play('coin'); }
          else if (m.kind === 2) { this.addWafers(1); this.sound.play('wafer'); this.ui.toast(`WAFER! (${this.meta.wafers} BANKED)`); }
          else if (m.kind === 3) { const d = unpackDrop(Number(m.v) || 0); this.addWeapon(rollWeapon(d.seed, (this.world && this.world.floor) || 1, this.cls, d.minRarity)); }
          else if (m.kind === 5) this.addMedkit();
          else if (m.kind === 6) this.giveSaber();
          else if (this.onWishOrb && this.onWishOrb(m.kind)) { /* a banana or a wished-for weapon (wishbatch1.js) */ }
          else { this.sound.play('orb'); this.hurtFlash = 0; this.stats.add('heals'); }
        }
        break;
      case 'slam': { // the warning: a red ring where the wave will go. JUMP.
        this.fxMark(m.x, m.y, m.z, m.r, [1, 0.15, 0.1], m.w || 0.7);
        this.sound.play('growl', at(m.x, m.y, m.z));
        if (Math.hypot(m.x - this.mover.pos.x, m.z - this.mover.pos.z) < m.r + 2 && !this.slamTipShown) { this.slamTipShown = true; this.ui.banner('GROUND SLAM! JUMP OVER THE SHOCKWAVE', 1.5); }
        break;
      }
      case 'quake': {
        this.fxSlam(m.x, m.y, m.z, m.r * 1.15, [1, 0.6, 0.25], 0.38); this.fxSlam(m.x, m.y, m.z, m.r * 0.6, [1, 0.85, 0.5], 0.25, { filled: true });
        this.sound.play('boom', at(m.x, m.y, m.z));
        if (Math.hypot(m.x - this.mover.pos.x, m.z - this.mover.pos.z) < m.r * 1.5) this.landDip = Math.max(this.landDip || 0, 0.12);
        if (Math.hypot(m.x - this.mover.pos.x, m.z - this.mover.pos.z) < m.r && !this.mover.onGround && !this.dead) this.addStyle(10, 'DODGED SLAM');
        break;
      }
      case 'pull':
        if (m.n > 2) this.ui.toast(`HONEY BOMB YANKED ${m.n}`);
        break;
      case 'parry':
        this.particles.burst(m.x, m.y, m.z, 30, [1, 1, 0.7], 8, 0.08, 0.4, 0.2);
        if (m.id === this.myId) this.onMyParry(m);
        else this.sound.play('parry', at(m.x, m.y, m.z));
        break;
      case 'ambush':
        if (m.id === this.myId) this.ui.banner(`WASP AMBUSH! ${m.n} INCOMING`, 2.5);
        break;
      case 'runover':
        this.runOver = { t: 7, floor: m.floor, kills: m.kills, score: m.score, done: true };
        this.sound.play('die');
        this.stats.commit();
        break;
    }
  }

  onMyKill(m) {
    if (m.src === 'slash' && this.mod('cleaverKillReset')) this.slashCd = 0; // BLOOD RUSH
    this.mats = (this.mats || 0) + matsForKill(ENEMY_TYPES[m.type]); // wax to build with
    if (this.lastWeapon === 'ball' && this.mod('spinRefund') && this.balls < this.spin.max) this.balls++; // BOOMERANG
    if (this.pickaxe && Math.random() < 0.15) this.mats += 2;
    this.checkUnlocks();
    const air = !this.mover.onGround;
    const sp = this.mover.horizontalSpeed() / U;
    this.killMarker = 0.25;
    this.stats.add('kills'); this.stats.add(`kills_${m.type}`);
    if (air) this.stats.add('airKills');
    // multikill chain
    this.multi = this.time - this.lastKillT < 2.5 ? this.multi + 1 : 1;
    this.lastKillT = this.time;
    let pts = 12, label = ENEMY_NAMES[m.type] || 'KILL';
    if (m.src === 'reflect') { pts += 30; label = 'RETURN TO SENDER'; }
    else if (m.src === 'parry') { pts += 25; label = 'PARRY KILL'; }
    else if (m.src === 'boom') { pts += 4; label = 'CHAIN REACTION'; }
    else if (this.lastWeapon === 'jav') { pts += 15; label = 'JAVELIN'; }
    else if (this.lastWeapon === 'ball') { pts += 15; label = 'SPIN KILL'; }
    else if (this.lastWeapon === 'active') { pts += 10; label = 'PRESIDENTIAL'; }
    else if (m.src === 'kick') { pts += 25; label = 'DROPKICK KILL'; }
    else if (m.src === 'slash') { pts += 20; label = 'CLEAVED'; }
    if (air) { pts += 12; label = 'AIR ' + label; }
    if (sp > 600) { pts += 10; label += ' AT SPEED'; }
    if (this.riding) { pts += 8; label = 'MOUNTED ' + label; }
    if (this.multi >= 2) { pts += this.multi * 6; label += ` X${this.multi}`; }
    this.addStyle(pts, label);
    this.buddy.event(this.multi >= 3 ? 'multikill' : 'kill');
    if (this.clutter) this.clutter.react(1 + Math.min(4, this.multi));
    const base = m.np ? 0 : (HONEY_FOR_KILL[m.type] ?? 3) * (m.tier === 2 ? 3 : m.tier === 1 ? 1.8 : 1);
    if (m.tier) this.addStyle(m.tier === 2 ? 60 : 20, m.tier === 2 ? 'CHAMPION SLAIN' : 'ELITE DOWN');
    this.addHoney(base * RANKS[this.rank].mult * this.honeyMul() * (1 + 0.1 * ((this.world && this.world.floor) || 1)), 'kill');
    this.activeCd = Math.max(0, this.activeCd - 0.5);
    // boon kill triggers
    if (this.mod('killHeal')) this.toHost({ t: 'heal', a: this.mod('killHeal') }, true);
    if (this.mod('killHoney')) this.addHoney(this.mod('killHoney'), 'kill');
    if (this.mod('killAmmo')) { const ws = weaponStats(this.myUps, this.honey); this.weapon.ammo = Math.min(ws.mag, this.weapon.ammo + this.mod('killAmmo')); }
    if (this.mod('killDash') && Math.random() * 100 < this.mod('killDash')) this.mover.dashes = Math.min(this.moveOpts().maxDashes, this.mover.dashes + 1);
    if (this.mod('killKnife')) this.knives = Math.min(this.maxKnives, this.knives + this.mod('killKnife'));
    if (this.mod('waferOnKillPct') && Math.random() * 100 < this.mod('waferOnKillPct')) { this.addWafers(1); this.ui.toast('WAFER THIEF: +1 WAFER'); }
    if (this.mod('killExplodePct') && Math.random() * 100 < this.mod('killExplodePct')) this.areaBlast(m.x, m.y, m.z, 3.5, 40, 'POP');
  }

  onMyParry(m) {
    this.sound.play('parry');
    if (this.cls === 'batter') { if (this.homerun <= 0) this.ui.toast('HOMERUN READY'); this.homerun = BAT.homerunTime; }
    this.hitstop = 0.09;
    this.parryCd = 0; // chain parries
    this.parryFlash = 0.25;
    this.stats.add('parries', m.n || 1);
    this.addParryCharge(m.n || 1);
    this.checkUnlocks();
    if (this.cls === 'fister') this.fisterParried();
    this.addStyle(30 * (m.n || 1), m.n > 1 ? `PARRY X${m.n}` : 'PARRY!');
    this.mover.dashes = Math.max(this.mover.dashes, moveStats(this.myUps).maxDashes + this.metaLvl('wings'));
    const ws = weaponStats(this.myUps, this.honey);
    this.weapon.ammo = Math.min(ws.mag, this.weapon.ammo + 1);
    this.addHoney(5 * this.honeyMul(), 'parry');
    this.buddy.event('parry');
    if (this.mod('parryHeal')) this.toHost({ t: 'heal', a: this.mod('parryHeal') }, true);
    if (this.mod('parryHoney')) this.addHoney(this.mod('parryHoney'), 'parry');
  }

  onOtherState(from, m) {
    if (from === this.myId) return;
    let o = this.others.get(from);
    if (typeof m.c === 'string' && /^#[0-9a-f]{6}$/i.test(m.c)) this.colors.set(from, m.c);
    const color = this.colorOf(from), hat = HAT_IDS.includes(m.h) ? m.h : 'none';
    if (o && (o.color !== color || o.hat !== hat)) { // they changed their look: rebuild their bee
      const old = o.model;
      o.model = makePlayerAvatar(color, `${this.friends.isFriend(from) ? '*' : ''}${this.net.nameOf(from)}`, hat);
      o.model.position.copy(old.position); o.model.rotation.copy(old.rotation);
      this.entityRoot.remove(old); this.entityRoot.add(o.model);
      o.color = color; o.hat = hat;
    }
    if (!o) {
      const model = makePlayerAvatar(color, `${this.friends.isFriend(from) ? '*' : ''}${this.net.nameOf(from)}`, hat);
      this.entityRoot.add(model);
      o = { model, x: m.x, y: m.y, z: m.z, tx: m.x, ty: m.y, tz: m.z, yaw: m.yw, pitch: 0, speed: 0, color, hat };
      this.others.set(from, o);
    }
    o.tx = m.x; o.ty = m.y; o.tz = m.z; o.tyaw = m.yw; o.pitch = m.pt; o.ducked = !!m.d; o.speed = m.sp || 0; o.dead = !!m.dead; o.riding = !!m.rd;
    if (Array.isArray(m.fp)) { o.fp = m.fp; o.fpT = this.time; }
    o.ak = !!m.ak;
    o.sb = !!m.sb; // their LIGHT SABER is out
    o.fl = typeof m.fl === 'string' ? m.fl.slice(0, 24) : null; // PIXEL PORRIDGE flair (checked against the list where it is drawn)
    if (Array.isArray(m.vr) && m.vr.length === 17 && m.vr.every(Number.isFinite)) { o.vr = m.vr; o.vrT = this.time; }
  }

  onOtherFire(from, m) {
    const o = this.others.get(from);
    if (!o || !Array.isArray(m.o)) return;
    if (from === this.spectating) { this.specKick = 1; if (this.viewmodel) { this.viewmodel.userData.flash.visible = true; this.flashTimer = 0.05; } }
    const [ox, oy, oz] = m.o;
    this.sound.play('shotgun', { x: ox, y: oy, z: oz });
    for (const d of m.d || []) {
      const [dx, dy, dz, t] = d;
      this.particles.tracer(ox, oy - 0.1, oz, ox + dx * t, oy + dy * t, oz + dz * t, [1, 0.8, 0.4]);
      this.particles.burst(ox + dx * t, oy + dy * t, oz + dz * t, 3, [1, 0.85, 0.5], 2, 0.06, 0.3);
    }
  }

  onOtherThrow(from, m) {
    if (!Array.isArray(m.o) || !Array.isArray(m.v)) return;
    this.spawnThrow(['ball', 'knife', 'molotov', 'bomb'].includes(m.k) ? m.k : 'jav', m.o, m.v, false, !!m.g, m.s || 0);
  }

  // ---------------- local player ----------------
  // turn the view by mouse counts (touch drags are scaled to match)
  lookBy(mx, my) {
    const k = this.settings.sens * 0.022 * (Math.PI / 180);
    this.yaw -= mx * k;
    this.pitch -= my * k;
    this.stats.turn += Math.abs(mx * k);
    const lim = (89 * Math.PI) / 180;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  // touch: the pause button (there is no pointer lock to release)
  touchPause() {
    this.locked = false; this.keys.clear(); this.mouseDown = false; this.casino.close();
    if (this.touch) this.touch.releaseAll();
  }

  // touch: one-tap chat (the W button)
  quickChat(text) {
    if (!(this.net && this.net.online)) { this.checkW(this.myId, text); this.ui.toast(text); return; }
    this.chatText = text; this.chatOpen = true; this.chatKey({ code: 'Enter', key: '' });
  }

  inputState() {
    const k = this.keys;
    const typing = this.chatOpen || this.casino.open || this.console.open || this.micro.open;
    let fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    let side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const tm = this.touch && this.touch.moveVec(); // the on-screen stick (analog)
    if (tm && !fwd && !side) { fwd = tm.f; side = tm.s; }
    const pm = this.padMove; // a controller's left stick (or a VR thumbstick)
    if (pm && !fwd && !side && (Math.abs(pm.f) > 0.01 || Math.abs(pm.s) > 0.01)) { fwd = pm.f; side = pm.s; }
    return {
      fwd: typing ? 0 : fwd, side: typing ? 0 : side,
      jump: !typing && k.has('Space'),
      jumpQueued: !typing && this.wheelJump > 0,
      jumpQueuedEdge: !typing && this.wheelJump > 0.05,
      duck: !typing && (k.has('ShiftLeft') || k.has('KeyC')), // no Ctrl: Ctrl+W closes the browser tab
      dash: !typing && (k.has('KeyQ') || k.has('Dash')),
      yaw: this.yaw, pitch: this.pitch,
    };
  }

  // the class you play: picked at the start of every run, locked until the run ends
  get cls() { return CLASSES[this.runClass] ? this.runClass : 'hornet'; }
  has(move) { return hasMove(this.cls, move); }
  setClass(id) {
    if (!CLASSES[id]) return false;
    if (this.mode === 'play' && this.classLocked) { this.ui.toast('YOUR CLASS IS LOCKED UNTIL THE RUN ENDS'); return false; }
    if (!this.classUnlocked(id)) { this.ui.toast(`LOCKED: ${CLASS_UNLOCKS[id].desc}`); return false; }
    if (this.mode === 'play' && this.ui.screen === 'class') { this.chooseClass(id); return true; }
    this.settings.lastCls = id; this.saveSettings();
    this.balls = this.spin.max; this.ballT = 0;
    this.slashCharge = null; this.bombs = this.maxBombs; this.homerun = 0;
    if (this.ui) this.ui.toast(`CLASS: ${CLASSES[id].name}`);
    return true;
  }
  get maxBombs() { return BOMB.max + Math.floor(this.mod ? this.mod('molotovs') + this.mod('bombMax') : 0) + (this.inv && this.cls === 'grenader' ? this.weaponNow.extra || 0 : 0); }

  moveOpts() {
    const ms = moveStats(this.myUps);
    const w = this.wbuff.stacks;
    return {
      autoBhop: this.settings.autoBhop,
      airAccelMul: ms.airAccelMul * this.hmPct('air', 0.2),
      speedMul: ms.speedMul * (this.cls === 'batter' ? 1.12 : 1) * (this.riding ? 1.5 * (this.diamondRide ? DIAMOND_HORSE.speed : 1) : 1) * (this.speedBoost > 0 ? 1.3 : 1) * (1 + 0.02 * w) * (this.blessed('grind') ? 1.1 : 1) * (this.encumbered ? 0.85 : 1)
        * (this.lastStandId && this.lastStandId === this.myId ? LAST_STAND.speed : 1) * this.hmPct('pSpeed', 0.4) * (this.typeBuff ? 1 + this.typeBuff.speed : 1) * (1 + 0.35 * (this.parryBar || 0)),
      maxAirJumps: ms.maxAirJumps + (this.cls === 'batter' ? 1 : 0),
      maxDashes: ms.maxDashes + this.metaLvl('wings') + (this.cls === 'cleaver' ? 1 : 0),
      dashRecharge: ms.dashRecharge * this.hmPct('dash'),
      jumpMul: (1 + this.itemFx('jump')) * (this.riding ? 1.3 : 1) * ms.jumpMul * this.hmPct('jump', 0.4),
      slideBoostMul: ms.slideBoostMul,
      maxWallJumps: ms.maxWallJumps,
    };
  }

  updateLocal(dt) {
    const map = this.world.map;
    const opts = this.moveOpts();
    this.physAcc = (this.physAcc || 0) + Math.min(dt, 0.1);
    if (this.cls === 'fister' && this.fSim && !this.riding) { this.physAcc = 0; if (this.hitstop > 0) this.hitstop -= dt; else this.fisterStep(dt, map); } // JOHN FISTER moves by his own rules
    else if (this.hitstop > 0) { this.hitstop -= dt; this.physAcc = Math.min(this.physAcc, TICK); }
    else {
      while (this.physAcc >= TICK) {
        this.physAcc -= TICK;
        const input = this.locked ? this.inputState() : { fwd: 0, side: 0, jump: false, jumpQueued: false, duck: false, dash: false, yaw: this.yaw, pitch: this.pitch };
        if (this.slamming && this.mover.vel.y < 0 && !this.mover.onGround) this.mover.vel.y = Math.min(this.mover.vel.y, -28);
        this.mover.tick(map, input, opts);
        if (this.wheelJump > 0) this.wheelJump -= TICK;
        if (this.mover.dashT > 0) { this.checkDashGates(); if (this.mod('dashDmg')) this.dashRam(); }
      }
    }
    const m = this.mover;
    for (const ev of m.events) {
      if (ev === 'land') {
        this.sound.play('land');
        if (this.mod('landShock') && m.landImpact > 0.45 && !this.inSafeZone()) this.areaBlast(m.pos.x, m.pos.y, m.pos.z, 3.5, this.mod('landShock'), 'SHOCKWAVE');
        if (this.slamming) this.slamLand();
      }
      if (ev === 'jump' || ev === 'slidejump') {
        this.sound.play(this.riding ? 'gallop' : 'jump');
        this.stats.add('jumps');
        const hs = m.horizontalSpeed() / U;
        if (m.lastHopTicks <= 1 && hs > 330) {
          this.hopStreak = (this.hopStreak || 0) + 1; this.stats.add('perfectHops'); this.stats.max('hopStreak', this.hopStreak);
          this.lastPerfectT = this.time;
          if (this.hopStreak >= 3) this.addStyle(2 + Math.min(8, this.hopStreak), `HOP X${this.hopStreak}`);
        } else this.hopStreak = 0;
        if (ev === 'slidejump') this.addStyle(6, 'SLIDE HOP');
      }
      if (ev === 'airjump') { this.sound.play('airjump'); this.particles.burst(m.pos.x, m.pos.y, m.pos.z, 12, [0.6, 0.6, 1], 3, 0.08, 0.4, 0.2); this.addStyle(3, 'WING FLAP'); }
      if (ev === 'pad') { this.sound.play('pad'); this.particles.burst(m.pos.x, m.pos.y + 0.1, m.pos.z, 20, [1, 0.85, 0.3], 4, 0.08, 0.5, 0.5, 4); }
      if (ev === 'dash') { this.ramHit = new Set(); this.sound.play('dash'); this.stats.add('dashes'); this.particles.burst(m.pos.x, m.pos.y + 0.9, m.pos.z, 16, [1, 0.85, 0.3], 3, 0.07, 0.35, 0); this.addStyle(3, 'DASH'); }
      if (ev === 'walljump') { this.sound.play('walljump'); this.stats.add('wallJumps'); this.particles.burst(m.pos.x, m.pos.y + 0.6, m.pos.z, 14, [1, 1, 0.8], 3, 0.07, 0.35, 0); this.addStyle(8, 'WALL KICK'); }
      if (ev === 'slide') { this.sound.play('slide'); this.stats.add('slides'); this.addStyle(4, 'SLIDE'); }
      if (ev === 'void') m.teleport(map.spawn.x, 0, map.spawn.z);
    }
    m.events.length = 0;
    // footsteps / hooves
    const sp = m.horizontalSpeed();
    if (m.onGround && sp > 2 && !m.noclip) {
      this.stepTimer -= dt * (sp / 6);
      if (this.stepTimer <= 0) { this.stepTimer = this.riding ? 0.3 : 0.38; this.sound.play(this.riding ? 'gallop' : 'step'); }
    }
    if (m.sliding && Math.random() < 0.5) this.particles.emit(m.pos.x, m.pos.y + 0.05, m.pos.z, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 1, 0.85, 0.5, 0.05, 0.3, 1);
    this.stats.track(this, dt);
    // the honey goo: standing in a pit means you fell; back to the last safe stone, minus a little HP
    {
      const k = Math.floor(m.pos.z / T) * W + Math.floor(m.pos.x / T);
      if (k >= 0 && k < W * H) {
        if (m.surfing) this.lastSurf = this.time;
        // A fall only counts once you actually LAND at the bottom (the goo, or the street under the rooftops).
        // Stepping over a pit's edge, or dropping past it in the air, is fine: the stone under the rest of
        // your feet still holds you, and you can still jump, dash or air-jump back out on the way down.
        const atBottom = m.onGround && !m.noclip && isPit(map.fh[k]) && isPit(m.pos.y); // standing IN the goo (or on the street), not on a stone at its edge
        const lost = !m.noclip && m.pos.y < Math.min(STREET, -3) - 25; // fell out of the world entirely
        if (atBottom || lost) {
          const s = this.lastSafe || { x: map.spawn.x, y: 0, z: map.spawn.z };
          m.teleport(s.x, s.y + 0.05, s.z);
          this.toHost({ t: 'fall' }, true);
          this.sound.play('splat'); this.particles.burst(m.pos.x, m.pos.y + 0.5, m.pos.z, 20, [1, 0.6, 0.1], 3, 0.08, 0.5);
          this.ui.toast(map.city ? 'YOU FELL OFF THE ROOF! BACK TO THE LAST ONE (-8 HP)' : 'INTO THE GOO! BACK TO THE LAST STONE (-8 HP)');
          this.stats.add('falls');
        } else if (m.onGround && !isPit(map.fh[k]) && map.type[k] !== 2) this.lastSafe = { x: m.pos.x, y: m.pos.y, z: m.pos.z };
      }
    }
    const safe = this.inSafeZone();
    if (safe !== this.wasSafe && this.world) { if (this.wasSafe !== undefined) this.ui.toast(safe ? 'HONEY LOUNGE: SAFE ZONE. NO FIGHTING.' : 'LEAVING THE LOUNGE'); this.wasSafe = safe; }
    this.updateExplored();
    this.updateHorse(dt);
    this.updatePickups();
    this.updateWeapon(dt);
    // tape recorder history: 3 seconds of where you were
    this.histT -= dt;
    if (this.histT <= 0) {
      this.histT = 0.1;
      this.history.push({ t: this.time, x: m.pos.x, y: m.pos.y, z: m.pos.z, hp: this.hp ?? 100 });
      while (this.history.length > 40) this.history.shift();
    }
  }

  updateExplored() {
    const i0 = Math.floor(this.mover.pos.x / T), j0 = Math.floor(this.mover.pos.z / T);
    for (let j = j0 - 3; j <= j0 + 3; j++) for (let i = i0 - 3; i <= i0 + 3; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      if ((i - i0) ** 2 + (j - j0) ** 2 <= 10) this.explored[j * W + i] = 1;
    }
  }

  checkDashGates() {
    const map = this.world.map, m = this.mover;
    const d = m.dashDir, r = MV.halfWidth + 0.3;
    for (const off of [-0.25, 0, 0.25]) {
      const x = m.pos.x + d.x * r - d.z * off, z = m.pos.z + d.z * r + d.x * off;
      const i = Math.floor(x / T), j = Math.floor(z / T);
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const g = gateAt(map, j * W + i);
      if (!g) continue;
      if (g.kind === 'wax' || (g.kind === 'hard' && (this.metaLvl('drill') > 0 || this.pickaxe))) {
        this.applyBreak(g.vault, true);
        this.toHost({ t: 'brk', v: g.vault }, true);
        m.dashT = 0;
        return;
      }
      if (this.time - this.gateToastT > 2) {
        this.gateToastT = this.time;
        this.sound.play('deny');
        this.ui.toast(`${GATE_KINDS[g.kind].name}: ${GATE_KINDS[g.kind].hint}`);
      }
    }
  }

  nearGate() {
    const map = this.world.map, p = this.mover.pos;
    let best = null, bd = 3.2;
    for (const g of map.gates) {
      const x = ((g.k % W) + 0.5) * T, z = (Math.floor(g.k / W) + 0.5) * T;
      const d = Math.hypot(x - p.x, z - p.z) - T / 2;
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  nearProp() {
    const map = this.world.map, p = this.mover.pos;
    let best = null, bd = 2.4;
    for (const pr of map.props || []) {
      const d = Math.hypot(pr.x - p.x, pr.z - p.z);
      if (d < bd) { bd = d; best = pr; }
    }
    return best;
  }

  interact() {
    if (!this.world) return;
    if (this.dead) { this.toggleFreeCam(); return; }
    if (this.riding) { this.dismount(); return; }
    const pr = this.nearProp();
    if (pr) { this.casino.openMachine(pr.kind); return; }
    const g = this.nearGate();
    if (g && g.kind === 'seal') {
      if (this.floorKey > 0) {
        this.floorKey--;
        if (this.floorKey > 0) this.ui.toast(`${this.floorKey} ROYAL KEY${this.floorKey > 1 ? 'S' : ''} LEFT`);
        this.applyBreak(g.vault, true);
        this.toHost({ t: 'brk', v: g.vault }, true);
      } else { this.sound.play('deny'); this.ui.toast('THE ROYAL SEAL NEEDS A ROYAL KEY'); }
    }
  }

  updateHorse(dt) {
    if (this.horseModel && !this.riding) {
      animateHorse(this.horseModel, this.time, 0);
      const h = this.horse;
      if (h && !this.dead && !(this.time < (this.horseCooldown || 0)) && Math.hypot(h.x - this.mover.pos.x, h.z - this.mover.pos.z) < 1.4 && Math.abs(this.mover.pos.y - this.horseModel.position.y) < 1.5) this.mount();
    }
    if (this.viewHorse) {
      this.viewHorse.visible = this.riding && !this.dead;
      if (this.riding) animateHorse(this.viewHorse, this.time, this.mover.onGround ? this.mover.horizontalSpeed() : 0);
    }
    if (this.riding && this.quiver < 3) { this.quiverT += dt; if (this.quiverT >= 1.2) { this.quiverT = 0; this.quiver++; } }
  }

  mount() {
    this.riding = true;
    this.diamondRide = !!this.horseDiamond; this.diamondT = 0;
    if (this.horseModel) { this.entityRoot.remove(this.horseModel); this.horseModel = null; }
    this.horse = null;
    this.quiver = 3;
    this.sound.play('neigh');
    this.stats.add('mounts');
    if (this.diamondRide) this.stats.add('diamondMounts');
    this.ui.banner(this.diamondRide ? 'YOU ARE RIDING A DIAMOND HORSE. IT IS VERY FAST.' : 'YOU ARE RIDING A HORSE. YOU HAVE A JAVELIN.', 3);
    this.addStyle(40, 'GIDDY UP');
    this.buddy.event('horse', true);
  }

  // a slot machine paid out in horse
  spawnHorseNear() {
    if (this.riding || !this.world) { this.ui.toast('YOU ALREADY HAVE A HORSE. +100 HONEY INSTEAD'); this.addHoney(100, 'won'); return; }
    if (this.horseModel) this.entityRoot.remove(this.horseModel);
    const m = this.mover;
    this.horseDiamond = Math.random() < DIAMOND_HORSE_CHANCE;
    this.horseModel = this.horseDiamond ? makeDiamondHorse() : makeHorse();
    this.horseModel.position.set(m.pos.x - Math.sin(this.yaw) * 2, m.pos.y, m.pos.z - Math.cos(this.yaw) * 2);
    this.horseModel.rotation.y = this.yaw;
    this.entityRoot.add(this.horseModel);
    this.horse = { x: this.horseModel.position.x, z: this.horseModel.position.z };
    this.sound.play('neigh', { x: this.horse.x, y: 1, z: this.horse.z });
    this.ui.banner('A HORSE APPEARS. TOUCH IT.', 3);
  }

  dismount() {
    if (!this.riding) return;
    this.riding = false;
    this.horseDiamond = this.diamondRide; this.diamondRide = false;
    this.horseModel = this.horseDiamond ? makeDiamondHorse() : makeHorse();
    this.horseModel.position.set(this.mover.pos.x + Math.cos(this.yaw) * 1.6, this.mover.pos.y, this.mover.pos.z - Math.sin(this.yaw) * 1.6);
    this.horseModel.rotation.y = this.yaw;
    this.entityRoot.add(this.horseModel);
    this.horse = { x: this.horseModel.position.x, z: this.horseModel.position.z };
    this.horseCooldown = this.time + 1.5;
    this.sound.play('neigh');
  }

  updatePickups() {
    const map = this.world.map, p = this.mover.pos;
    if (this.dead) return;
    for (const pk of map.pickups) {
      if (this.picked.has(pk.id)) continue;
      const mesh = this.pickMeshes.get(pk.id);
      if (mesh) {
        if (pk.kind === 'item') mesh.userData.relic.rotation.y = this.time * 1.5;
        else { mesh.rotation.y = this.time * 2; mesh.position.y = pk.y + 0.8 + Math.sin(this.time * 3 + pk.id) * 0.12; }
      }
      if (Math.hypot(pk.x - p.x, pk.z - p.z) > 1.3 || Math.abs(pk.y - p.y) > 1.6) continue;
      this.picked.add(pk.id);
      if (mesh) { this.entityRoot.remove(mesh); this.pickMeshes.delete(pk.id); }
      if (pk.kind === 'wafer') { this.addWafers(1); this.sound.play('wafer'); this.addStyle(5, 'WAFER'); }
      else if (pk.kind === 'key') { this.floorKey = (this.floorKey || 0) + 1; this.stats.add('keys'); this.sound.play('item'); this.ui.banner(this.floorKey > 1 ? `ROYAL KEY x${this.floorKey} - FIND A ROYAL SEAL` : 'ROYAL KEY - FIND THE ROYAL SEAL', 3); }
      else this.takeItem(ITEM_IDS[pk.item % ITEM_IDS.length]);
    }
  }

  takeItem(id) {
    const it = ITEMS[id];
    this.sound.play('item');
    this.stats.add('items');
    this.maybePorridge();
    if (it.kind === 'active') {
      if (this.active) { this.addHoney(25, 'sell'); this.ui.toast(`SOLD ${ITEMS[this.active].name} FOR 25 HONEY`); }
      this.active = id; this.activeCd = 0;
    } else {
      if (this.items.length >= this.slotsMax) { this.addHoney(50, 'sell'); this.ui.toast(`INVENTORY FULL (${this.items.length}/${this.slotsMax}): SOLD FOR 50 HONEY`); return; }
      this.items.push(id);
      for (const u of it.grants || []) this.applyUp(u, true);
    }
    this.ui.banner(`${it.name}`, 3.5);
    this.ui.toast(`${it.pres}, ${it.year}: ${it.desc}`);
    this.addStyle(20, 'RELIC');
    this.buddy.event('item');
  }

  get encumbered() { let g = 0; for (const i of this.items) g += ITEMS[i].g; if (this.active) g += ITEMS[this.active].g; return g > 1000000; }

  startReload() { this.loadShell(); } // one shell per press: mash it

  dmgMul() {
    let k = (this.dmgBoost > 0 ? 2 : 1) * (1 + 0.03 * this.wbuff.stacks);
    k *= (this.inv ? this.wDmg() : 1) * this.hmPct('pDmg', 0.2) * (this.typeBuff ? 1 + this.typeBuff.dmg : 1) * (this.pickaxe ? 1.15 : 1);
    const m = this.mover;
    if (!m.onGround) k *= 1 + this.mod('airDmgPct') / 100;
    const ups = m.horizontalSpeed() / U;
    if (ups > 320) k *= 1 + (this.mod('speedDmgPct') / 100) * ((ups - 320) / 100);
    const hpf = (this.hp ?? 100) / (this.maxHp ?? 100);
    if (hpf < 0.35) k *= 1 + this.mod('lowHpDmgPct') / 100;
    if (hpf >= 0.999) k *= 1 + this.mod('fullHpDmgPct') / 100;
    return k;
  }

  // a damaging blast around a point (POPCORN kills, COMET landings)
  areaBlast(x, y, z, r, dmg, label) {
    const ws = weaponStats(this.myUps, this.honey);
    const hits = new Map();
    for (const e of this.enemies.values()) { const p = e.model.position; if (Math.hypot(p.x - x, p.z - z) < r && Math.abs(p.y - y) < 3) { hits.set(e.id, dmg * (ws.pelletDmg / 6)); e.flash = 0.1; } }
    this.fxBoom(x, y + 0.8, z, r, [1, 0.75, 0.25], 0.3);
    this.sound.play('boom', { x, y, z });
    if (hits.size) { this.sendHits(hits, 'boon'); this.addStyle(6 + hits.size * 3, label); }
  }

  dashRam() {
    const m = this.mover;
    this.ramHit = this.ramHit || new Set();
    const hits = new Map();
    for (const e of this.enemies.values()) {
      if (this.ramHit.has(e.id)) continue;
      const p = e.model.position;
      if (Math.hypot(p.x - m.pos.x, p.z - m.pos.z) < 1.4 + ENEMIES[ENEMY_TYPES[e.type]].radius && Math.abs(p.y - m.pos.y) < 2) { this.ramHit.add(e.id); hits.set(e.id, this.mod('dashDmg') * this.dmgMul()); e.flash = 0.12; }
    }
    if (hits.size) { this.sendHits(hits, 'boon'); this.sound.play('thunk', m.pos); this.addStyle(8, 'RAM'); }
  }

  updateWeapon(dt) {
    const w = this.weapon;
    const ws = weaponStats(this.myUps, this.honey);
    w.cool = Math.max(0, w.cool - dt);
    w.kick = Math.max(0, w.kick - dt * 5);
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.parryAnim = Math.max(0, this.parryAnim - dt);
    this.parryFlash = Math.max(0, (this.parryFlash || 0) - dt);
    this.activeCd = Math.max(0, this.activeCd - dt);
    this.speedBoost = Math.max(0, this.speedBoost - dt);
    this.infAmmo = Math.max(0, this.infAmmo - dt);
    this.dmgBoost = Math.max(0, this.dmgBoost - dt);
    { const sp = this.spin; if (this.balls < sp.max) { this.ballT += dt; if (this.ballT >= sp.recharge) { this.ballT = 0; this.balls++; } } }
    if (w.pump > 0) {
      const before = w.pump; w.pump = Math.max(0, w.pump - dt);
      if (before > 0.35 && w.pump <= 0.35) this.sound.play('pump');
    }
    if (this.dead || this.mode !== 'play') return;
    let wantFire = this.mouseDown && this.locked && !this.chatOpen && !this.casino.open && !this.console.open && !this.micro.open;
    if (wantFire && this.inSafeZone()) { wantFire = false; this.safeZoneNag(); }
    if (this.building) { if (wantFire) this.placeVoxel(); return; } // build mode: the trigger places wax
    if (this.riding) {
      if (wantFire && w.cool <= 0 && this.quiver > 0) this.throwJavelin();
      return;
    }
    if (this.sidearm && this.cls !== 'fister' && this.updateSidearm) { this.updateSidearm(dt, wantFire); if (this.cls !== 'hornet') this.updateClass(dt, false); return; } // a wished-for sidearm (wishbatch1.js)
    if (this.saberOut && this.hasSaber && this.cls !== 'fister') { this.updateSaber(dt, wantFire); if (this.cls !== 'hornet') this.updateClass(dt, false); return; } // the LIGHT SABER replaces the trigger
    if (this.cls !== 'hornet') { this.updateClass(dt, wantFire); return; }
    // no automatic reload: every press of R loads one shell (see loadShell)
    w.reloadPulse = Math.max(0, (w.reloadPulse || 0) - dt);
    const gs = this.gunStats();
    if (w.ammo > gs.mag) w.ammo = gs.mag;
    if (wantFire && w.cool <= 0) {
      if (w.ammo > 0) this.fire(gs);
      else { this.sound.play('empty'); w.cool = 0.25; w.emptyNag = 1.2; }
    }
    w.emptyNag = Math.max(0, (w.emptyNag || 0) - dt);
  }

  eyePos(alpha = 1) {
    if (this.xr && this.xr.session && this.xr.muzzlePos && this.mode === 'play') return this.xr.muzzlePos.clone(); // VR: shots, throws and stings leave the hand
    const m = this.mover;
    return new THREE.Vector3(
      m.prev.x + (m.pos.x - m.prev.x) * alpha,
      m.prev.y + (m.pos.y - m.prev.y) * alpha + m.prevEye + (m.eye - m.prevEye) * alpha + (this.riding ? 0.6 : 0),
      m.prev.z + (m.pos.z - m.prev.z) * alpha,
    );
  }

  aim() {
    if (this.xr && this.xr.aimDir) { // VR: you aim with your right hand
      const fwd = this.xr.aimDir.clone();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      if (right.lengthSq() < 1e-6) right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      return { fwd, right, up: new THREE.Vector3().crossVectors(right, fwd) };
    }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwd = new THREE.Vector3(-sy * cp, sp, -cy * cp);
    const right = new THREE.Vector3(cy, 0, -sy);
    const up = new THREE.Vector3().crossVectors(right, fwd);
    return { fwd, right, up };
  }

  enemyHitAt(o, d, maxT) {
    let bestT = maxT, bestE = null, bestMul = 1;
    for (const e of this.enemies.values()) {
      if (e.goneT) continue;
      const def = ENEMIES[ENEMY_TYPES[e.type]];
      const ex = e.model.position.x, ey = e.model.position.y, ez = e.model.position.z;
      const rx = ex - o.x, rz = ez - o.z;
      if (rx * d.x + rz * d.z < -3) continue;
      let eT = Infinity, eMul = 1;
      const sc = e.scale || 1;
      for (const [hy, hr, mul] of def.hit) {
        const t = raySphere(o, d, ex, ey + hy * sc + (def.hover && e.type === 1 ? Math.sin(this.time * 2.5) * 0.15 : 0), ez, hr * sc);
        if (t === null) continue;
        if (mul > eMul || (mul === eMul && t < eT)) { eT = t; eMul = mul; }
      }
      if (eT < bestT) { bestT = eT; bestE = e; bestMul = eMul; }
    }
    return { t: bestT, e: bestE, mul: bestMul };
  }

  sendHits(hits, weapon) {
    if (!hits.size) return;
    for (const id of hits.keys()) { const e = this.enemies.get(id); if (e && e.type === FINGLER) this.disturbFingler(e); }
    let total = 0;
    for (const v of hits.values()) total += v;
    this.stats.add('dmgDealt', total);
    this.lastWeapon = weapon;
    this.toHost({ t: 'hit', h: [...hits].map(([id, dmg]) => [id, Math.round(dmg * 10) / 10]) }, true);
  }

  fire(ws) {
    const w = this.weapon;
    const shellMul = (w.ammo >= ws.mag ? 1 + this.mod('firstShotPct') / 100 : 1) * (w.ammo === 1 ? 1 + this.mod('lastShellPct') / 100 : 1);
    if (this.infAmmo <= 0) w.ammo--;
    w.cool = ws.fireDelay; w.kick = 1; w.pump = Math.min(0.6, ws.fireDelay * 0.85);
    this.sound.play('shotgun');
    this.flashLight = 1; this.flashPos = null;
    if (this.viewmodel) this.viewmodel.userData.flash.visible = true;
    this.flashTimer = 0.05;
    this.stats.add('shots'); this.stats.add('pellets', ws.pellets);
    const o = this.eyePos();
    const { fwd, right, up } = this.aim();
    const crit = Math.random() < ws.critChance;
    if (crit) this.stats.add('crits');
    const dmgMul = (crit ? ws.critMult : 1) * this.dmgMul() * shellMul;
    const hits = new Map();
    const fxDirs = [];
    let headshot = false, pHits = 0;
    const vox = this.world.map.voxels;
    for (let n = 0; n < ws.pellets; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * ws.spread;
      const d = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const wall = raycastLevel(this.world.map, o.x, o.y, o.z, d.x, d.y, d.z, 60);
      if (vox && vox.size) for (let t = 0.3; t < wall.t; t += 0.25) if (hasVoxel(vox, o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) { wall.t = t; wall.miss = false; wall.nx = -d.x; wall.ny = -d.y; wall.nz = -d.z; break; } // wax blocks stop pellets
      const h = this.enemyHitAt(o, d, wall.t);
      const bestT = h.t;
      const hx = o.x + d.x * bestT, hy = o.y + d.y * bestT, hz = o.z + d.z * bestT;
      if (n < 4) fxDirs.push([r2(d.x), r2(d.y), r2(d.z), r2(bestT)]);
      this.particles.tracer(o.x, o.y - 0.12, o.z, hx, hy, hz, [1, 0.85, 0.45]);
      if (h.e) {
        pHits++;
        const slug = n === 0 && this.mod('hFirstPellet') ? 1 + this.mod('hFirstPellet') : 1; // SLUG THROWER
        const close = h.t < 4 ? 1 + this.mod('hPointBlank') / 100 : 1; // POINT BLANK
        hits.set(h.e.id, (hits.get(h.e.id) || 0) + ws.pelletDmg * (h.mul > 1 ? h.mul * ws.headMul : h.mul) * dmgMul * slug * close);
        if (h.mul > 1) headshot = true;
        h.e.flash = 0.08;
        this.particles.burst(hx, hy, hz, 5, BLOOD[h.e.type], 3, 0.07, 0.5);
      } else if (!wall.miss) {
        this.particles.burst(hx + wall.nx * 0.05, hy + wall.ny * 0.05, hz + wall.nz * 0.05, 4, [1, 0.85, 0.5], 2.5, 0.05, 0.25, 0.5);
      }
    }
    this.stats.add('pelletHits', pHits);
    if (headshot) this.stats.add('headshots');
    if (headshot && this.mod('hHeadRefund')) w.ammo = Math.min(ws.mag, w.ammo + 1); // TRACER ROUNDS
    if (hits.size) {
      this.sendHits(hits, 'gun');
      this.hitMarker = 0.15;
      this.sound.play(headshot || crit ? 'headshot' : 'hit');
    }
    this.net.broadcast({ t: 'fx', o: [r2(o.x), r2(o.y), r2(o.z)], d: fxDirs }, true);
    const push = (this.mover.onGround ? 0.6 : 2.4) * ws.knock;
    this.mover.vel.x -= fwd.x * push; this.mover.vel.z -= fwd.z * push;
    if (!this.mover.onGround) this.mover.vel.y -= fwd.y * push * 1.1;
  }

  // ---------------- parry + sting ----------------
  inSafeZone() { return !!(this.world && inLounge(this.world.map, this.mover.pos.x, this.mover.pos.z)); }
  safeZoneNag() {
    if (this.time - (this.safeNagT || -9) < 1.5) return;
    this.safeNagT = this.time;
    this.sound.play('deny');
    this.ui.toast('NO FIGHTING IN THE HONEY LOUNGE');
  }

  parry() {
    if (this.building && !this.dead && this.mode === 'play') { this.breakVoxel(); return; } // build mode: right click breaks wax
    if (this.dead || this.parryCd > 0 || this.mode !== 'play' || this.casino.open || this.chatOpen) return;
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    this.parryCd = 0.55 * (this.cls === 'batter' ? 0.6 : 1) * Math.max(0.4, 1 - 0.2 * this.metaLvl('quick')) / this.modMul('parryCdPct', 0.3) * this.hmPct('parryCd');
    this.parryAnim = 0.25;
    this.sound.play('sting');
    this.stats.add('parryTries');
    const o = this.eyePos();
    const { fwd } = this.aim();
    const m = this.mover;
    this.toHost({ t: 'parry', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), dx: r2(fwd.x), dy: r2(fwd.y), dz: r2(fwd.z), m: 1 + this.itemFx('parryDmg') }, true);
    // the sting itself: a short melee stab
    const ws = weaponStats(this.myUps, this.honey);
    const dmg = 20 * (ws.pelletDmg / 6) * (1 + this.itemFx('sting')) * this.dmgMul();
    const hits = new Map();
    for (const e of this.enemies.values()) {
      const p = e.model.position;
      const dx = p.x - o.x, dy = p.y + 1 - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz) || 1;
      const reach = 2.4 + ENEMIES[ENEMY_TYPES[e.type]].radius;
      if (d < reach && (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d > 0.5) { hits.set(e.id, dmg); e.flash = 0.1; this.particles.burst(p.x, p.y + 1, p.z, 8, BLOOD[e.type], 3, 0.07, 0.4); }
    }
    if (hits.size) { this.sendHits(hits, 'sting'); this.hitMarker = 0.15; this.sound.play('hit'); }
  }

  // ---------------- thrown things: javelins (riding) and spin balls ----------------
  throwJavelin() {
    this.quiver--; this.weapon.cool = 0.45;
    const o = this.eyePos(), { fwd } = this.aim();
    const v = [fwd.x * 34 + this.mover.vel.x * 0.5, fwd.y * 34 + 2, fwd.z * 34 + this.mover.vel.z * 0.5];
    this.spawnThrow('jav', [o.x, o.y - 0.1, o.z], v, true, false, 0);
    this.net.broadcast({ t: 'th', k: 'jav', o: [r2(o.x), r2(o.y - 0.1), r2(o.z)], v: v.map(r2) }, true);
    this.sound.play('javelin');
    this.stats.add('javelins');
  }

  throwBall() {
    if (!this.has('spin')) { this.kitNag('G SPIN BALLS', 'spinner'); return; }
    if (this.dead || this.balls <= 0 || this.casino.open) return;
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    this.balls--;
    const o = this.eyePos(), { fwd } = this.aim();
    // curve follows how you are turning; a perfect hop or a gallop makes it a GOLDEN SPIRAL
    const spin = Math.max(-3, Math.min(3, (this.yawRate || 0) * 0.6));
    const sp = this.spin;
    const golden = (this.lastPerfectT !== undefined && this.time - this.lastPerfectT < sp.goldWindow) || (this.riding && this.mover.horizontalSpeed() > 9);
    const v = [fwd.x * 26, fwd.y * 26 + 1, fwd.z * 26];
    this.spawnThrow('ball', [o.x, o.y - 0.15, o.z], v, true, golden, spin);
    this.net.broadcast({ t: 'th', k: 'ball', o: [r2(o.x), r2(o.y - 0.15), r2(o.z)], v: v.map(r2), g: golden ? 1 : 0, s: r2(spin) }, true);
    this.sound.play(golden ? 'win' : 'dash');
    this.stats.add('balls');
    if (golden) { this.stats.add('goldenSpirals'); this.ui.toast('GOLDEN SPIRAL!'); }
  }

  spawnThrow(kind, o, v, mine, golden, spin) {
    const mesh = kind === 'jav' ? makeJavelin() : kind === 'knife' ? makeKnife() : kind === 'molotov' ? makeMolotov() : kind === 'bomb' ? makeBomb() : makeSpinBall(golden);
    mesh.position.set(o[0], o[1], o[2]);
    this.entityRoot.add(mesh);
    this.throws.push({ kind, mesh, x: o[0], y: o[1], z: o[2], vx: v[0], vy: v[1], vz: v[2], mine, golden, spin, life: kind === 'jav' || kind === 'knife' ? 3 : 4, stuck: 0, bounces: 0, hit: new Set() });
  }

  updateThrows(dt) {
    const map = this.world && this.world.map;
    if (!map) return;
    for (const t of this.throws) {
      if (t.stuck > 0) {
        t.stuck -= dt; if (t.stuck <= 0) t.life = 0;
        // walk over your stuck knives to pick them back up
        if (t.kind === 'knife' && t.mine && Math.hypot(t.x - this.mover.pos.x, t.z - this.mover.pos.z) < 1.4 && Math.abs(t.y - this.mover.pos.y - 0.8) < 1.6) { t.life = 0; t.stuck = 0; this.knives = Math.min(this.maxKnives, this.knives + 1); this.sound.play('shell'); }
        continue;
      }
      t.life -= dt;
      const steps = 4;
      for (let s = 0; s < steps && t.life > 0; s++) {
        const h = dt / steps;
        if (t.kind === 'ball' && t.spin) { // curve
          const c = Math.cos(t.spin * h), sn = Math.sin(t.spin * h);
          const nx = t.vx * c + t.vz * sn, nz = -t.vx * sn + t.vz * c; t.vx = nx; t.vz = nz;
        }
        t.vy -= (t.kind === 'jav' ? 9 : t.kind === 'knife' ? 6 : t.kind === 'molotov' ? 12 : t.kind === 'bomb' ? 14 : 4) * h;
        const sp = Math.hypot(t.vx, t.vy, t.vz) || 1;
        const d = { x: t.vx / sp, y: t.vy / sp, z: t.vz / sp };
        const len = sp * h;
        const wall = raycastLevel(map, t.x, t.y, t.z, d.x, d.y, d.z, len);
        if (t.mine) {
          const e = this.enemyHitAt({ x: t.x, y: t.y, z: t.z }, d, Math.min(len, wall.t) + 0.3);
          if (e.e && t.kind === 'molotov') { t.x += d.x * e.t; t.y += d.y * e.t; t.z += d.z * e.t; this.burst(t); t.life = 0; break; }
          if (e.e && t.kind === 'bomb') { t.x += d.x * e.t; t.y += d.y * e.t; t.z += d.z * e.t; this.bombLand(t); t.life = 0; break; }
          if (e.e && !t.hit.has(e.e.id)) {
            t.hit.add(e.e.id);
            const ws = weaponStats(this.myUps, this.honey);
            const sp = this.spin;
            const base = t.kind === 'jav' ? 150 * this.modMul('javDmgPct') * (this.diamondRide ? DIAMOND_HORSE.jav : 1) : t.kind === 'knife' ? 40 * this.modMul('knifeDmgPct') : sp.dmg;
            // knives in the back: the target faces the same way the knife flies
            const ey = e.e.model.rotation.y, back = t.kind === 'knife' && (Math.sin(ey) * d.x + Math.cos(ey) * d.z) > 0.45;
            if (back) { this.ui.toast('BACKSTAB!'); this.addStyle(15, 'BACKSTAB'); }
            const dmg = base * (ws.pelletDmg / 6) * (t.golden ? sp.goldMul : 1) * (back ? 3 : 1) * this.dmgMul() * e.mul;
            this.sendHits(new Map([[e.e.id, dmg]]), t.kind === 'jav' ? 'jav' : t.kind === 'knife' ? 'knife' : 'ball');
            if (t.kind === 'ball') this.toHost({ t: 'stun', ids: [e.e.id], d: sp.stun }, true);
            if (t.kind === 'ball' && this.cls === 'spinner' && this.balls < sp.max) { this.ballT += sp.recharge * SPINNER.refund; if (this.ballT >= sp.recharge) { this.ballT = 0; this.balls++; } }
            e.e.flash = 0.12; e.e.spin = t.kind === 'ball' ? 1.2 : 0;
            this.hitMarker = 0.15; this.sound.play('thunk', t.mesh.position);
            this.particles.burst(t.x, t.y, t.z, 14, t.golden ? [1, 0.85, 0.2] : BLOOD[e.e.type], 4, 0.08, 0.5);
            this.stats.add(t.kind === 'jav' ? 'javHits' : t.kind === 'knife' ? 'knifeHits' : 'ballHits');
            const pierce = t.kind === 'jav' ? 3 : t.golden ? 5 : 1;
            if (t.hit.size >= pierce) { t.life = 0; break; }
          }
        }
        if (!wall.miss && wall.t < len) {
          t.x += d.x * wall.t; t.y += d.y * wall.t; t.z += d.z * wall.t;
          if (t.kind === 'jav') { t.stuck = 3; this.sound.play('thunk', { x: t.x, y: t.y, z: t.z }); break; }
          if (t.kind === 'knife') { t.stuck = 8; this.sound.play('thunk', { x: t.x, y: t.y, z: t.z }); break; }
          if (t.kind === 'molotov') { this.burst(t); t.life = 0; break; }
          if (t.kind === 'bomb') { t.x += wall.nx * 0.1; t.y += wall.ny * 0.1; t.z += wall.nz * 0.1; this.bombLand(t); t.life = 0; break; }
          // balls ricochet
          if (++t.bounces > this.spin.bounces) { t.life = 0; break; }
          // SPLIT SPIN: the first bounce of your own ball spawns a twin, angled away
          if (t.kind === 'ball' && t.mine && t.bounces === 1 && !t.twin && this.spin.split) {
            const c = Math.cos(0.5), sn = Math.sin(0.5);
            this.spawnThrow('ball', [t.x, t.y, t.z], [t.vx * c + t.vz * sn, t.vy, -t.vx * sn + t.vz * c], true, t.golden, -t.spin);
            const tw = this.throws[this.throws.length - 1]; tw.twin = true; tw.bounces = 1; t.twin = true;
          }
          const n = { x: wall.nx, y: wall.ny, z: wall.nz };
          const dot = t.vx * n.x + t.vy * n.y + t.vz * n.z;
          t.vx -= 2 * dot * n.x; t.vy -= 2 * dot * n.y; t.vz -= 2 * dot * n.z;
          t.vx *= 0.85; t.vy *= 0.85; t.vz *= 0.85;
          t.x += n.x * 0.05; t.y += n.y * 0.05; t.z += n.z * 0.05;
          this.particles.burst(t.x, t.y, t.z, 6, [1, 0.9, 0.6], 2, 0.05, 0.25);
        } else { t.x += t.vx * h; t.y += t.vy * h; t.z += t.vz * h; }
      }
      t.mesh.position.set(t.x, t.y, t.z);
      if ((t.kind === 'jav' || t.kind === 'knife') && !t.stuck) t.mesh.lookAt(t.x - t.vx, t.y - t.vy, t.z - t.vz);
      if (t.kind === 'molotov') { t.mesh.rotation.x += dt * 12; if (Math.random() < 0.6) this.particles.emit(t.x, t.y + 0.2, t.z, 0, 0.5, 0, 1, 0.5, 0.1, 0.06, 0.3, -0.3); }
      if (t.kind === 'ball') { t.mesh.rotation.y += dt * 25; t.mesh.rotation.x += dt * 9; if (t.golden && Math.random() < 0.7) this.particles.emit(t.x, t.y, t.z, 0, 0, 0, 1, 0.85, 0.2, 0.06, 0.35, 0); }
    }
    for (const t of this.throws) if (t.life <= 0) this.entityRoot.remove(t.mesh);
    this.throws = this.throws.filter((t) => t.life > 0);
  }

  // ---------------- throwing knives (K) and molotovs (H) ----------------
  throwKnife() {
    if (!this.has('knife')) { this.kitNag('K KNIVES', 'hornet'); return; }
    if (this.dead || this.knives <= 0 || this.casino.open || this.micro.open || this.mode !== 'play') return;
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    this.knives--;
    const o = this.eyePos(), { fwd } = this.aim();
    for (const off of this.mod('hKnifeFan') ? [-0.12, 0, 0.12] : [0]) { // KNIFE FAN: three at once
      const c = Math.cos(off), s = Math.sin(off);
      const fx = fwd.x * c + fwd.z * s, fz = -fwd.x * s + fwd.z * c;
      const v = [fx * 42, fwd.y * 42 + 0.5, fz * 42];
      this.spawnThrow('knife', [o.x, o.y - 0.1, o.z], v, true, false, 0);
      this.net.broadcast({ t: 'th', k: 'knife', o: [r2(o.x), r2(o.y - 0.1), r2(o.z)], v: v.map(r2) }, true);
    }
    this.sound.play('knife');
    this.stats.add('knives');
  }

  throwMolotov() {
    if (!this.has('molotov')) { this.kitNag('H MOLOTOVS', 'grenader'); return; }
    if (this.dead || this.molotovs <= 0 || this.casino.open || this.micro.open || this.mode !== 'play') return;
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    this.molotovs--;
    const o = this.eyePos(), { fwd } = this.aim();
    const v = [fwd.x * 17, fwd.y * 17 + 4, fwd.z * 17];
    this.spawnThrow('molotov', [o.x, o.y - 0.2, o.z], v, true, false, 0);
    this.net.broadcast({ t: 'th', k: 'molotov', o: [r2(o.x), r2(o.y - 0.2), r2(o.z)], v: v.map(r2) }, true);
    this.sound.play('javelin');
    this.stats.add('molotovs');
  }

  // a molotov breaks: a 3m patch of fire for 5 seconds. Only the thrower's client deals the damage.
  burst(t) {
    const map = this.world.map;
    const k = Math.floor(t.z / T) * W + Math.floor(t.x / T);
    const floorY = k >= 0 && k < W * H ? Math.max(map.fh[k], isPit(map.fh[k]) ? map.fh[k] : -99) : 0;
    this.fires.push({ x: t.x, y: Math.max(floorY, Math.min(t.y, floorY + 0.3)), z: t.z, t: 5, mine: t.mine, tick: 0, r: t.mine ? this.modMul('fireRadiusPct') : 1 });
    this.sound.play('fire', { x: t.x, y: t.y, z: t.z });
    this.fxBoom(t.x, t.y, t.z, 2.4, [1, 0.45, 0.08], 0.3);
  }

  updateFires(dt) {
    for (const f of this.fires) {
      f.t -= dt;
      for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3 * (f.r || 1); this.particles.emit(f.x + Math.cos(a) * r, f.y + 0.1, f.z + Math.sin(a) * r, 0, 1.5 + Math.random() * 2, 0, 1, 0.35 + Math.random() * 0.4, 0.05, 0.09, 0.5, -0.4); }
      if (Math.random() < 0.15) this.flashLight = Math.max(this.flashLight, 0.3);
      if (!f.mine) continue;
      f.tick -= dt;
      if (f.tick > 0) continue;
      f.tick = 0.5;
      const ws = weaponStats(this.myUps, this.honey);
      const hits = new Map();
      for (const e of this.enemies.values()) {
        const p = e.model.position;
        if (Math.hypot(p.x - f.x, p.z - f.z) < 3.2 * (f.r || 1) && Math.abs(p.y - f.y) < 2.5) { hits.set(e.id, 14 * (ws.pelletDmg / 6) * this.dmgMul() * this.modMul('fireDmgPct')); e.flash = 0.06; }
      }
      this.sendHits(hits, 'fire');
    }
    this.fires = this.fires.filter((f) => f.t > 0);
    // regenerate a knife every 1.5s and a molotov every 15s
    if (this.knives < this.maxKnives) { this.knifeT += dt; if (this.knifeT >= 1.5 / this.modMul('knifeRegenPct', 0.3)) { this.knifeT = 0; this.knives++; } }
    if (this.molotovs < this.maxMolotovs) { this.molotovT += dt; if (this.molotovT >= 15) { this.molotovT = 0; this.molotovs++; } }
  }

  // ---------------- presidential actives (F) ----------------
  useActive() {
    if (!this.active || this.dead || this.activeCd > 0 || this.casino.open) { if (this.active && this.activeCd > 0) this.sound.play('deny'); return; }
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    const id = this.active, it = ITEMS[id];
    this.activeCd = it.cd / this.modMul('activeCdPct', 0.3);
    this.stats.add('actives');
    this.sound.play('active');
    this.lastWeapon = 'active';
    const o = this.eyePos(), { fwd } = this.aim(), m = this.mover;
    const ws = weaponStats(this.myUps, this.honey);
    const scale = (ws.pelletDmg / 6) * this.dmgMul();
    const area = (r, dmg, cone) => {
      const hits = new Map();
      for (const e of this.enemies.values()) {
        const p = e.model.position;
        const dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d > r || Math.abs(p.y - m.pos.y) > 3) continue;
        if (cone && (dx * fwd.x + dz * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1) < 0.55) continue;
        hits.set(e.id, dmg * scale); e.flash = 0.15;
      }
      this.sendHits(hits, 'active');
      return hits.size;
    };
    switch (id) {
      case 'hatchet':
        area(4.5, 85, false);
        for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; this.particles.emit(m.pos.x + Math.cos(a) * 2, m.pos.y + 1, m.pos.z + Math.sin(a) * 2, Math.cos(a) * 6, 1, Math.sin(a) * 6, 1, 0.3, 0.3, 0.1, 0.4, 0); }
        break;
      case 'bigstick':
        area(8, 110, true);
        this.fxSlam(this.mover.pos.x + fwd.x * 3, this.mover.pos.y, this.mover.pos.z + fwd.z * 3, 8, [0.9, 0.6, 0.3], 0.35);
        break;
      case 'tapes': {
        const past = this.history.find((h) => this.time - h.t <= 3.05) || this.history[0];
        if (past) {
          for (let k = 0; k < 30; k++) this.particles.emit(m.pos.x, m.pos.y + Math.random() * 2, m.pos.z, 0, 1, 0, 0.7, 0.7, 0.9, 0.06, 0.6, 0);
          m.teleport(past.x, past.y, past.z);
          if (past.hp > (this.hp ?? 0)) this.toHost({ t: 'heal', a: past.hp - this.hp }, true);
          this.sound.play('rewind');
        }
        break;
      }
      case 'bathtub':
        this.slamming = true;
        if (m.onGround) { m.vel.y = 7; m.onGround = false; }
        break;
      case 'jellybeans': {
        const roll = Math.floor(Math.random() * 7);
        const fx = [
          () => { this.toHost({ t: 'heal', a: 40 }, true); return 'CHERRY: +40 HP'; },
          () => { this.infAmmo = 6; return 'LICORICE: INFINITE AMMO'; },
          () => { this.addHoney(50, 'won'); return 'BUTTERED POPCORN: +50 HONEY'; },
          () => { m.dashes += 3; return 'BLUEBERRY: +3 DASHES'; },
          () => { this.dmgBoost = 6; return 'COCONUT: 2X DAMAGE'; },
          () => { this.toHost({ t: 'curse', n: 3 }, true); return 'BLACK PEPPER: WASPS!'; },
          () => { this.speedBoost = 6; return 'JALAPENO: SPEED UP'; },
        ];
        this.ui.banner(`JELLY BEAN - ${fx[roll]()}`, 2.5);
        break;
      }
      case 'macaroni': { const a = Math.round(0.35 * (this.maxHp || 100)); this.toHost({ t: 'heal', a }, true); this.ui.toast(`+${a} HP (MACARONI)`); break; }
      case 'peanuts':
        this.weapon.ammo = ws.mag; this.weapon.reloading = false;
        m.dashes = Math.max(m.dashes, this.moveOpts().maxDashes); this.speedBoost = 5;
        break;
      case 'football': // THE NUCLEAR FOOTBALL: a siren, then the floor goes white
        this.ui.banner('NUCLEAR LAUNCH DETECTED', 3);
        this.nukeT = 3;
        for (let k = 0; k < 6; k++) setTimeout(() => this.sound.play('deny'), k * 450);
        break;
      case 'radio': {
        const ids = [];
        for (const e of this.enemies.values()) if (Math.hypot(e.model.position.x - m.pos.x, e.model.position.z - m.pos.z) < 14) ids.push(e.id);
        this.toHost({ t: 'stun', ids, d: 3 }, true);
        this.ui.toast(`FIRESIDE CHAT: ${ids.length} FOES STUNNED`);
        break;
      }
    }
  }

  slamLand() {
    this.slamming = false;
    const m = this.mover;
    const ws = weaponStats(this.myUps, this.honey);
    const hits = new Map();
    for (const e of this.enemies.values()) {
      const d = Math.hypot(e.model.position.x - m.pos.x, e.model.position.z - m.pos.z);
      if (d < 6) hits.set(e.id, 90 * (ws.pelletDmg / 6) * this.dmgMul() * (1 - d / 12));
    }
    this.sendHits(hits, 'active');
    this.fxSlam(m.pos.x, m.pos.y, m.pos.z, 7, [0.85, 0.9, 1], 0.4);
    this.sound.play('boom');
    this.landDip = 0.4;
    if (hits.size) this.addStyle(10 + hits.size * 4, 'TUB SLAM');
  }

  sendState(dt) {
    this.sendTimer -= dt;
    if (this.sendTimer > 0) return;
    // 30 Hz in small groups; big lobbies send less often so a 16-player P2P mesh stays light
    const n = 1 + (this.others ? this.others.size : 0);
    this.sendTimer = n <= 4 ? 1 / 30 : n <= 8 ? 1 / 20 : 1 / 15;
    const m = this.mover;
    const msg = { t: 'p', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), yw: r2(this.yaw), pt: r2(this.pitch), d: m.ducked ? 1 : 0, sp: r2(m.horizontalSpeed()), dead: this.dead ? 1 : 0, rd: this.riding ? 1 : 0, h: this.hat, fl: this.flairOn, dg: this.botLookOn ? 1 : 0 }; // dg: LOOK LIKE A BOT (wishbatch2.js)
    if (/^#[0-9a-f]{6}$/i.test(this.settings.color || '')) msg.c = this.settings.color;
    if (this.cls === 'fister' && this.fModel && !this.dead) { msg.fp = this.fisterPacket(); if (this.fSim && this.fSim.IsAirKickDashing()) msg.ak = 1; } // John's posed body, so everyone sees him
    if (this.saberOut && this.hasSaber && this.cls !== 'fister') msg.sb = 1;
    if (this.xr && this.xr.session) { const vr = this.xr.packet(); if (vr) msg.vr = vr; } // your head and hands in VR
    this.net.broadcast(msg, false);
    if (this.sim) this.sim.handle(this.myId, msg);
  }

  // ---------------- per-frame ----------------
  update(dt) {
    this.stats.frame(dt);
    const paused = this.paused; // solo + pause menu / a machine / the inventory: the whole hive holds still
    if (!paused) this.time += dt;
    sharedUniforms.uTime.value = this.time;
    if (this.net) {
      this.net.update(dt);
      this.net.poll();
    }
    if (this.net && !this.net.isHost() && !this.welcomed && this.net.online) {
      this.helloTimer -= dt;
      if (this.helloTimer <= 0) { this.helloTimer = 2; this.sendHello(); }
    }
    if (this.sim && !paused) this.sim.update(dt);
    if (this.touch) this.touch.update();

    if (this.mode === 'play' && this.world && !paused) {
      // yaw rate for curving balls
      this.yawRate = (this.yaw - (this.prevYawT ?? this.yaw)) / Math.max(dt, 1e-3);
      this.prevYawT = this.yaw;
      this.updateLocal(dt);
      this.updateThrows(dt);
      this.updateKick(dt);
      this.updateFires(dt);
    this.updateLures(dt); this.batAnim = Math.max(0, this.batAnim - dt);
      if (this.nukeT > 0 && (this.nukeT -= dt) <= 0) { this.nukeT = 0; this.toHost({ t: 'nuke' }, true); }
    if (this.finglerT && (this.finglerT -= dt) <= 0) { this.finglerT = 0; try { window.location.reload(); } catch (err) { /* ignore */ } }
      this.updateSlash(dt);
      this.updateStyle(dt);
      this.micro.tick(dt);
      this.sendState(dt);
    } else if (this.mode === 'play' && this.world && this.net && this.net.mode !== 'solo') {
      this.sendState(dt);
    }
    if (this.mode === 'play' && this.world) this.fisterFrame(dt);
    // in VR the headset's own controllers drive everything: a PC may also list them (or an Xbox pad) as
    // ordinary gamepads, and polling both fought over the look and the buttons
    if (this.pad && !(this.xr && this.xr.session)) this.pad.poll(dt);
    if (this.xr) this.xr.update(dt);
    this.updateFeatures(dt);
    this.nukeFlash = Math.max(0, (this.nukeFlash || 0) - dt);
    this.casino.update(dt);
    this.micro.update(dt);
    if (!paused && this.mode === 'play') this.qte.tick(dt);
    if (this.mode === 'play' && !this.calm) this.clutter.update(dt);
    this.buddy.update(dt, this.rr.width, this.rr.height);
    if (!paused) {
      this.updateEntities(dt);
      this.updateRagdolls(dt);
      if (this.mode === 'play') { this.updateDowned(dt); this.updateXray(); }
      this.particles.update(dt);
      this.updateTimers(dt);
    }
    this.updateMusic();
    this.updateCamera(paused ? 0 : dt);
    this.updateLights(dt);
    this.ui.draw(dt);
    // the first-person rig is only drawn on frames where the camera actually followed the player
    this.rr.render(this.scene, this.camera, (this.mode === 'play' && (!this.dead || this.spectating) && this.world && this.camLive) || this.scare ? this.viewScene : null, this.viewCam);
    this.endScareIfDone();
    this.renderInfo = this.rr.renderer.info.render;
  }

  // what you say in chat has consequences
  chatConsequences(text) {
    if (this.mode !== 'play' || !this.world) return;
    if (saysCurse(text) && this.dead) { this.horseScare(); return; } // cursing at your own death: the horse is right there
    if (saysCurse(text)) this.toHost({ t: 'hex' }, true); // the horse heard that
    if (/^\s*G+\s*G+\s*!*\s*$/i.test(text) && !this.pickaxe) { // GG while looking at a horse: a diamond pickaxe
      const o = this.eyePos(), { fwd } = this.aim();
      const at = this.riding ? this.mover.pos : this.horseModel ? this.horseModel.position : null;
      const seen = this.riding || (at && (() => { const dx = at.x - o.x, dy = at.y + 1.2 - o.y, dz = at.z - o.z, d = Math.hypot(dx, dy, dz) || 1; return d < 14 && (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d > 0.9; })());
      if (seen) {
        this.pickaxe = true; this.mats += 32;
        this.ui.banner('GG. THE HORSE GIVES YOU A DIAMOND PICKAXE', 3.5);
        this.ui.toast('+15% DAMAGE, +32 WAX, BREAKS HARDENED WAX, FOES DROP MORE WAX');
        this.sound.play('jackpot');
        this.stats.add('pickaxes');
      }
    }
  }

  updateStyle(dt) {
    this.style = Math.max(0, this.style - dt * (5 + this.style * 0.035));
    this.rank = rankFor(this.style);
    for (const f of this.styleFeed) f.t -= dt;
    this.styleFeed = this.styleFeed.filter((f) => f.t > 0);
    if (this.wbuff.t > 0) { this.wbuff.t -= dt; if (this.wbuff.t <= 0) this.wbuff.stacks = 0; }
  }

  updateMusic() {
    if (!this.sound.musicOn) return;
    let i = 1;
    if (this.casino.open) i = 0;
    if (this.calm) i = Math.min(i, 1);
    else if (this.world && (this.world.stage === 'boss' || this.rank >= 4)) i = 2;
    this.sound.setIntensity(i);
  }

  updateTimers(dt) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.killMarker = Math.max(0, this.killMarker - dt);
    this.flashLight = Math.max(0, this.flashLight - dt * 8);
    for (const h of this.hurtDirs) h.t -= dt;
    this.hurtDirs = this.hurtDirs.filter((h) => h.t > 0);
    for (const c of this.chat) c.t -= dt;
    for (const p of this.pings) p.t -= dt;
    if (this.deathCam) { this.deathCam.t -= dt; if (this.deathCam.t <= 0 || !this.dead) this.deathCam = null; }
    this.pings = this.pings.filter((p) => p.t > 0);
    this.specKick = Math.max(0, (this.specKick || 0) - dt * 5);
    if (this.titleCard) { this.titleCard.t -= dt; if (this.titleCard.t <= 0) this.titleCard = null; }
    if (this.runOver) this.runOver.t -= dt;
    if (this.flashTimer > 0) { this.flashTimer -= dt; if (this.flashTimer <= 0 && this.viewmodel) this.viewmodel.userData.flash.visible = false; }
    this.rr.postMat.uniforms.uHurt.value = this.dead ? 0.35 : this.hurtFlash * 0.6;
  }

  updateEntities(dt) {
    const k = 1 - Math.exp(-dt * 14);
    for (const e of this.enemies.values()) {
      const p = e.model.position;
      p.x += (e.tx - p.x) * k; p.y += (e.ty - p.y) * k; p.z += (e.tz - p.z) * k;
      let dy = e.tyaw - e.model.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      e.model.rotation.y += dy * k;
      if (e.spin > 0) { e.spin -= dt; e.model.rotation.y += dt * 20 * e.spin; } // spun by a ball
      animateEnemy(e.model, this.time + e.id * 0.37, e.speed > 0.3, e.st, dt);
      if (e.tier && Math.random() < (e.tier === 2 ? 0.6 : 0.25)) { const c = e.tier === 2 ? [1, 0.3, 0.8] : [1, 0.85, 0.2]; this.particles.emit(p.x + (Math.random() - 0.5) * e.scale, p.y + Math.random() * 2 * e.scale, p.z + (Math.random() - 0.5) * e.scale, 0, 0.8, 0, c[0], c[1], c[2], 0.06, 0.6, -0.2); }
      if (e.st === 3 && Math.random() < 0.1) this.particles.emit(p.x, p.y + 2, p.z, Math.random() - 0.5, 0.5, Math.random() - 0.5, 1, 1, 0.5, 0.05, 0.4, 0);
      if (e.flash > 0) { e.flash -= dt; setFlash(e.model, e.flash > 0 ? 0.6 : 0); }
    }
    for (const pr of this.projs.values()) {
      pr.mesh.position.x += (pr.x + pr.vx * 0.03 - pr.mesh.position.x) * k;
      pr.mesh.position.y += (pr.y + pr.vy * 0.03 - pr.mesh.position.y) * k;
      pr.mesh.position.z += (pr.z + pr.vz * 0.03 - pr.mesh.position.z) * k;
      pr.mesh.rotation.y += dt * 8; pr.mesh.rotation.x += dt * 5;
      if (Math.random() < 0.5) this.particles.emit(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, 0, 0, 0, pr.rf ? 1 : 0.6, pr.rf ? 0.85 : 0.9, 0.2, 0.06, 0.25, 0);
    }
    for (const o of this.orbs.values()) {
      o.mesh.position.x += (o.x - o.mesh.position.x) * k; o.mesh.position.z += (o.z - o.mesh.position.z) * k;
      o.mesh.position.y = o.y + Math.sin(this.time * 3 + o.x) * 0.15;
      o.mesh.rotation.y += dt * 2;
    }
    for (const [oid, o] of this.others) {
      const p = o.model.position;
      p.x += (o.tx - p.x) * k; p.y += (o.ty - p.y) * k; p.z += (o.tz - p.z) * k;
      let dy = (o.tyaw || 0) + Math.PI - o.model.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      o.model.rotation.y += dy * k;
      o.model.visible = !o.dead && this.spectating !== oid && !o.fModel; // never inside the bee you're watching (and never a bee where a John Fister stands)
      animatePlayer(o.model, this.time, o.speed, o.pitch, o.ducked, o.riding);
      if (o.flip) { o.flip.t += dt; this.flipPose(o.model, o.flip.t, o.flip.fail); if (o.flip.t > (o.flip.fail ? 2.6 : 1.05)) { o.flip = null; o.model.rotation.x = 0; } }
    }
    // a CRUISER's tethers: it is soaking the damage of everything near it
    for (const c of this.enemies.values()) {
      if (ENEMY_TYPES[c.type] !== 'cruiser' || c.goneT || Math.random() > 0.5) continue;
      for (const e of this.enemies.values()) {
        if (e === c || e.goneT) continue;
        const dx = e.tx - c.tx, dz = e.tz - c.tz;
        if (dx * dx + dz * dz > 81) continue;
        const t = Math.random();
        this.particles.emit(c.tx + dx * t, c.ty + 1.5 + (e.ty - c.ty) * t, c.tz + dz * t, 0, 0, 0, 0.3, 1, 0.9, 0.05, 0.25, 0);
      }
    }
    if (this.level) {
      const pt = this.level.portal.userData;
      const open = this.world ? this.world.portalOpen : true;
      pt.ring.rotation.z = this.time * (open ? 1.5 : 0.2);
      this.level.portal.rotation.y = this.time * 0.3;
      const pulse = 0.6 + Math.sin(this.time * 4) * 0.25;
      pt.discMat.uniforms.uEmissive.value.set(open ? 1 * pulse : 0.05, open ? 0.75 * pulse : 0.05, open ? 0.2 * pulse : 0.07);
      pt.shards.forEach((s, i) => {
        const a = this.time * (open ? 2 : 0.4) + (i / pt.shards.length) * Math.PI * 2;
        s.position.set(Math.cos(a) * 1.8, 1.5 + Math.sin(a * 2) * 0.4, Math.sin(a) * 1.8);
        s.material.uniforms.uEmissive.value.set(open ? 1 : 0.15, open ? 0.8 : 0.15, open ? 0.2 : 0.17);
      });
      for (let i = 0; i < this.level.braziers.length; i++) {
        const b = this.level.braziers[i].userData;
        const f = 0.85 + Math.sin(this.time * 13 + i * 2.1) * 0.1 + Math.sin(this.time * 7.3 + i) * 0.08;
        b.flame.scale.set(1, f, 1); b.core.scale.set(1, f * 1.1, 1);
      }
      for (const pm of this.level.props) {
        const u = pm.userData;
        if (u.reels) u.reels.forEach((r, i) => r.material.uniforms.uEmissive.value.setScalar(0.6 + 0.4 * Math.abs(Math.sin(this.time * 6 + i))));
        if (u.wheel) u.wheel.rotation.z = this.time * 0.8;
        if (u.runners) u.runners.forEach((r, i) => { r.position.x = -0.35 + ((this.time * (0.2 + i * 0.03) + i * 0.3) % 1) * 0.7; });
        if (u.heart) u.heart.scale.setScalar(1 + Math.abs(Math.sin(this.time * 3)) * 0.15);
        if (u.jar) u.jar.rotation.y = this.time;
      }
      if (this.level.goalHive) { const gh = this.level.goalHive; if (gh.userData.art) { if (gh.userData.mixer) gh.userData.mixer.update(dt); } else gh.rotation.y = this.time * 0.4; gh.userData.bees.forEach((b, k) => { const a = this.time * (2 + k * 0.4) + k * 2.1; b.position.set(Math.cos(a) * 1.2, -1.1 + Math.sin(a * 1.7) * 0.4, Math.sin(a) * 1.2); }); }
      if (this.horseModel && this.horseModel.userData.sparkle) this.horseModel.userData.sparkle.forEach((s, k) => { s.rotation.y = this.time * 3 + k; s.scale.setScalar(0.6 + Math.abs(Math.sin(this.time * 4 + k * 1.7))); });
      (this.level.hives || []).forEach((hv, i) => {
        hv.rotation.z = Math.sin(this.time * 0.7 + i) * 0.03;
        hv.userData.bees.forEach((b, k) => { const a = this.time * (2 + k * 0.4) + k * 2.1 + i; b.position.set(Math.cos(a) * (0.9 + k * 0.15), -1.1 + Math.sin(a * 1.7) * 0.3, Math.sin(a) * (0.9 + k * 0.15)); });
      });
    }
  }

  updateCamera(dt) {
    this.camLive = false;
    if (this.xr && this.xr.session) { this.sound.listener = { x: this.mover.pos.x, y: this.mover.pos.y + 1.6, z: this.mover.pos.z, yaw: this.yaw }; return; } // the headset owns the camera
    if (this.mode !== 'play' || !this.world) {
      this.demoT = (this.demoT || 0) + dt;
      const map = this.map;
      const r = map.rooms[Math.floor(this.demoT / 9) % map.rooms.length];
      const t = (this.demoT % 9) / 9;
      const cx = (r.cx + 0.5) * T, cz = (r.cy + 0.5) * T;
      const ang = t * 1.4 + r.cx;
      const rad = Math.min(r.w, r.h) * T * 0.3;
      this.camera.position.set(cx + Math.cos(ang) * rad, Math.min(r.ceil - 0.8, 2.6), cz + Math.sin(ang) * rad);
      this.camera.rotation.set(-0.12, Math.atan2(Math.cos(ang), Math.sin(ang)), 0);
      this.sound.listener = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, yaw: this.camera.rotation.y };
      return;
    }
    this.camLive = true;
    if (this.dead && this.deathCam && this.deathCam.t > 0) { // watch yourself go flying for a moment
      const rp = this.deathCam.rag.model.position;
      this.deathCam.ang += dt * 0.5;
      this.safeCamera(rp.x, rp.y + 0.8, rp.z, rp.x + Math.sin(this.deathCam.ang) * 3.2, rp.y + 2.4, rp.z + Math.cos(this.deathCam.ang) * 3.2);
      this.camera.lookAt(rp.x, rp.y + 0.6, rp.z);
      this.camLive = false;
      return;
    }
    const target = this.dead && !this.freeCam ? this.specTarget() : null;
    this.spectating = target ? target.id : null;
    if (target) { this.spectateCamera(target.o, dt); return; }
    if (this.flip && this.flipCamera()) { this.camLive = false; return; } // a backflip: watch yourself from outside
    if (this.fisterCamera && this.fisterCamera(dt)) { this.camLive = false; return; } // JOHN FISTER plays in third person
    const alpha = (this.physAcc || 0) / TICK;
    const eye = this.eyePos(Math.min(1, alpha));
    const m = this.mover;
    if (m.landImpact > 0) { this.landDip = Math.max(this.landDip || 0, m.landImpact * 0.12); m.landImpact = 0; }
    this.landDip = Math.max(0, (this.landDip || 0) - dt * 0.6);
    eye.y -= this.landDip;
    if (this.riding && m.onGround) eye.y += Math.abs(Math.sin(this.time * (8 + m.horizontalSpeed() * 0.8))) * 0.06;
    if (this.shake > 0) { eye.x += (Math.random() - 0.5) * this.shake * 2; eye.y += (Math.random() - 0.5) * this.shake * 2; eye.z += (Math.random() - 0.5) * this.shake * 2; }
    // first person: shake, a horse's height or a low ceiling never push the eye through the level
    this.safeCamera(m.pos.x, m.pos.y + 0.8, m.pos.z, eye.x, eye.y, eye.z, 0.12);
    eye.copy(this.camera.position);
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    const side = m.vel.x * right.x + m.vel.z * right.z;
    const rollTarget = -Math.max(-1, Math.min(1, side / 8)) * ((m.sliding ? 4 : 1.5) * Math.PI / 180);
    this.roll = (this.roll || 0) + (rollTarget - (this.roll || 0)) * Math.min(1, dt * 10);
    this.camera.rotation.set(this.pitch, this.yaw, this.roll);
    // dash FOV kick
    const kick = m.dashT > 0 ? 1 : 0;
    this.fovKick = (this.fovKick || 0) + (kick - (this.fovKick || 0)) * Math.min(1, dt * 12);
    const vfov = 2 * Math.atan(Math.tan((this.settings.fov * Math.PI) / 360) * 0.75) * (180 / Math.PI);
    this.camera.fov = vfov + this.fovKick * 8; this.camera.updateProjectionMatrix();
    this.sound.listener = { x: eye.x, y: eye.y, z: eye.z, yaw: this.yaw };

    if (this.viewmodel) {
      const v = this.viewmodel.userData;
      const sp = m.horizontalSpeed();
      const bobAmt = m.onGround ? Math.min(1, sp / 8) : 0;
      this.bobT = (this.bobT || 0) + dt * (6 + sp * 0.6) * (m.onGround ? 1 : 0.3);
      const bx = Math.sin(this.bobT) * 0.012 * bobAmt, by = -Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt;
      const dyaw = this.yaw - (this.lastYaw ?? this.yaw), dpitch = this.pitch - (this.lastPitch ?? this.pitch);
      this.lastYaw = this.yaw; this.lastPitch = this.pitch;
      this.swayX = ((this.swayX || 0) + dyaw * 0.4) * Math.max(0, 1 - dt * 10);
      this.swayY = ((this.swayY || 0) + dpitch * 0.4) * Math.max(0, 1 - dt * 10);
      const w = this.weapon;
      const reload = (w.reloadPulse || 0) > 0 ? 1 : 0;
      this.reloadBlend = (this.reloadBlend || 0) + (reload - (this.reloadBlend || 0)) * Math.min(1, dt * 10);
      const kickv = w.kick * w.kick;
      this.viewmodel.position.set(0.2 + bx + this.swayX, -0.24 + by - this.landDip * 0.5 - this.swayY - this.reloadBlend * 0.06, -0.38 + kickv * 0.1);
      this.viewmodel.rotation.set(kickv * 0.28 + this.reloadBlend * 0.2, 0.06, this.reloadBlend * 0.45);
      const pumpPhase = w.pump > 0 ? Math.sin(Math.min(1, (0.6 - w.pump) / 0.6) * Math.PI) : 0;
      v.pump.position.z = pumpPhase * 0.12;
      if (w.reloading) v.pump.position.z = 0;
      v.gun.visible = !this.riding && this.cls === 'hornet';
      v.jav.visible = this.riding && this.quiver > 0;
      if (v.bat) {
        const ba = this.batAnim / 0.22;
        v.bat.visible = !this.riding && this.cls === 'batter';
        v.bomb.visible = !this.riding && this.cls === 'grenader' && this.bombs > 0 && ba <= 0;
        if (v.ball) { v.ball.visible = !this.riding && this.cls === 'spinner' && this.balls > 0 && this.batCd < SPINNER.throwCd * 0.5; v.ball.rotation.y += dt * 9; }
        if (v.bat.visible) {
          if (ba > 0) { const k = 1 - ba; v.bat.position.set(0.3 - k * 0.6, -0.3, -0.45); v.bat.rotation.set(-1.35, 0, -0.9 + k * 1.8); } // a flat swing right to left
          else { v.bat.position.set(0.34, -0.4, -0.5); v.bat.rotation.set(-0.5 + (this.homerun > 0 ? Math.sin(this.time * 30) * 0.03 : 0), 0, 0.35); } // held low and to the right, ready
        }
      }
      if (v.jav.visible) v.jav.position.z = -0.2 + Math.min(0.3, w.cool) * 0.6;
      const pa = this.parryAnim / 0.25;
      v.stinger.visible = pa > 0;
      const kk = Math.max(0, this.kickT || 0) / 0.5;
      v.leg.visible = kk > 0;
      const charging = this.slashCharge !== undefined && this.slashCharge !== null;
      const sa = (this.slashAnim || 0) / 0.28;
      v.blade.visible = charging || sa > 0 || (this.cls === 'cleaver' && !this.riding);
      v.gun.visible = v.gun.visible && !v.blade.visible;
      if (!charging && sa <= 0 && v.blade.visible) { v.blade.position.set(0.3, -0.3, -0.12); v.blade.rotation.set(0.7, -0.3, -0.2); } // at rest on the shoulder
      if (charging) { // wound up over the right shoulder, trembling as it charges
        const c = Math.min(1, this.slashCharge), shake = c >= 1 ? Math.sin(this.time * 60) * 0.01 : 0;
        v.blade.position.set(0.3 + shake, -0.28 + c * 0.04, -0.15);
        v.blade.rotation.set(1.0 + c * 0.25, -0.35, -0.35);
      } else if (sa > 0) { // the swing: right to left across the whole view
        const k = 1 - sa;
        v.blade.position.set(0.22 - k * 0.44, -0.22, -0.2);
        v.blade.rotation.set(0.12, -1.15 + k * 2.3, 0.5 - k * 1.0);
      }
      if (kk > 0) { v.leg.position.set(-0.05, -0.32 + Math.sin(kk * Math.PI) * 0.12, -0.05 - Math.sin(Math.min(1, (1 - kk) * 3) * Math.PI / 2) * 0.25); v.leg.rotation.set(0.35, 0, 0); }
      if (pa > 0) v.stinger.position.set(-0.32, -0.02, -0.1 - Math.sin(pa * Math.PI) * 0.35);
    }
  }

  // ---------------- the HIVE CLEAVER (V): tap to slash, hold to charge a massive one ----------------
  startSlash(by = 'key') {
    if (!this.has('slash')) { this.kitNag('V THE CLEAVER', 'cleaver'); return; }
    this.slashBy = by;
    if (this.dead || this.mode !== 'play' || !this.world || this.casino.open || this.micro.open || this.riding) return;
    if ((this.slashCd || 0) > 0 || this.slashCharge !== undefined && this.slashCharge !== null) return;
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    this.slashCharge = 0;
    this.sound.play('charge');
  }

  releaseSlash() {
    if (this.slashCharge === undefined || this.slashCharge === null) return;
    const charge = Math.min(1, this.slashCharge);
    this.slashCharge = null;
    if (this.dead || this.inSafeZone()) return;
    const power = 1 + charge; // up to 2x
    const range = (4.5 + 3.5 * charge) * this.modMul('cleaverRangePct') * (this.inv ? this.wSize() : 1); // up to 8m
    const m = this.mover;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const ws = weaponStats(this.myUps, this.honey);
    const crit = Math.random() < ws.critChance + this.mod('cleaverCritPct') / 100;
    const dmg = 90 * power * (ws.pelletDmg / 6) * this.dmgMul() * this.modMul('cleaverDmgPct') * (crit ? ws.critMult : 1);
    const wave = charge >= 1 ? this.mod('cleaverWave') : 0; // CRESCENT WAVE: full charges reach further
    const arc = this.mod('cleaverArc') > 0 ? -1.01 : -0.17; // FULL CIRCLE: all the way around
    const hits = new Map();
    let n = 0;
    if (this.mod('cleaverParry')) { const { fwd } = this.aim(); this.toHost({ t: 'parry', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), dx: r2(fwd.x), dy: r2(fwd.y), dz: r2(fwd.z), m: 1, w: 0.2 }, true); }
    for (const e of this.enemies.values()) {
      if (e.goneT) continue;
      const p = e.model.position;
      const dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz) || 0.01;
      const reach = range + ENEMIES[ENEMY_TYPES[e.type]].radius * (e.scale || 1);
      if (d > reach + wave || Math.abs(p.y - m.pos.y) > 3) continue;
      if ((dx * fx + dz * fz) / d < arc) continue; // a 200 degree sweep in front of you
      if (e.type === FINGLER) this.disturbFingler(e);
      const exec = e.hp < 0.3 ? 1 + this.mod('cleaverExecutePct') / 100 : 1;
      hits.set(e.id, dmg * exec * (d > reach ? 0.6 : 1)); e.flash = 0.15;
      if (n++ < 10) this.toHost({ t: 'kick', id: e.id, dx: r2(dx / d), dz: r2(dz / d) }, true);
      this.particles.burst(p.x, p.y + 1.2, p.z, 14, BLOOD[e.type], 5, 0.08, 0.5);
    }
    if (hits.size) {
      this.toHost({ t: 'hit', h: [...hits].map(([id, v]) => [id, Math.round(v * 10) / 10]), src: 'slash' }, true);
      this.stats.add('dmgDealt', dmg * hits.size); this.stats.add('slashHits', hits.size);
      this.hitstop = 0.06 + 0.04 * Math.min(4, hits.size); this.hitMarker = 0.25;
      this.addStyle(10 + hits.size * 6 + Math.round(charge * 15), charge > 0.9 ? 'MASSIVE SLASH' : 'SLASH');
      if (this.mod('cleaverLeech')) this.toHost({ t: 'heal', a: this.mod('cleaverLeech') * hits.size }, true);
      if (this.mod('cleaverStun')) this.toHost({ t: 'stun', ids: [...hits.keys()].slice(0, 12), d: this.mod('cleaverStun') }, true);
      if (crit) this.ui.toast('CRIT SLASH!');
      this.lastWeapon = 'slash';
    }
    // a little lunge (a big one for the CLEAVER class), and in the air a little hang time
    const lunge = this.cls === 'cleaver' ? 6 + 4 * charge : 3;
    m.vel.x += fx * lunge; m.vel.z += fz * lunge;
    if (!m.onGround) m.vel.y = Math.max(m.vel.y, this.mod('cleaverAir') ? 6 : 2);
    if (!m.onGround && this.mod('cleaverAir')) m.dashes = Math.min(m.dashes + 1, this.moveOpts().maxDashes);
    this.slashAnim = 0.28; this.slashCd = (0.9 + charge * 0.6) / this.modMul('cleaverCdPct', 0.3) / (this.inv ? this.wSpeed() : 1);
    this.landDip = Math.max(this.landDip || 0, 0.05 + charge * 0.12);
    this.flashLight = Math.max(this.flashLight, 0.5 + charge * 0.5); this.flashPos = null;
    this.sound.play('slash');
    this.slashFx(m.pos.x, m.pos.y + 1.2, m.pos.z, this.yaw, range);
    this.net.broadcast({ t: 'sl', x: r2(m.pos.x), y: r2(m.pos.y + 1.2), z: r2(m.pos.z), yw: r2(this.yaw), r: r2(range) }, true);
    this.stats.add('slashes');
  }

  // the crescent of light the slash leaves in the air (also drawn for other players' slashes)
  slashFx(x, y, z, yaw, range) {
    const steps = Math.round(18 + range * 4);
    for (let i = 0; i <= steps; i++) {
      const a = yaw + Math.PI * (-0.55 + 1.1 * (i / steps));
      const fx = -Math.sin(a), fz = -Math.cos(a);
      for (const r of [range * 0.55, range * 0.8, range]) {
        const c = r === range ? [1, 1, 0.85] : [1, 0.75, 0.25];
        this.particles.emit(x + fx * r, y + (i / steps - 0.5) * 0.4, z + fz * r, fx * 2, 0.3, fz * 2, c[0], c[1], c[2], r === range ? 0.08 : 0.06, 0.35, 0);
      }
    }
  }

  updateSlash(dt) {
    this.slashCd = Math.max(0, (this.slashCd || 0) - dt);
    this.slashAnim = Math.max(0, (this.slashAnim || 0) - dt);
    if (this.slashCharge !== undefined && this.slashCharge !== null) {
      const before = this.slashCharge;
      this.slashCharge += dt * this.modMul('cleaverChargePct');
      if (before < 1 && this.slashCharge >= 1) { this.sound.play('rank'); this.particles.burst(this.mover.pos.x, this.mover.pos.y + 1.2, this.mover.pos.z, 20, [1, 0.9, 0.4], 2, 0.06, 0.3, 0); }
      if (this.dead || this.casino.open) this.slashCharge = null;
    }
  }

  // you touched the FINGLER. It bursts into a pile of colorful blood and your browser refreshes.
  disturbFingler(e) {
    if (this.finglerT) return;
    const p = e.model.position;
    for (let i = 0; i < 8; i++) { const c = [[1, 0.2, 0.2], [1, 0.6, 0.1], [1, 1, 0.2], [0.2, 1, 0.3], [0.2, 0.6, 1], [0.7, 0.3, 1], [1, 0.4, 0.9], [1, 1, 1]][i]; this.particles.burst(p.x, p.y + 1, p.z, 40, c, 9, 0.12, 1.2, 0.6); }
    this.ui.banner('YOU DISTURBED THE FINGLER', 2);
    this.sound.play('jackpot');
    this.finglerT = 1.6;
    try { this.stats.commit(); this.saveMeta(); this.saveSettings(); } catch (err) { /* ignore */ }
  }

  // ---------------- CLASSES ----------------
  kitNag(move, cls) {
    if (this.dead || this.mode !== 'play' || this.time - (this.kitNagT || -9) < 1.2) return;
    this.kitNagT = this.time; this.sound.play('deny');
    this.ui.toast(`${move} BELONG TO THE ${CLASSES[cls].name} (PICK IT AT THE START OF A RUN)`);
  }

  updateClass(dt, wantFire) {
    if (this.cls === 'pestilent') { if (wantFire) this.cough(); return; } // cough out a cloud of pestilence
    if (this.cls === 'fister') { this.updateFister && this.updateFister(dt, wantFire); return; }
    if (this.cls === 'spinner') { // click throws spin balls; turn while you throw to curve them
      this.batCd = Math.max(0, this.batCd - dt);
      if (wantFire && this.batCd <= 0 && this.balls > 0) { this.throwBall(); this.batCd = SPINNER.throwCd; }
      return;
    }
    if (this.cls === 'cleaver') { // click to slash, hold to charge
      const charging = this.slashCharge !== undefined && this.slashCharge !== null;
      if (wantFire && !charging && (this.slashCd || 0) <= 0) this.startSlash('mouse');
      else if (charging && this.slashBy === 'mouse' && !wantFire) this.releaseSlash();
      return;
    }
    this.batCd = Math.max(0, this.batCd - dt);
    this.homerun = Math.max(0, this.homerun - dt);
    if (this.cls === 'batter') { if (wantFire && this.batCd <= 0) this.swingBat(); return; }
    if (this.bombs < this.maxBombs) { this.bombT += dt; if (this.bombT >= BOMB.regen / this.modMul('rofPct', 0.3) / this.modMul('bombRegenPct', 0.3) / this.wSpeed()) { this.bombT = 0; this.bombs++; } }
    else this.bombT = 0;
    if (wantFire && this.batCd <= 0 && this.bombs > 0) this.throwBomb();
  }

  // BATTER: every swing is also a parry, so projectiles get batted straight back
  swingBat() {
    const m = this.mover, o = this.eyePos(), { fwd } = this.aim();
    this.batCd = BAT.cd / this.modMul('rofPct', 0.3) / this.modMul('batCdPct', 0.3) / this.wSpeed(); this.batAnim = 0.22;
    this.sound.play('slash');
    this.toHost({ t: 'parry', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), dx: r2(fwd.x), dy: r2(fwd.y), dz: r2(fwd.z), m: 1.5 + this.itemFx('parryDmg'), w: BAT.parryWindow }, true);
    const ws = weaponStats(this.myUps, this.honey);
    const homer = this.homerun > 0;
    const speed = m.horizontalSpeed() + Math.max(0, -m.vel.y) * 0.5;
    const dmg = BAT.dmg * (ws.pelletDmg / 6) * this.dmgMul() * this.modMul('batDmgPct') * (1 + Math.min(1.5, speed / 12)) * (homer ? BAT.homerunMul * (1 + this.mod('batHomer')) : 1) * (ws.critChance > Math.random() ? ws.critMult : 1);
    const reach = BAT.reach * this.modMul('batReachPct') * this.wSize();
    const hits = new Map();
    for (const e of this.enemies.values()) {
      const p = e.model.position;
      const dx = p.x - o.x, dy = p.y + 1 - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz) || 1;
      if (d > reach + ENEMIES[ENEMY_TYPES[e.type]].radius * (e.scale || 1)) continue;
      if ((dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < BAT.cone) continue;
      hits.set(e.id, dmg); e.flash = 0.15;
      if (hits.size <= 6) this.toHost({ t: 'kick', id: e.id, dx: r2(dx / d), dz: r2(dz / d), f: homer ? 2.5 : 1 }, true);
      this.particles.burst(p.x, p.y + 1.2, p.z, homer ? 30 : 12, BLOOD[e.type], homer ? 8 : 4, 0.08, 0.5);
    }
    if (!hits.size) return;
    this.sendHits(hits, 'bat');
    if (this.mod('batStun')) this.toHost({ t: 'stun', ids: [...hits.keys()].slice(0, 8), d: this.mod('batStun') }, true); // BUNT
    this.stats.add('batHits', hits.size);
    this.hitMarker = 0.2; this.hitstop = homer ? 0.12 : 0.05;
    this.sound.play(homer ? 'headshot' : 'thunk', m.pos);
    this.addStyle((homer ? 40 : 12) + hits.size * 4, homer ? 'HOMERUN!' : 'BONK');
    if (homer) { this.homerun = 0; this.flashLight = 1; this.flashPos = null; }
    // a hit in the air pogos you up and gives a dash back: stay off the ground
    if (!m.onGround) {
      m.vel.y = Math.max(m.vel.y, 5.5);
      m.dashes = Math.min(m.dashes + 1, this.moveOpts().maxDashes);
      this.addStyle(6, 'AIR BAT');
    }
  }

  // GRENADER: throw a honey bomb
  throwBomb() {
    if (this.dead || this.bombs <= 0 || this.casino.open || this.micro.open || this.mode !== 'play') return;
    this.bombs--; this.batCd = BOMB.cd / this.wSpeed(); this.batAnim = 0.2;
    const o = this.eyePos(), { fwd } = this.aim();
    const v = [fwd.x * 22, fwd.y * 22 + 3, fwd.z * 22];
    this.spawnThrow('bomb', [o.x, o.y - 0.15, o.z], v, true, false, 0);
    this.net.broadcast({ t: 'th', k: 'bomb', o: [r2(o.x), r2(o.y - 0.15), r2(o.z)], v: v.map(r2) }, true);
    this.sound.play('javelin');
    this.stats.add('bombs');
  }

  // a bomb lands: it sticks, yanks every foe in 9m toward itself, then pops
  bombLand(t) {
    this.lures.push({ x: t.x, y: t.y, z: t.z, t: BOMB.fuse, mine: t.mine });
    this.sound.play('ping', { x: t.x, y: t.y, z: t.z });
    if (t.mine) this.toHost({ t: 'pull', x: r2(t.x), y: r2(t.y), z: r2(t.z), r: r2(BOMB.pull * this.modMul('bombPullPct')) }, true);
  }

  updateLures(dt) {
    for (const L of this.lures) {
      L.t -= dt;
      for (let i = 0; i < 4; i++) { // a swirl of honey drawn inward
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
        this.particles.emit(L.x + Math.cos(a) * r, L.y + 0.5 + Math.random(), L.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0, -Math.sin(a) * r * 2, 1, 0.75, 0.2, 0.06, 0.4, 0);
      }
      if (L.t > 0) continue;
      this.fxBoom(L.x, L.y + 0.4, L.z, 3.5, [1, 0.65, 0.15], 0.34);
      this.sound.play('boom', { x: L.x, y: L.y, z: L.z });
      this.flashLight = Math.max(this.flashLight, 0.8); this.flashPos = { x: L.x, y: L.y + 1, z: L.z };
      // rocket jump: your own blast throws you, it never hurts you
      const m = this.mover;
      if (L.mine && !this.dead) {
        const push = rocketPush(m.pos.x - L.x, m.pos.y + 0.9 - L.y, m.pos.z - L.z);
        if (push) { m.vel.x += push.x; m.vel.z += push.z; m.vel.y = Math.max(m.vel.y, 0) + push.y; m.onGround = false; this.addStyle(8, 'ROCKET JUMP'); }
      }
      if (!L.mine) continue;
      const ws = weaponStats(this.myUps, this.honey);
      const caught = [];
      const rad = BOMB.radius * this.modMul('fireRadiusPct') * this.modMul('bombRadiusPct') * this.wSize();
      for (const e of this.enemies.values()) {
        const p = e.model.position;
        if (Math.hypot(p.x - L.x, p.z - L.z) < rad && Math.abs(p.y + 1 - L.y) < 3.5) caught.push(e);
      }
      if (this.mod('bombFire') && !L.mini) this.burst({ x: L.x, y: L.y, z: L.z, mine: true }); // NAPALM HONEY
      if (this.mod('bombCluster') && !L.mini) for (let c = 0; c < 3; c++) { const a = (c / 3) * Math.PI * 2; this.lures.push({ x: L.x + Math.cos(a) * 2.5, y: L.y, z: L.z + Math.sin(a) * 2.5, t: 0.35 + c * 0.12, mine: true, mini: true }); } // CLUSTER BOMB
      if (!caught.length) continue;
      const dmg = bombDamage(caught.length) * (ws.pelletDmg / 6) * this.dmgMul();
      this.sendHits(new Map(caught.map((e) => { e.flash = 0.15; return [e.id, dmg]; })), 'bomb');
      this.hitMarker = 0.2; this.hitstop = 0.04 + 0.01 * Math.min(8, caught.length);
      this.addStyle(10 + caught.length * 8, caught.length > 2 ? `BUNCHED X${caught.length}` : 'POP');
      this.stats.add('bombHits', caught.length);
    }
    this.lures = this.lures.filter((L) => L.t > 0);
  }

  // ---------------- dropkick ----------------
  dropkick() {
    if (!this.has('kick')) { this.kitNag('X DROPKICK', 'batter'); return; }
    if (this.dead || this.mode !== 'play' || !this.world || this.casino.open || this.micro.open || (this.kickCd || 0) > 0) return;
    if (this.inSafeZone()) { this.safeZoneNag(); return; }
    const m = this.mover;
    const dx = -Math.sin(this.yaw), dz = -Math.cos(this.yaw);
    const sp = Math.max(m.horizontalSpeed() + 2, 11);
    m.vel.x = dx * sp; m.vel.z = dz * sp;
    m.vel.y = Math.max(m.vel.y, m.onGround ? 4.5 : 2);
    m.onGround = false;
    this.kickT = 0.5; this.kickCd = 0.7; this.kickHit = new Set();
    this.sound.play('dash');
    this.stats.add('kicks');
  }

  updateKick(dt) {
    this.kickCd = Math.max(0, (this.kickCd || 0) - dt);
    if (!(this.kickT > 0)) return;
    this.kickT -= dt;
    const m = this.mover;
    if (m.onGround && this.kickT < 0.4) { this.kickT = 0; return; }
    const dx = -Math.sin(this.yaw), dz = -Math.cos(this.yaw);
    for (const e of this.enemies.values()) {
      if (this.kickHit.has(e.id)) continue;
      const p = e.model.position;
      const rx = p.x - m.pos.x, rz = p.z - m.pos.z, d = Math.hypot(rx, rz) || 1;
      const reach = 1.3 + ENEMIES[ENEMY_TYPES[e.type]].radius;
      if (d > reach || (rx * dx + rz * dz) / d < 0.2 || Math.abs(p.y - m.pos.y) > 2.2) continue;
      this.kickHit.add(e.id);
      const ws = weaponStats(this.myUps, this.honey);
      const dmg = 55 * (ws.pelletDmg / 6) * this.dmgMul() * (1 + Math.min(1, m.horizontalSpeed() / 20)) * this.modMul('kickDmgPct');
      this.toHost({ t: 'hit', h: [[e.id, Math.round(dmg * 10) / 10]], src: 'kick' }, true);
      this.toHost({ t: 'kick', id: e.id, dx: r2(dx), dz: r2(dz) }, true);
      this.stats.add('dmgDealt', dmg); this.stats.add('kickHits');
      e.flash = 0.15;
      this.particles.burst(p.x, p.y + 1, p.z, 24, [1, 1, 0.8], 6, 0.08, 0.4);
      this.sound.play('thunk', p); this.sound.play('boom', p);
      this.hitstop = 0.07; this.hitMarker = 0.2;
      // pogo off them: bounce back and up, and the kick is ready again for a chain
      m.vel.x = -dx * 5; m.vel.z = -dz * 5; m.vel.y = 6.5; m.onGround = false;
      this.kickT = 0; this.kickCd = 0;
      this.addStyle(18, 'DROPKICK');
      this.lastWeapon = 'kick';
      break;
    }
  }

  // ---------------- ragdolls ----------------
  addRagdoll(model, dx, dz, power) {
    const l = Math.hypot(dx, dz) || 1;
    setXray(model, false);
    setFlash(model, 0);
    const u = model.userData;
    // pitch relative to where the body faces, so "backward" means away from the hit
    model.rotation.order = 'YXZ';
    const facing = model.rotation.y, fx = -Math.sin(facing), fz = -Math.cos(facing);
    const away = (dx * fx + dz * fz) / l; // +1: flung the way it faces (falls forward)
    const tumble = 7 + power * 0.6;
    const r = {
      model, t: 0, vx: (dx / l) * power, vy: 3 + power * 0.35, vz: (dz / l) * power,
      ax: (away >= 0 ? -1 : 1) * tumble * (0.8 + Math.random() * 0.4), az: (Math.random() - 0.5) * 4, grounded: false,
      limbs: ['legL', 'legR', 'armL', 'armR'].filter((k) => u[k]).map((k) => ({ o: u[k], to: (Math.random() - 0.5) * 3, ph: Math.random() * 6 })),
    };
    this.ragdolls = this.ragdolls || [];
    this.ragdolls.push(r);
    while (this.ragdolls.length > 24) { const old = this.ragdolls.shift(); this.entityRoot.remove(old.model); }
    return r;
  }

  updateRagdolls(dt) {
    if (!this.ragdolls || !this.world) return;
    const map = this.world.map;
    for (const r of this.ragdolls) {
      r.t += dt;
      const p = r.model.position;
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        const h = dt / steps;
        r.vy -= 20 * h;
        const nx = p.x + r.vx * h, nz = p.z + r.vz * h;
        const tileAtXZ = (x, z) => { const i = Math.floor(x / T), j = Math.floor(z / T); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
        const kX = tileAtXZ(nx, p.z), kZ = tileAtXZ(p.x, nz);
        if (kX < 0 || map.type[kX] === WALL || map.fh[kX] > p.y + 0.5) r.vx *= -0.4; else p.x = nx;
        if (kZ < 0 || map.type[kZ] === WALL || map.fh[kZ] > p.y + 0.5) r.vz *= -0.4; else p.z = nz;
        p.y += r.vy * h;
        const k = tileAtXZ(p.x, p.z);
        const floor = k >= 0 ? map.fh[k] : 0, ceil = k >= 0 ? map.ch[k] : 4;
        if (p.y > ceil - 1) { p.y = ceil - 1; r.vy = -Math.abs(r.vy) * 0.3; }
        const rest = floor + (r.grounded ? 0.15 : 0);
        if (p.y < rest) {
          p.y = rest;
          if (Math.abs(r.vy) > 2) { r.vy = -r.vy * 0.3; r.ax *= 0.6; r.az *= 0.6; } else { r.vy = 0; r.grounded = true; }
          r.vx *= 0.75; r.vz *= 0.75;
        }
      }
      if (!r.grounded || Math.hypot(r.vx, r.vz) > 0.5) { r.model.rotation.x += r.ax * dt; r.model.rotation.z += r.az * dt; }
      else {
        // settle flat on its back or front
        // settle flat on its back or front: pitch goes to an odd quarter turn (never back upright), roll to flat
        const toward = (a, t) => a + (t - a) * Math.min(1, dt * 6);
        const x = r.model.rotation.x;
        r.model.rotation.x = toward(x, Math.round((x - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2);
        r.model.rotation.z = toward(r.model.rotation.z, Math.round(r.model.rotation.z / Math.PI) * Math.PI);
      }
      // floppy limbs
      const flop = Math.max(0, 1 - r.t / 2);
      for (const lb of r.limbs) lb.o.rotation.x += (lb.to + Math.sin(r.t * 12 + lb.ph) * flop - lb.o.rotation.x) * Math.min(1, dt * 8);
      if (r.model.userData.wings) for (const w of r.model.userData.wings) w.rotation.z *= 0.9;
      if (r.t > 6) p.y -= dt * 0.6; // sink into the wax
    }
    for (const r of this.ragdolls) if (r.t > 8) this.entityRoot.remove(r.model);
    this.ragdolls = this.ragdolls.filter((r) => r.t <= 8);
  }

  // ---------------- the last few foes glow through walls ----------------
  updateXray() {
    const w = this.world;
    const on = !!(w && !w.transit && !w.portalOpen && w.left > 0 && w.left <= XRAY_LEFT);
    if (on && !this.xrayOn) { this.ui.banner(`${w.left} FOE${w.left > 1 ? 'S' : ''} LEFT - THEY GLOW THROUGH WALLS`, 2); }
    this.xrayOn = on;
    for (const e of this.enemies.values()) setXray(e.model, on && !e.goneT && e.type !== FINGLER);
    if (on) xrayPulse(this.time);
  }

  // ---------------- revives ----------------
  // back on your feet where you fell (the host decided; this just puts the camera and body back)
  onLocalRevive(at, by) {
    if (!this.downPos && !at) return;
    const p = at || this.downPos;
    this.downPos = null;
    this.dead = false;
    this.mover.noclip = false; this.mover.ducked = false;
    this.mover.teleport(p.x, p.y || 0, p.z);
    this.lastSafe = { x: p.x, y: p.y || 0, z: p.z };
    this.deathCam = null; this.freeCam = false; this.spec = null; this.spectating = null;
    this.sound.play('upgrade');
    this.ui.banner(by ? `${this.net.nameOf(by)} REVIVED YOU` : 'REVIVED', 2);
    this.stats.add('revived');
  }

  // a pillar of light over every downed teammate, so you can find them
  updateDowned(dt) {
    const pl = this.hpMap || {};
    for (const [id, v] of Object.entries(pl)) {
      if (id === this.myId || !v || !v[2] || !(v[6] || v[7])) continue;
      const x = v[6], z = v[7], y = v[8] || 0, f = v[5] || 0;
      if (Math.random() < 0.7) this.particles.emit(x + (Math.random() - 0.5) * 0.5, y + Math.random() * 4, z + (Math.random() - 0.5) * 0.5, 0, 1.5, 0, f > 0 ? 0.4 : 1, 1, f > 0 ? 0.5 : 0.4, 0.07, 0.6, -0.5);
      if (f > 0) for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; this.particles.emit(x + Math.cos(a) * REVIVE.radius * f, y + 0.1, z + Math.sin(a) * REVIVE.radius * f, 0, 0.5, 0, 0.4, 1, 0.5, 0.06, 0.3, 0); }
    }
  }

  // ---------------- spectating ----------------
  aliveOthers() { return [...this.others.entries()].filter(([, o]) => !o.dead).map(([id]) => id).sort(); }
  specTarget() {
    let o = this.spec ? this.others.get(this.spec) : null;
    if (!o || o.dead) {
      const ids = this.aliveOthers();
      this.spec = ids[0] || null;
      o = this.spec ? this.others.get(this.spec) : null;
    }
    return o ? { id: this.spec, o } : null;
  }
  specCycle(dir) {
    const ids = this.aliveOthers();
    if (!ids.length) { this.ui.toast('NOBODY LEFT TO WATCH'); return; }
    this.freeCam = false;
    const i = ids.indexOf(this.spec);
    this.spec = ids[(i + dir + ids.length) % ids.length];
    this.sound.play('ui');
  }
  toggleFreeCam() {
    if (!this.freeCam) {
      const t = this.specTarget();
      if (t) this.mover.teleport(t.o.model.position.x, t.o.model.position.y + 1.2, t.o.model.position.z);
      this.freeCam = true;
      this.ui.toast('FREE CAM - E TO SPECTATE A PLAYER');
    } else { this.freeCam = false; if (!this.aliveOthers().length) this.ui.toast('NOBODY LEFT TO WATCH'); }
  }
  // CAMERA COLLISION: put the camera at (tx,ty,tz), but never through a wall, floor or ceiling. It looks
  // out from a safe anchor (inside the body it follows) and stops short of whatever is in the way,
  // which zooms it in rather than letting it poke through. Returns the position it used.
  safeCamera(ax, ay, az, tx, ty, tz, pad = 0.3) {
    const map = this.world && this.world.map, cam = this.camera.position;
    if (!map) { cam.set(tx, ty, tz); return cam; }
    const tile = (x, z) => { const i = Math.floor(x / T), j = Math.floor(z / T); return i >= 0 && j >= 0 && i < W && j < H ? j * W + i : -1; };
    const ka = tile(ax, az);
    if (ka >= 0 && map.ch) ay = Math.max(map.fh[ka] + 0.15, Math.min(map.ch[ka] - 0.2, ay)); // the anchor itself stays in the room
    let dx = tx - ax, dy = ty - ay, dz = tz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) { cam.set(ax, ay, az); return cam; }
    dx /= len; dy /= len; dz /= len;
    const hit = raycastLevel(map, ax, ay, az, dx, dy, dz, len + pad);
    const t = hit.miss ? len : Math.max(0, Math.min(len, hit.t - pad));
    let x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
    const kc = tile(x, z);
    if (kc >= 0 && map.ch && map.type[kc] !== WALL) y = Math.max(map.fh[kc] + 0.1, Math.min(map.ch[kc] - 0.12, y)); // never above the ceiling or under the floor
    cam.set(x, y, z);
    return cam;
  }

  spectateCamera(o, dt) {
    const p = o.model.position;
    const eyeH = o.riding ? 2.75 : o.ducked ? 0.75 : 1.6;
    const k = Math.min(1, dt * 14);
    let dy = (o.tyaw || 0) - (o.syaw ?? o.tyaw ?? 0);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    o.syaw = (o.syaw ?? o.tyaw ?? 0) + dy * k;
    o.spitch = (o.spitch ?? o.pitch ?? 0) + ((o.pitch || 0) - (o.spitch ?? 0)) * k;
    this.safeCamera(p.x, p.y + 0.9, p.z, p.x, p.y + eyeH, p.z, 0.15);
    this.camera.rotation.set(o.spitch, o.syaw, 0);
    const vfov = 2 * Math.atan(Math.tan((this.settings.fov * Math.PI) / 360) * 0.75) * (180 / Math.PI);
    this.camera.fov = vfov; this.camera.updateProjectionMatrix();
    this.sound.listener = { x: p.x, y: p.y + eyeH, z: p.z, yaw: o.syaw };
    if (this.viewmodel) {
      const v = this.viewmodel.userData;
      const sp = o.speed || 0, bobAmt = Math.min(1, sp / 8);
      this.bobT = (this.bobT || 0) + dt * (6 + sp * 0.6);
      const kick = (this.specKick || 0) ** 2;
      this.viewmodel.position.set(0.2 + Math.sin(this.bobT) * 0.012 * bobAmt, -0.24 - Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt, -0.38 + kick * 0.1);
      this.viewmodel.rotation.set(kick * 0.28, 0.06, 0);
      v.gun.visible = !o.riding; v.jav.visible = !!o.riding; v.stinger.visible = false;
      if (v.bat) { v.bat.visible = false; v.bomb.visible = false; if (v.ball) v.ball.visible = false; }
    }
    if (this.viewHorse) { this.viewHorse.visible = !!o.riding; if (o.riding) animateHorse(this.viewHorse, this.time, o.speed || 0); }
  }

  // ---------------- pings ----------------
  doPing() {
    if (!this.world || this.mode !== 'play' || this.time - (this.lastPingT ?? -9) < 0.6) return;
    this.lastPingT = this.time;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    const o = cam.position;
    const wall = raycastLevel(this.world.map, o.x, o.y, o.z, d.x, d.y, d.z, 80);
    const hit = this.enemyHitAt(o, d, wall.t);
    let x, y, z, label;
    if (hit.e) { const p = hit.e.model.position; x = p.x; y = p.y + 1.5; z = p.z; label = ENEMY_NAMES[hit.e.type] || 'ENEMY'; }
    else { const t = Math.max(0.5, wall.t - 0.2); x = o.x + d.x * t; y = o.y + d.y * t; z = o.z + d.z * t; label = describeSpot(this.world.map, x, z, this.picked); }
    x = r2(x); y = r2(y); z = r2(z);
    this.addPing(this.myId, x, y, z, label);
    this.net.broadcast({ t: 'ping', x, y, z, l: label }, true);
    this.stats.add('pings');
  }
  addPing(from, x, y, z, label) {
    this.pings = this.pings.filter((p) => p.from !== from);
    this.pings.push({ from, x, y, z, label, t: 8 });
    this.sound.play('ping');
  }
  projectToUI(x, y, z) {
    const v = this._pv || (this._pv = new THREE.Vector3());
    v.set(x, y, z);
    this.camera.updateMatrixWorld();
    v.project(this.camera);
    const behind = v.z > 1;
    let sx = (v.x * 0.5 + 0.5) * this.rr.width, sy = (1 - (v.y * 0.5 + 0.5)) * this.rr.height;
    if (behind) { sx = this.rr.width - sx; sy = this.rr.height - 12; }
    return { sx, sy, behind };
  }

  updateLights() {
    const L = sharedUniforms;
    const cam = this.camera.position;
    const set = (i, x, y, z, r, g, b, range) => { L.uLightPos.value[i].set(x, y, z); L.uLightCol.value[i].set(r, g, b); L.uLightRange.value[i] = range; };
    set(0, cam.x, cam.y + 0.2, cam.z, 1.0, 0.85, 0.62, 14 * (1 + this.itemFx('lamp')));
    const th = this.map.theme;
    const lights = this.map.lights.map((l, i) => ({ l, i, d: (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2 })).sort((a, b) => a.d - b.d);
    for (let s = 1; s <= 5; s++) {
      const e = lights[s - 1];
      if (!e) { set(s, 0, -999, 0, 0, 0, 0, 1); continue; }
      const f = 0.9 + Math.sin(this.time * 11 + e.i * 1.7) * 0.06 + Math.sin(this.time * 23 + e.i) * 0.04;
      const tc = e.l.real && REAL_ROOMS[e.l.real] ? REAL_ROOMS[e.l.real].light : th.torch; // a real room has fluorescent tubes, not candles
      const dk = this.world ? this.hmPct('dark', 0.15) : 1;
      set(s, e.l.x, e.l.y + 0.4, e.l.z, tc[0] * 1.25 * f * dk, tc[1] * 1.25 * f * dk, tc[2] * 1.25 * f * dk, 12);
    }
    const ex = this.map.exit;
    const open = this.world ? this.world.portalOpen : true;
    const ey = (ex.y || 0) + (this.map.city ? 3 : 1.5);
    if (open) set(6, ex.x, ey, ex.z, 1.0, 0.8, 0.3, this.map.city ? 16 : 10); else set(6, ex.x, ey, ex.z, 0.1, 0.1, 0.14, 5);
    if (this.flashLight > 0) {
      const p = this.flashPos || cam;
      const f = this.flashLight;
      set(7, p.x, p.y, p.z, 1.6 * f, 1.1 * f, 0.5 * f, this.flashPos ? 9 : 8);
    } else if (this.map.props && this.map.props.length) {
      // the lounge glows
      const pr = this.map.props[0];
      set(7, (this.map.spawn.x + pr.x) / 2, 2.5, (this.map.spawn.z + pr.z) / 2, 0.9, 0.5, 0.7, 11);
    } else set(7, 0, -999, 0, 0, 0, 0, 1);
    void MAX_LIGHTS;
  }
}

function r2(v) { return Math.round(v * 100) / 100; }

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  if (t < 0) return null;
  return t;
}

installFeatures(Game); // the weapon bag, building, clouds, backflips, class picks, cloud saves (features.js)
installFister(Game); // JOHN FISTER (fisterPort.js + src/fister/)
installClasses2(Game, Sim); // SIEGER, KOOLCILLER, INTERCEPTOR, BLASPHEMOUS, PARKOUR, the ULTRAs, the wild EVIL HORSE (classes2.js)
installEconomy(Game); // the post-boss shop, the rooftop clock, starting deeper, newer wafer upgrades (economy.js)
installPorridge(Game); // the PIXEL PORRIDGE EXCLUSIVE SHOP and its flair (porridge.js)
installWishBatch1Client(Game, UI); // the first batch of wishes built by hand (wishbatch1.js)
installWishBatch2Client(Game, UI); // the second batch (wishbatch2.js): after batch 1, it wraps the sidearms
installWishBatch3Client(Game, UI); // the third batch (wishbatch3.js): THE SOAKER, GLARE, lasers
installWishBatch4Client(Game, UI); // the fourth batch (wishbatch4.js): floor shops, the old bee, minimap icons, mobile
installRooftopsClient(Game, UI); // rooftop events, fake hives, shacks, missiles, wire puzzles (rooftops.js)
installBestiaryClient(Game, UI); // the deep floors' foes: models, looks, warnings, frozen floors (bestiary.js)
installBugsClient(Game); // the looks of the reworked bugs (bugs.js; the host side installs itself in sim.js)
installChangelog(UI); // the CHANGELOG in the title screen's left column (changelog.js, changelogUI.js)
installShapeFx(Game); // explosions are spheres, slams are rings on the ground: no particles (shapefx.js)
installWishes(Game, UI); // the PETITION BEE: players wish for what chat builds next (wishes.js)
installSaber(Game); // the LIGHT SABER (saber.js)
installParryFx(Game); // the BEEKEEPER PARRY PUNCH and juicier parries (parryfx.js)
installQuests(Game); // QUESTS: three honey bounties per floor (quests.js)
installPerks(Game); // WEAPON PERKS: what makes a found weapon different (perks.js)
installElites(Game); // THREAT, MINI-ELITES, the cruiser's sulk, people in shirts, fight-start microgames (elites.js)
