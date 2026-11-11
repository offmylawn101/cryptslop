// Hand-made models from the art team (glTF), loaded once at boot and cloned per use.
// Every material is swapped for the retro shader (vertex snapping, banded light, fog) so the art
// sits in the same world as the procedural models. If a file is missing, callers fall back to the
// procedural model, so nothing ever depends on a download finishing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retroMaterial, retroSkinnedMaterial, pixelTexture } from './retro.js';

// h: height in meters once normalized. yaw: turn so the model faces +Z (where enemies look).
// clips: which animation clip plays for idle / move / attack.
export const ASSETS = {
  groundBee: { files: ['groundBee1.gltf'], h: 1.85, yaw: Math.PI, clips: { idle: 'idle', move: 'run', attack: 'run' } },
  flyingBee: { files: ['flyingBee1.gltf'], h: 1.5, yaw: 0, lift: 0.9, clips: { idle: 'idle', move: 'fly', attack: 'fly' } },
  moth: { files: ['moth1.gltf'], len: 1.9, yaw: Math.PI / 2, lift: 1.1, clips: { idle: 'idle', move: 'fly', attack: 'fly' } },
  beehive: { files: ['beehive.gltf'], h: 1.6, yaw: 0, clips: { idle: 'idle', move: 'idle', attack: 'idle' } },
  player: { files: ['player1NoGun.gltf'], h: 1.85, yaw: Math.PI, clips: { idle: 'idle', move: 'walk', attack: 'walk' } },
  playerGun: { files: ['player1WithHornetgun.gltf'], h: 1.85, yaw: Math.PI, clips: { idle: 'idle', move: 'walk', attack: 'walk' } },
  hornetgun: { files: ['hornetgun.gltf'], len: 0.95, clips: null },
  // the KOOLCILLER's bloody knife (long axis Y, blade up)
  coolkiller: { files: ['coolkiller.glb'], len: 0.55, clips: null },
  // the STOMPER: one rig, three files, each file is one animation made of several object clips
  stomper: { files: ['randomlingstomper_idle.glb', 'randomlingstomper_walk.glb', 'randomlingstomper_attack.glb'], h: 2.9, yaw: Math.PI / 2, merge: ['idle', 'move', 'attack'], color: [0.85, 0.85, 0.88], oil: true },
  // the MARAUDER: idle and walk are one clip; its attack winds up (2 s, once) and then spins its blade arms (loop)
  marauder: { files: ['randomlingmarauder_idleandwalk.glb', 'randomlingmarauder_spinwindup.glb', 'randomlingmarauder_spincycle.glb'], h: 2.2, yaw: Math.PI / 2, merge: ['idle', 'windup', 'spin'], clips: { idle: 'idle', move: 'idle', attack: 'windup' }, stateClips: { 2: 'windup', 4: 'spin' }, once: ['windup'], speed: { windup: 1.8 }, color: [0.85, 0.85, 0.88], oil: true },
  // the CRUISER: a cube that tips back, then flops forward onto whatever is in front of it (the attack plays once)
  cruiser: { files: ['randomlingcruiser_idle.glb', 'randomlingcruiser_walk.glb', 'randomlingcruiser_attack.glb'], h: 4.6, yaw: Math.PI / 2, merge: ['idle', 'move', 'attack'], stateClips: { 2: 'attack', 4: 'attack' }, once: ['attack'], speed: { attack: 0.84 }, color: [0.85, 0.85, 0.88], oil: true },
  // John Fister's six-box body, kept in his own avatar space (posed by the Fister port)
  fister: { files: ['john_fister.glb'], raw: true },
};

const loaded = {}; // id -> { scene, clips: {name: AnimationClip}, skinned, norm: {scale, y, yaw} }
export const assetsReady = () => Object.keys(loaded).length > 0;
export const hasAsset = (id) => !!loaded[id];

// the STOMPER's surface: an oily, swirling noise (Blender's procedural texture does not survive export)
let oil = null;
export function oilTexture() {
  if (oil || typeof document === 'undefined') return oil;
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    const n = Math.sin(u * 2 + Math.sin(v * 3) * 1.5) + Math.sin(v * 2 + Math.cos(u * 3) * 1.7) + Math.sin((u + v) * 3) * 0.5;
    const hue = (n * 0.18 + 0.5) % 1, i = (y * N + x) * 4;
    const col = new THREE.Color().setHSL(hue, 0.35, 0.55 + 0.1 * Math.sin(n * 3));
    img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  oil = pixelTexture(c);
  return oil;
}

function retroize(root, tint, useOil) {
  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const map = src && src.map ? src.map : useOil ? oilTexture() : null;
    if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.NoColorSpace; map.needsUpdate = true; }
    const c = src && src.color ? [src.color.r, src.color.g, src.color.b] : [1, 1, 1];
    const color = map ? c : (tint && c[0] === 1 && c[1] === 1 && c[2] === 1 ? tint : c);
    const vc = !!(o.geometry && o.geometry.attributes.color);
    const args = { map, color, vertexColors: vc, side: THREE.DoubleSide };
    const m = o.isSkinnedMesh ? retroSkinnedMaterial(args) : retroMaterial(args);
    m.userData.retroArgs = args; m.userData.skinned = !!o.isSkinnedMesh;
    o.material = m;
    o.frustumCulled = false; // skinned bounds lie; a popped-out enemy is worse than a few extra draws
    mats.push(m);
  });
  return mats;
}

async function loadOne(loader, base, id, cfg) {
  const gltfs = [];
  for (const f of cfg.files) gltfs.push(await loader.loadAsync(base + f));
  const scene = gltfs[0].scene;
  const strip = [];
  scene.traverse((o) => { if (o.isLight || o.isCamera) strip.push(o); });
  for (const o of strip) o.parent.remove(o);
  const clips = {};
  if (cfg.merge) {
    // each file's object actions together make one animation
    cfg.merge.forEach((name, i) => {
      const g = gltfs[i];
      if (!g || !g.animations.length) return;
      // dropArmature: an old export keyed its mirrored armature OBJECT with scale -1,-1,-1 (rest 1,1,-1),
      // which flips that arm and leg upside down; such an asset keeps its armature objects at rest.
      // The fixed files key them with plain scale, and the cruiser's whole-body flop needs them.
      // Tracks for the lights and cameras stripped above are dropped (they have nothing to bind to).
      const names = new Set(); scene.traverse((o) => names.add(o.name));
      const tracks = g.animations.flatMap((a) => a.tracks.filter((t) => (!cfg.dropArmature || !/^Armature[^.]*\./.test(t.name)) && names.has(t.name.slice(0, t.name.lastIndexOf('.')))).map((t) => t.clone()));
      clips[name] = new THREE.AnimationClip(name, -1, tracks);
    });
  } else for (const a of gltfs[0].animations) clips[a.name] = a;
  let skinned = false;
  scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  retroize(scene, cfg.color, cfg.oil);
  // normalize: feet on y=0, centered, scaled to the configured size
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene, true);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  let scale = 1;
  if (cfg.raw) { loaded[id] = { scene, clips, skinned, norm: { scale: 1, cx: 0, cy: 0, cz: 0, mid: 0 }, cfg, size }; return; }
  if (cfg.h) scale = cfg.h / Math.max(0.01, size.y);
  if (cfg.len) scale = cfg.len / Math.max(0.01, Math.max(size.x, size.y, size.z));
  loaded[id] = { scene, clips, skinned, norm: { scale, cx: c.x, cy: box.min.y, cz: c.z, mid: c.y }, cfg, size };
}

export async function loadAssets(base = './models/', onProgress) {
  const loader = new GLTFLoader();
  const ids = Object.keys(ASSETS);
  let n = 0;
  await Promise.all(ids.map(async (id) => {
    try { await loadOne(loader, base, id, ASSETS[id]); } catch (e) { console.warn('[cryptslop] asset failed', id, e && e.message); }
    n++; if (onProgress) onProgress(n / ids.length);
  }));
}

// A fresh copy of an asset, ready to drop in the world. Returns null if it never loaded.
// userData: { mats, mixer, actions, kind: 'gltf', play(name) }
export function makeAsset(id, { center = false } = {}) {
  const L = loaded[id];
  if (!L) return null;
  const inner = L.skinned ? skeletonClone(L.scene) : L.scene.clone(true);
  const mats = [];
  inner.traverse((o) => {
    if (!o.isMesh) return;
    // per-instance materials (hit flashes must not light up every copy), built fresh so the
    // shared light/fog uniforms stay shared (cloning a material would copy them)
    const u = o.material.userData;
    o.material = u.skinned ? retroSkinnedMaterial(u.retroArgs) : retroMaterial(u.retroArgs);
    o.material.userData = u;
    mats.push(o.material);
  });
  const s = L.norm.scale;
  inner.scale.multiplyScalar(s);
  inner.position.set(-L.norm.cx * s, -(center ? L.norm.mid : L.norm.cy) * s, -L.norm.cz * s);
  const pivot = new THREE.Group(); pivot.add(inner);
  pivot.rotation.y = L.cfg.yaw || 0;
  const g = new THREE.Group(); g.add(pivot);
  if (L.cfg.lift) pivot.position.y = L.cfg.lift;
  let mixer = null; const actions = {};
  if (Object.keys(L.clips).length) {
    mixer = new THREE.AnimationMixer(inner);
    for (const [name, clip] of Object.entries(L.clips)) {
      const a = actions[name] = mixer.clipAction(clip);
      if ((L.cfg.once || []).includes(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      if (L.cfg.speed && L.cfg.speed[name]) a.timeScale = L.cfg.speed[name];
    }
  }
  const ud = { mats, mixer, actions, kind: 'gltf', asset: id, cur: null, pivot, inner, stateClip: L.cfg.stateClips || null };
  ud.play = (logical, fade = 0.2) => {
    const map = L.cfg.clips || {};
    const name = map[logical] || logical;
    const a = actions[name] || actions[logical];
    if (!a || ud.cur === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (ud.cur) ud.cur.fadeOut(fade);
    ud.cur = a;
  };
  g.userData = ud;
  ud.play('idle', 0);
  return g;
}

// step a glTF model's animation from the enemy state (0 idle, 1 move, 2 windup/attack, 3 stunned)
export function animateAsset(model, moving, state, dt) {
  const u = model.userData;
  if (!u.mixer) return;
  const sc = model.userData.stateClip && model.userData.stateClip[state];
  u.play(sc || (state === 2 ? 'attack' : moving ? 'move' : 'idle'));
  u.mixer.update(state === 3 ? dt * 0.3 : dt);
  u.pivot.rotation.z = state === 3 ? Math.sin(performance.now() / 110) * 0.2 : 0;
}
