// Low-poly models built from primitives. Flat shaded, a handful of triangles each. Everything is a bug now.
import * as THREE from 'three';
import { retroMaterial, pixelTexture } from './retro.js';
import { drawText, textWidth } from './font.js';
import { makeAsset, animateAsset } from './assets.js';
import { SHIRTS } from './npcs.js';

function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

function part(group, geo, color, { emissive = [0, 0, 0], pos = [0, 0, 0], rot = [0, 0, 0], scale = null, mats = null, opacity = 1 } = {}) {
  const m = retroMaterial({ color, emissive, transparent: opacity < 1, opacity, side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide });
  if (opacity < 1) m.depthWrite = false;
  const mesh = new THREE.Mesh(flat(geo), m);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  if (scale) mesh.scale.set(...scale);
  group.add(mesh);
  if (mats) mats.push(m);
  return mesh;
}

// limb hanging from a pivot so it can swing
function limb(group, w, h, d, color, pivot, mats) {
  const pv = new THREE.Group();
  pv.position.set(...pivot);
  group.add(pv);
  part(pv, new THREE.BoxGeometry(w, h, d), color, { pos: [0, -h / 2, 0], mats });
  return pv;
}

// a pair of translucent wings on pivots; returns [left, right]
function wings(group, len, wid, pos, mats, tint = [0.85, 0.95, 1]) {
  const out = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(...pos); group.add(pv);
    part(pv, new THREE.BoxGeometry(len, 0.02, wid), tint, { emissive: tint.map((v) => v * 0.25), pos: [s * len / 2, 0, -wid * 0.2], mats, opacity: 0.45 });
    out.push(pv);
  }
  return out;
}

// a striped abdomen made of boxes, tapering to a stinger
function abdomen(group, len, rad, a, b, pos, rot, mats) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); group.add(g);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const r = rad * (1 - i * 0.16);
    part(g, new THREE.BoxGeometry(r * 2, r * 2, len / n + 0.01), i % 2 ? b : a, { pos: [0, 0, -(i + 0.5) * len / n], mats });
  }
  part(g, new THREE.ConeGeometry(rad * 0.3, rad * 1.2, 4), [0.15, 0.12, 0.1], { pos: [0, 0, -len - rad * 0.5], rot: [-Math.PI / 2, 0, 0], mats });
  return g;
}

const YEL = [1.0, 0.78, 0.15], BLK = [0.12, 0.09, 0.06];

export function makeGrunt() { // WORKER WASP: walks upright, claws out
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.12, 0.8, 0.12, BLK, [-0.17, 0.8, 0], mats);
  const legR = limb(body, 0.12, 0.8, 0.12, BLK, [0.17, 0.8, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.8, 0); torso.rotation.x = 0.35; body.add(torso);
  part(torso, new THREE.BoxGeometry(0.5, 0.55, 0.42), [0.95, 0.75, 0.1], { pos: [0, 0.32, 0], mats });
  part(torso, new THREE.BoxGeometry(0.52, 0.12, 0.44), BLK, { pos: [0, 0.2, 0], mats });
  abdomen(torso, 0.7, 0.24, YEL, BLK, [0, 0.15, -0.2], [0.6, 0, 0], mats);
  part(torso, new THREE.IcosahedronGeometry(0.26, 0), [0.95, 0.75, 0.1], { pos: [0, 0.8, 0.12], mats });
  part(torso, new THREE.IcosahedronGeometry(0.11, 0), [0, 0, 0], { emissive: [1, 0.15, 0.1], pos: [-0.13, 0.84, 0.3], mats });
  part(torso, new THREE.IcosahedronGeometry(0.11, 0), [0, 0, 0], { emissive: [1, 0.15, 0.1], pos: [0.13, 0.84, 0.3], mats });
  part(torso, new THREE.BoxGeometry(0.02, 0.35, 0.02), BLK, { pos: [-0.08, 1.12, 0.22], rot: [0.5, 0, -0.3], mats });
  part(torso, new THREE.BoxGeometry(0.02, 0.35, 0.02), BLK, { pos: [0.08, 1.12, 0.22], rot: [0.5, 0, 0.3], mats });
  const armL = limb(torso, 0.1, 0.7, 0.1, BLK, [-0.32, 0.55, 0], mats);
  const armR = limb(torso, 0.1, 0.7, 0.1, BLK, [0.32, 0.55, 0], mats);
  part(armL, new THREE.ConeGeometry(0.08, 0.25, 4), [0.9, 0.85, 0.7], { pos: [0, -0.8, 0.04], rot: [Math.PI, 0, 0], mats });
  part(armR, new THREE.ConeGeometry(0.08, 0.25, 4), [0.9, 0.85, 0.7], { pos: [0, -0.8, 0.04], rot: [Math.PI, 0, 0], mats });
  const wg = wings(torso, 0.6, 0.25, [0, 0.55, -0.15], mats);
  g.userData = { mats, legL, legR, armL, armR, body, wings: wg, kind: 'walker', stride: 9 };
  return g;
}

export function makeSpitter() { // HORNET: hovers, spits venom from a forward stinger
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 1.6; g.add(body);
  part(body, new THREE.OctahedronGeometry(0.45, 0), [0.75, 0.25, 0.1], { mats });
  abdomen(body, 1.0, 0.36, [0.9, 0.35, 0.08], BLK, [0, -0.05, -0.2], [0.25, 0, 0], mats);
  part(body, new THREE.IcosahedronGeometry(0.28, 0), [0.8, 0.3, 0.1], { pos: [0, 0.08, 0.45], mats });
  part(body, new THREE.BoxGeometry(0.14, 0.12, 0.06), [0, 0, 0], { emissive: [1, 0.85, 0.1], pos: [-0.12, 0.14, 0.68], mats });
  part(body, new THREE.BoxGeometry(0.14, 0.12, 0.06), [0, 0, 0], { emissive: [1, 0.85, 0.1], pos: [0.12, 0.14, 0.68], mats });
  part(body, new THREE.ConeGeometry(0.07, 0.4, 4), [0.2, 0.1, 0.05], { emissive: [0.6, 1, 0.2], pos: [0, -0.1, 0.8], rot: [Math.PI / 2, 0, 0], mats });
  const tents = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    tents.push(limb(body, 0.05, 0.6, 0.05, BLK, [Math.cos(a) * 0.2, -0.35, Math.sin(a) * 0.2 + 0.1], mats));
  }
  const wg = wings(body, 0.9, 0.35, [0, 0.4, 0], mats);
  g.userData = { mats, body, tents, wings: wg, kind: 'floater' };
  return g;
}

export function makeBrute() { // BEETLE: armored rhino beetle on two legs
  const g = new THREE.Group(); const mats = [];
  const shell = [0.18, 0.32, 0.38], dark = [0.08, 0.12, 0.14];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.32, 0.95, 0.34, dark, [-0.33, 0.95, 0], mats);
  const legR = limb(body, 0.32, 0.95, 0.34, dark, [0.33, 0.95, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.95, 0); torso.rotation.x = 0.25; body.add(torso);
  part(torso, new THREE.BoxGeometry(1.25, 1.05, 0.8), shell, { emissive: [0.03, 0.08, 0.1], pos: [0, 0.6, 0], mats });
  part(torso, new THREE.BoxGeometry(1.35, 0.9, 0.5), [0.25, 0.45, 0.55], { pos: [0, 0.7, -0.45], mats }); // wing case
  part(torso, new THREE.BoxGeometry(0.06, 0.9, 0.52), dark, { pos: [0, 0.7, -0.45], mats });
  part(torso, new THREE.BoxGeometry(0.55, 0.45, 0.5), shell, { pos: [0, 1.3, 0.18], mats });
  part(torso, new THREE.ConeGeometry(0.13, 0.75, 4), [0.1, 0.12, 0.1], { pos: [0, 1.62, 0.5], rot: [0.9, 0, 0], mats }); // the horn
  part(torso, new THREE.BoxGeometry(0.34, 0.06, 0.05), [0, 0, 0], { emissive: [1, 0.5, 0.1], pos: [0, 1.36, 0.44], mats });
  const armL = limb(torso, 0.3, 1.1, 0.3, dark, [-0.8, 1.0, 0], mats);
  const armR = limb(torso, 0.3, 1.1, 0.3, dark, [0.8, 1.0, 0], mats);
  part(armL, new THREE.BoxGeometry(0.46, 0.4, 0.46), shell, { pos: [0, -1.15, 0], mats });
  part(armR, new THREE.BoxGeometry(0.46, 0.4, 0.46), shell, { pos: [0, -1.15, 0], mats });
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 6 };
  return g;
}

export function makeWarden() { // THE WASP QUEEN
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 2.5; g.add(body);
  part(body, new THREE.DodecahedronGeometry(1.3, 0), [0.95, 0.7, 0.1], { mats });
  abdomen(body, 3.2, 1.0, YEL, BLK, [0, -0.4, -0.6], [0.5, 0, 0], mats);
  part(body, new THREE.IcosahedronGeometry(0.75, 0), [0.9, 0.65, 0.1], { pos: [0, 0.5, 1.2], mats });
  part(body, new THREE.IcosahedronGeometry(0.3, 0), [0, 0, 0], { emissive: [1, 0.1, 0.05], pos: [-0.35, 0.65, 1.75], mats });
  part(body, new THREE.IcosahedronGeometry(0.3, 0), [0, 0, 0], { emissive: [1, 0.1, 0.05], pos: [0.35, 0.65, 1.75], mats });
  for (let k = 0; k < 4; k++) {
    const a = -0.6 + k * 0.4;
    part(body, new THREE.ConeGeometry(0.1, 0.9, 4), BLK, { pos: [Math.sin(a) * 0.8, -1.2, Math.cos(a) * 0.6], rot: [Math.PI, 0, 0], mats });
  }
  const crown = new THREE.Group(); crown.position.set(0, 1.35, 1.1); body.add(crown);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    part(crown, new THREE.ConeGeometry(0.14, 0.45, 4), [0.3, 0.25, 0.05], { emissive: [1, 0.8, 0.1], pos: [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6], mats });
  }
  const armL = limb(body, 0.3, 1.8, 0.3, BLK, [-1.4, 0.3, 0.4], mats);
  const armR = limb(body, 0.3, 1.8, 0.3, BLK, [1.4, 0.3, 0.4], mats);
  const wg = wings(body, 2.6, 1.0, [0, 1.1, -0.3], mats);
  g.userData = { mats, body, crown, armL, armR, wings: wg, kind: 'boss' };
  return g;
}

export function makeIdol() { // VOX POPULI: an original holographic idol hornet with a microphone
  const g = new THREE.Group(); const mats = [];
  const holo = [0.95, 0.35, 0.85], glowc = [1, 0.4, 0.9];
  const body = new THREE.Group(); body.position.y = 2.2; g.add(body);
  part(body, new THREE.OctahedronGeometry(0.9, 0), holo, { emissive: glowc.map((v) => v * 0.35), mats });
  abdomen(body, 2.2, 0.7, [1, 0.8, 0.95], [0.4, 0.1, 0.5], [0, -0.3, -0.4], [0.5, 0, 0], mats);
  // skirt of light
  part(body, new THREE.ConeGeometry(1.3, 1.4, 6, 1, true), [0, 0, 0], { emissive: [0.5, 0.15, 0.6], pos: [0, -1.2, 0], mats, opacity: 0.5 });
  const head = new THREE.Group(); head.position.set(0, 1.25, 0.2); body.add(head);
  part(head, new THREE.IcosahedronGeometry(0.6, 0), holo, { emissive: glowc.map((v) => v * 0.3), mats });
  part(head, new THREE.BoxGeometry(1.0, 0.22, 0.1), [0, 0, 0], { emissive: [1, 0.95, 0.4], pos: [0, 0.05, 0.55], mats }); // star visor
  for (const s of [-1, 1]) { // star-shaped hair buns, not anyone's twin-tails
    part(head, new THREE.OctahedronGeometry(0.3, 0), [0, 0, 0], { emissive: [1, 0.85, 0.2], pos: [s * 0.55, 0.45, -0.1], mats });
  }
  const mic = new THREE.Group(); mic.position.set(0.9, 0.3, 0.6); body.add(mic);
  part(mic, new THREE.BoxGeometry(0.08, 0.6, 0.08), [0.2, 0.2, 0.25], { pos: [0, -0.2, 0], mats });
  part(mic, new THREE.IcosahedronGeometry(0.16, 0), [0, 0, 0], { emissive: [0.9, 0.9, 1], pos: [0, 0.15, 0], mats });
  const armL = limb(body, 0.22, 1.4, 0.22, holo, [-1.0, 0.4, 0.2], mats);
  const armR = limb(body, 0.22, 1.4, 0.22, holo, [1.0, 0.4, 0.2], mats);
  const wg = wings(body, 2.2, 0.9, [0, 0.8, -0.3], mats, [1, 0.6, 1]);
  // floating music notes orbiting her
  const notes = [];
  for (let k = 0; k < 6; k++) notes.push(part(g, new THREE.BoxGeometry(0.18, 0.18, 0.05), [0, 0, 0], { emissive: k % 2 ? [0.4, 1, 1] : [1, 0.4, 0.9], mats }));
  g.userData = { mats, body, crown: head, armL, armR, wings: wg, notes, mic, kind: 'idol' };
  return g;
}

export function makeKnife() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.BoxGeometry(0.03, 0.06, 0.32), [0.85, 0.85, 0.9], { emissive: [0.35, 0.35, 0.4], pos: [0, 0, -0.16], mats });
  part(g, new THREE.BoxGeometry(0.05, 0.05, 0.14), [0.25, 0.15, 0.08], { pos: [0, 0, 0.06], mats });
  part(g, new THREE.BoxGeometry(0.1, 0.02, 0.02), [0.6, 0.5, 0.2], { pos: [0, 0, -0.01], mats });
  g.userData = { mats };
  return g;
}

export function makeMolotov() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.CylinderGeometry(0.07, 0.08, 0.22, 6), [0.3, 0.6, 0.2], { emissive: [0.1, 0.25, 0.05], mats, opacity: 0.85 });
  part(g, new THREE.CylinderGeometry(0.025, 0.035, 0.1, 5), [0.3, 0.6, 0.2], { pos: [0, 0.15, 0], mats });
  part(g, new THREE.BoxGeometry(0.04, 0.06, 0.04), [0, 0, 0], { emissive: [1, 0.5, 0.1], pos: [0, 0.23, 0], mats }); // the burning rag
  g.userData = { mats };
  return g;
}

export function makeBomb() { // a GRENADER's honey bomb: a wax ball with a lit fuse
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.IcosahedronGeometry(0.16, 0), [1, 0.7, 0.15], { emissive: [0.4, 0.25, 0.02], mats });
  part(g, new THREE.BoxGeometry(0.34, 0.05, 0.05), [0.15, 0.1, 0.05], { mats });
  part(g, new THREE.BoxGeometry(0.03, 0.12, 0.03), [0.3, 0.25, 0.2], { pos: [0, 0.2, 0], mats });
  part(g, new THREE.BoxGeometry(0.05, 0.05, 0.05), [0, 0, 0], { emissive: [1, 0.9, 0.4], pos: [0, 0.28, 0], mats });
  g.userData = { mats };
  return g;
}

export function makeSpinBall(golden) { // a spinning wax ball that curves and ricochets
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.IcosahedronGeometry(0.16, 0), golden ? [1, 0.85, 0.2] : [0.75, 0.7, 0.6], { emissive: golden ? [1, 0.75, 0.1] : [0.25, 0.22, 0.18], mats });
  part(g, new THREE.TorusGeometry(0.19, 0.025, 3, 8), [0, 0, 0], { emissive: golden ? [1, 1, 0.6] : [0.6, 0.5, 0.3], mats });
  g.userData = { mats };
  return g;
}

export function makeMoth() {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 1.2; g.add(body);
  part(body, new THREE.BoxGeometry(0.26, 0.26, 0.7), [0.55, 0.48, 0.4], { mats });
  part(body, new THREE.IcosahedronGeometry(0.18, 0), [0.6, 0.55, 0.45], { pos: [0, 0.05, 0.38], mats });
  part(body, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [1, 1, 0.6], pos: [-0.08, 0.1, 0.55], mats });
  part(body, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [1, 1, 0.6], pos: [0.08, 0.1, 0.55], mats });
  const tents = [limb(body, 0.03, 0.4, 0.03, [0.3, 0.25, 0.2], [0, -0.12, 0.1], mats)];
  const wg = wings(body, 0.8, 0.6, [0, 0.12, 0], mats, [0.85, 0.75, 0.6]);
  g.userData = { mats, body, tents, wings: wg, kind: 'floater' };
  return g;
}

export function makeMantis() {
  const g = new THREE.Group(); const mats = [];
  const green = [0.35, 0.75, 0.25], dark = [0.2, 0.45, 0.15];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.08, 0.9, 0.08, dark, [-0.2, 0.9, 0], mats);
  const legR = limb(body, 0.08, 0.9, 0.08, dark, [0.2, 0.9, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.9, 0); torso.rotation.x = 0.5; body.add(torso);
  part(torso, new THREE.BoxGeometry(0.25, 0.9, 0.25), green, { pos: [0, 0.45, 0], mats });
  part(torso, new THREE.BoxGeometry(0.3, 0.2, 0.7), green, { pos: [0, 0, -0.35], mats });
  part(torso, new THREE.ConeGeometry(0.2, 0.3, 3), green, { pos: [0, 1.0, 0.05], rot: [Math.PI, 0, 0], mats });
  part(torso, new THREE.BoxGeometry(0.07, 0.07, 0.04), [0, 0, 0], { emissive: [0.9, 1, 0.3], pos: [-0.12, 1.05, 0.12], mats });
  part(torso, new THREE.BoxGeometry(0.07, 0.07, 0.04), [0, 0, 0], { emissive: [0.9, 1, 0.3], pos: [0.12, 1.05, 0.12], mats });
  const armL = limb(torso, 0.08, 0.8, 0.08, green, [-0.2, 0.75, 0.1], mats);
  const armR = limb(torso, 0.08, 0.8, 0.08, green, [0.2, 0.75, 0.1], mats);
  part(armL, new THREE.ConeGeometry(0.06, 0.5, 3), [0.9, 1, 0.7], { pos: [0, -0.95, 0.1], rot: [Math.PI * 0.8, 0, 0], mats });
  part(armR, new THREE.ConeGeometry(0.06, 0.5, 3), [0.9, 1, 0.7], { pos: [0, -0.95, 0.1], rot: [Math.PI * 0.8, 0, 0], mats });
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 8 };
  return g;
}

export function makeSpider() {
  const g = new THREE.Group(); const mats = [];
  const blk = [0.12, 0.1, 0.12];
  const body = new THREE.Group(); g.add(body);
  part(body, new THREE.IcosahedronGeometry(0.55, 0), blk, { pos: [0, 0.7, -0.3], mats });
  part(body, new THREE.IcosahedronGeometry(0.3, 0), [0.2, 0.15, 0.2], { pos: [0, 0.65, 0.3], mats });
  for (let k = 0; k < 4; k++) part(body, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [1, 0.1, 0.1], pos: [-0.12 + (k % 2) * 0.24, 0.72 + Math.floor(k / 2) * 0.1, 0.56], mats });
  part(body, new THREE.BoxGeometry(0.4, 0.05, 0.2), [0.8, 0.1, 0.1], { pos: [0, 0.95, -0.3], mats }); // red hourglass stripe
  const legs = [];
  for (let k = 0; k < 8; k++) {
    const side = k < 4 ? -1 : 1, n = k % 4;
    const pv = new THREE.Group(); pv.position.set(side * 0.3, 0.7, 0.25 - n * 0.2); body.add(pv);
    part(pv, new THREE.BoxGeometry(0.75, 0.05, 0.05), blk, { pos: [side * 0.35, 0.15, 0], rot: [0, 0, side * 0.6], mats });
    part(pv, new THREE.BoxGeometry(0.05, 0.75, 0.05), blk, { pos: [side * 0.72, -0.15, 0], mats });
    legs.push(pv);
  }
  const legL = legs[0], legR = legs[4], armL = legs[1], armR = legs[5];
  g.userData = { mats, legL, legR, armL, armR, body, legs, kind: 'walker', stride: 12 };
  return g;
}

export function makeFirefly() {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 1.0; g.add(body);
  part(body, new THREE.BoxGeometry(0.25, 0.25, 0.45), [0.2, 0.18, 0.1], { mats });
  const glow = part(body, new THREE.IcosahedronGeometry(0.24, 0), [0, 0, 0], { emissive: [1, 0.9, 0.2], pos: [0, -0.02, -0.3], mats });
  const tents = [limb(body, 0.03, 0.3, 0.03, [0.2, 0.2, 0.1], [0, -0.12, 0.1], mats)];
  const wg = wings(body, 0.5, 0.3, [0, 0.12, 0.05], mats);
  g.userData = { mats, body, tents, wings: wg, glow, kind: 'floater' };
  return g;
}

export function makeTermite() {
  const g = new THREE.Group(); const mats = [];
  const tan = [0.85, 0.7, 0.45];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.05, 0.35, 0.05, [0.5, 0.35, 0.2], [-0.1, 0.35, 0], mats);
  const legR = limb(body, 0.05, 0.35, 0.05, [0.5, 0.35, 0.2], [0.1, 0.35, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.35, 0); body.add(torso);
  part(torso, new THREE.BoxGeometry(0.3, 0.25, 0.55), tan, { pos: [0, 0.12, -0.1], mats });
  part(torso, new THREE.BoxGeometry(0.28, 0.22, 0.25), [0.6, 0.35, 0.15], { pos: [0, 0.18, 0.28], mats });
  const armL = limb(torso, 0.04, 0.2, 0.04, [0.4, 0.2, 0.1], [-0.08, 0.15, 0.42], mats);
  const armR = limb(torso, 0.04, 0.2, 0.04, [0.4, 0.2, 0.1], [0.08, 0.15, 0.42], mats);
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 16 };
  return g;
}

export function makeScorpion() {
  const g = new THREE.Group(); const mats = [];
  const red = [0.55, 0.2, 0.12], dark = [0.3, 0.1, 0.06];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.12, 0.6, 0.12, dark, [-0.5, 0.6, 0], mats);
  const legR = limb(body, 0.12, 0.6, 0.12, dark, [0.5, 0.6, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.6, 0); body.add(torso);
  part(torso, new THREE.BoxGeometry(1.1, 0.45, 1.3), red, { pos: [0, 0.2, 0], mats });
  for (let k = 0; k < 4; k++) part(torso, new THREE.BoxGeometry(0.35 - k * 0.05, 0.3, 0.35), red, { pos: [0, 0.45 + k * 0.32, -0.75 - k * 0.12 + (k > 2 ? 0.3 : 0)], mats });
  part(torso, new THREE.ConeGeometry(0.12, 0.45, 4), [0.2, 0.2, 0.1], { emissive: [0.6, 1, 0.2], pos: [0, 1.75, -0.6], rot: [-2.2, 0, 0], mats });
  const armL = limb(torso, 0.15, 0.7, 0.15, red, [-0.6, 0.3, 0.6], mats);
  const armR = limb(torso, 0.15, 0.7, 0.15, red, [0.6, 0.3, 0.6], mats);
  part(armL, new THREE.BoxGeometry(0.35, 0.2, 0.4), dark, { pos: [0, -0.75, 0.1], mats });
  part(armR, new THREE.BoxGeometry(0.35, 0.2, 0.4), dark, { pos: [0, -0.75, 0.1], mats });
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 7 };
  return g;
}

export function makeRoach() {
  const g = new THREE.Group(); const mats = [];
  const brown = [0.45, 0.25, 0.12];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.05, 0.3, 0.05, [0.25, 0.12, 0.05], [-0.3, 0.3, 0], mats);
  const legR = limb(body, 0.05, 0.3, 0.05, [0.25, 0.12, 0.05], [0.3, 0.3, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.3, 0); body.add(torso);
  part(torso, new THREE.BoxGeometry(0.7, 0.22, 1.0), brown, { pos: [0, 0.08, -0.05], mats });
  part(torso, new THREE.BoxGeometry(0.72, 0.06, 0.9), [0.6, 0.35, 0.15], { pos: [0, 0.21, -0.08], mats }); // shiny wing cases
  part(torso, new THREE.BoxGeometry(0.4, 0.16, 0.22), [0.3, 0.15, 0.08], { pos: [0, 0.06, 0.52], mats });
  const armL = limb(torso, 0.02, 0.6, 0.02, [0.3, 0.2, 0.1], [-0.08, 0.15, 0.62], mats); armL.rotation.x = -1.2;
  const armR = limb(torso, 0.02, 0.6, 0.02, [0.3, 0.2, 0.1], [0.08, 0.15, 0.62], mats); armR.rotation.x = -1.2;
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 18 };
  return g;
}

export function makeLocust() {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 1.4; g.add(body);
  part(body, new THREE.BoxGeometry(0.28, 0.3, 0.9), [0.5, 0.65, 0.2], { mats });
  part(body, new THREE.BoxGeometry(0.3, 0.32, 0.3), [0.45, 0.55, 0.15], { pos: [0, 0.06, 0.5], mats });
  part(body, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [1, 0.2, 0.1], pos: [-0.1, 0.12, 0.66], mats });
  part(body, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [1, 0.2, 0.1], pos: [0.1, 0.12, 0.66], mats });
  const tents = [limb(body, 0.04, 0.55, 0.04, [0.35, 0.45, 0.1], [0, -0.1, -0.2], mats)];
  const wg = wings(body, 0.9, 0.35, [0, 0.16, -0.1], mats, [0.7, 0.85, 0.5]);
  g.userData = { mats, body, tents, wings: wg, kind: 'floater' };
  return g;
}

export function makeStag() {
  const g = new THREE.Group(); const mats = [];
  const blk = [0.12, 0.1, 0.14], shine = [0.3, 0.2, 0.35];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.12, 0.55, 0.12, blk, [-0.55, 0.55, 0], mats);
  const legR = limb(body, 0.12, 0.55, 0.12, blk, [0.55, 0.55, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 0.55, 0); body.add(torso);
  part(torso, new THREE.BoxGeometry(1.2, 0.7, 1.5), blk, { pos: [0, 0.3, -0.1], mats });
  part(torso, new THREE.BoxGeometry(1.22, 0.1, 1.4), shine, { pos: [0, 0.68, -0.15], mats });
  part(torso, new THREE.BoxGeometry(0.7, 0.45, 0.45), blk, { pos: [0, 0.35, 0.8], mats });
  const armL = limb(torso, 0.1, 0.9, 0.1, shine, [-0.3, 0.5, 0.95], mats); armL.rotation.x = -1.3; armL.rotation.z = 0.3;
  const armR = limb(torso, 0.1, 0.9, 0.1, shine, [0.3, 0.5, 0.95], mats); armR.rotation.x = -1.3; armR.rotation.z = -0.3;
  part(torso, new THREE.BoxGeometry(0.08, 0.08, 0.04), [0, 0, 0], { emissive: [1, 0.6, 0.1], pos: [-0.2, 0.45, 1.03], mats });
  part(torso, new THREE.BoxGeometry(0.08, 0.08, 0.04), [0, 0, 0], { emissive: [1, 0.6, 0.1], pos: [0.2, 0.45, 1.03], mats });
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 7 };
  return g;
}

// the FINGLER: a level-2 Menger sponge, all 400 cubes merged into one mesh
export function mengerGeometry(size, level) {
  let cubes = [[0, 0, 0]], s = size;
  for (let l = 0; l < level; l++) {
    s /= 3; const next = [];
    for (const [cx, cy, cz] of cubes) for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if ((x === 0) + (y === 0) + (z === 0) >= 2) continue; // knock out the centers and the core
      next.push([cx + x * s, cy + y * s, cz + z * s]);
    }
    cubes = next;
  }
  const box = new THREE.BoxGeometry(s, s, s).toNonIndexed();
  const bp = box.attributes.position.array, bn = box.attributes.normal.array, bu = box.attributes.uv.array;
  const pos = new Float32Array(bp.length * cubes.length), nrm = new Float32Array(bn.length * cubes.length), uv = new Float32Array(bu.length * cubes.length);
  cubes.forEach(([cx, cy, cz], n) => {
    for (let i = 0; i < bp.length; i += 3) { pos[n * bp.length + i] = bp[i] + cx; pos[n * bp.length + i + 1] = bp[i + 1] + cy; pos[n * bp.length + i + 2] = bp[i + 2] + cz; }
    nrm.set(bn, n * bn.length); uv.set(bu, n * bu.length);
  });
  box.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  g.userData = { cubes: cubes.length };
  return g;
}

export function makeFingler() {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 1.0; g.add(body);
  part(body, mengerGeometry(1.8, 2), [0.95, 0.9, 0.8], { emissive: [0.3, 0.2, 0.35], mats });
  const tag = makeNameTag('FINGLER', '#ff80ff'); tag.position.y = 2.5; g.add(tag);
  g.userData = { mats, body, kind: 'floater', fingler: true };
  return g;
}

// ---- a generic bug walker / flyer kit for the third wave of foes ----
function bugWalker({ len, wid, hgt, col, head, legH, eye = [1, 0.3, 0.1], stride = 10, segs = 1, extra }) {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.06, legH, 0.06, col.map((v) => v * 0.6), [-wid * 0.55, legH, 0], mats);
  const legR = limb(body, 0.06, legH, 0.06, col.map((v) => v * 0.6), [wid * 0.55, legH, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, legH, 0); body.add(torso);
  for (let k = 0; k < segs; k++) part(torso, new THREE.BoxGeometry(wid * (1 - k * 0.04), hgt, len / segs * 0.95), k % 2 ? col.map((v) => v * 0.8) : col, { pos: [0, hgt / 2, len / 2 - (k + 0.5) * (len / segs)], mats });
  part(torso, new THREE.BoxGeometry(wid * 0.6, hgt * 0.8, head), col.map((v) => v * 0.7), { pos: [0, hgt * 0.45, len / 2 + head / 2], mats });
  for (const sx of [-1, 1]) part(torso, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: eye, pos: [sx * wid * 0.2, hgt * 0.6, len / 2 + head + 0.01], mats });
  const armL = limb(torso, 0.04, 0.3, 0.04, col.map((v) => v * 0.5), [-wid * 0.2, hgt * 0.4, len / 2 + head], mats); armL.rotation.x = -1.2;
  const armR = limb(torso, 0.04, 0.3, 0.04, col.map((v) => v * 0.5), [wid * 0.2, hgt * 0.4, len / 2 + head], mats); armR.rotation.x = -1.2;
  if (extra) extra(torso, mats);
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride };
  return g;
}
function bugFlyer({ len, wid, col, y, eye = [1, 0.3, 0.1], wing = [0.8, 0.9, 1], wlen = 0.6, extra }) {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = y; g.add(body);
  part(body, new THREE.BoxGeometry(wid, wid, len), col, { mats });
  part(body, new THREE.BoxGeometry(wid * 1.1, wid * 1.1, wid * 1.1), col.map((v) => v * 0.8), { pos: [0, 0.02, len / 2 + wid * 0.5], mats });
  for (const sx of [-1, 1]) part(body, new THREE.BoxGeometry(0.05, 0.05, 0.04), [0, 0, 0], { emissive: eye, pos: [sx * wid * 0.3, wid * 0.25, len / 2 + wid], mats });
  const tents = [limb(body, 0.03, 0.3, 0.03, col.map((v) => v * 0.5), [0, -wid / 2, 0], mats)];
  const wg = wings(body, wlen, wlen * 0.4, [0, wid / 2, 0], mats, wing);
  if (extra) extra(body, mats);
  g.userData = { mats, body, tents, wings: wg, kind: 'floater' };
  return g;
}
export const makeLeech = () => bugWalker({ len: 1.2, wid: 0.5, hgt: 0.4, col: [0.25, 0.12, 0.18], head: 0.25, legH: 0.08, eye: [1, 0.1, 0.2], stride: 4, segs: 4 });
export function makeGnat() { // four tiny gnats in one: the cloud moves as one foe
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 1.3; g.add(body);
  for (let k = 0; k < 4; k++) part(body, new THREE.BoxGeometry(0.12, 0.1, 0.16), [0.2, 0.2, 0.15], { emissive: [0.1, 0.1, 0.05], pos: [Math.sin(k * 1.7) * 0.25, Math.cos(k * 2.3) * 0.15, Math.cos(k * 1.1) * 0.25], mats });
  const wg = wings(body, 0.25, 0.1, [0, 0.08, 0], mats, [0.9, 0.9, 0.9]);
  g.userData = { mats, body, tents: [], wings: wg, kind: 'floater' };
  return g;
}
export const makeBombardier = () => bugWalker({ len: 0.9, wid: 0.65, hgt: 0.45, col: [0.15, 0.35, 0.6], head: 0.3, legH: 0.3, eye: [1, 0.7, 0.1], stride: 10, extra: (t, mats) => part(t, new THREE.BoxGeometry(0.3, 0.2, 0.3), [1, 0.5, 0.1], { emissive: [0.6, 0.25, 0.02], pos: [0, 0.35, -0.5], mats }) });
export const makeDragonfly = () => bugFlyer({ len: 1.4, wid: 0.18, col: [0.2, 0.55, 0.7], y: 1.9, eye: [0.3, 1, 0.6], wing: [0.7, 0.95, 1], wlen: 1.1 });
export const makeCentipede = () => bugWalker({ len: 2.6, wid: 0.45, hgt: 0.3, col: [0.6, 0.3, 0.1], head: 0.3, legH: 0.25, eye: [1, 1, 0.3], stride: 20, segs: 7 });
export const makeYellowjacket = () => bugFlyer({ len: 0.8, wid: 0.3, col: [1, 0.8, 0.1], y: 1.1, eye: [1, 0.1, 0.1], extra: (b, mats) => { for (let k = 0; k < 2; k++) part(b, new THREE.BoxGeometry(0.31, 0.31, 0.08), [0.1, 0.08, 0.05], { pos: [0, 0, -0.1 - k * 0.22], mats }); part(b, new THREE.ConeGeometry(0.05, 0.25, 4), [0.2, 0.2, 0.2], { pos: [0, 0, -0.5], rot: [-Math.PI / 2, 0, 0], mats }); } });
export const makePillbug = () => bugWalker({ len: 1.0, wid: 0.8, hgt: 0.6, col: [0.45, 0.45, 0.5], head: 0.2, legH: 0.12, eye: [0.6, 0.8, 1], stride: 14, segs: 5 });
export const makeTick = () => bugWalker({ len: 0.5, wid: 0.45, hgt: 0.35, col: [0.4, 0.15, 0.1], head: 0.15, legH: 0.15, eye: [1, 0.2, 0.2], stride: 16 });
export const makeCicada = () => bugFlyer({ len: 0.9, wid: 0.4, col: [0.3, 0.4, 0.2], y: 1.0, eye: [1, 0.2, 0.1], wing: [0.8, 1, 0.8], wlen: 0.9 });
export const makeWeevil = () => bugWalker({ len: 0.9, wid: 0.6, hgt: 0.55, col: [0.35, 0.25, 0.2], head: 0.2, legH: 0.35, eye: [0.9, 0.9, 0.2], stride: 8, extra: (t, mats) => part(t, new THREE.BoxGeometry(0.08, 0.08, 0.6), [0.25, 0.18, 0.12], { pos: [0, 0.35, 0.95], rot: [0.3, 0, 0], mats }) });

// X-RAY: a red silhouette drawn over everything (walls included), riding on every mesh of a model
const XRAY_MAT = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, fog: false });
export function setXray(model, on) {
  const u = model.userData;
  if (on === !!u.xray) return;
  if (on) {
    u.xray = [];
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && !o.userData.isXray && !o.isSprite) meshes.push(o); });
    for (const o of meshes) {
      if (o.isSkinnedMesh) { // a rigged model: the silhouette has to ride the same skeleton
        const x = new THREE.SkinnedMesh(o.geometry, XRAY_MAT);
        x.bind(o.skeleton, o.bindMatrix);
        x.position.copy(o.position); x.quaternion.copy(o.quaternion); x.scale.copy(o.scale);
        x.userData.isXray = true; x.renderOrder = 999; x.frustumCulled = false;
        o.parent.add(x); u.xray.push(x);
        continue;
      }
      const x = new THREE.Mesh(o.geometry, XRAY_MAT);
      x.userData.isXray = true; x.renderOrder = 999; x.frustumCulled = false; x.scale.setScalar(1.06);
      o.add(x); u.xray.push(x);
    }
  } else {
    for (const x of u.xray) if (x.parent) x.parent.remove(x);
    u.xray = null;
  }
}
export function xrayPulse(t) { XRAY_MAT.opacity = 0.35 + 0.2 * Math.sin(t * 5); }


function flapWings(u, t, speed = 40, amp = 0.6) {
  if (!u.wings) return;
  const a = Math.sin(t * speed) * amp;
  u.wings[0].rotation.z = 0.25 + a; u.wings[1].rotation.z = -0.25 - a;
}

export function animateEnemy(model, t, moving, state, dt) {
  const u = model.userData;
  const stunned = state === 3;
  if (u.kind === 'gltf') { animateAsset(model, moving, state, dt); return; }
  if (u.ring) u.ring.rotation.y = t * 6; // the MARAUDER's blades
  if (u.kind === 'cube') { // the CRUISER: a waddle and a bob
    const s = moving && !stunned ? Math.sin(t * 6) : 0;
    u.body.position.y = Math.abs(s) * 0.08; u.body.rotation.z = s * 0.04 + (stunned ? Math.sin(t * 9) * 0.1 : 0);
    u.feet.forEach((f, i) => { f.position.y = 0.17 + Math.max(0, Math.sin(t * 6 + (i % 2) * Math.PI)) * 0.15 * (moving ? 1 : 0); });
    return;
  }
  if (u.kind === 'crawler') { // eight legs, out of phase
    u.legs.forEach((l, i) => { l.rotation.x = moving && !stunned ? Math.sin(t * 10 + i * 1.3) * 0.35 : 0; });
    u.body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.05 : 0;
    u.body.rotation.z = stunned ? Math.sin(t * 9) * 0.15 : 0;
    return;
  }
  if (u.kind === 'swarm') { // a beating heart and a cloud of gnats
    const beat = 1 + Math.max(0, Math.sin(t * 7)) * 0.15 * (state === 2 ? 2 : 1);
    u.core.scale.setScalar(beat);
    u.body.position.y = 2.4 + Math.sin(t * 1.4) * 0.2 - (stunned ? 0.6 : 0);
    u.motes.forEach((m, i) => { const a = t * (1.5 + (i % 5) * 0.3) + i * 2.4, r = 1.3 + (i % 4) * 0.25; m.position.set(Math.cos(a) * r, Math.sin(a * 1.3 + i) * 0.9, Math.sin(a) * r); });
    return;
  }
  if (u.kind === 'horse') { animateHorse(model, t, moving ? 9 : 0); if (state === 2) u.neck.rotation.x = -0.1; return; }
  if (u.kind === 'walker') {
    const s = moving && !stunned ? Math.sin(t * u.stride) : 0;
    u.legL.rotation.x = s * 0.7; u.legR.rotation.x = -s * 0.7;
    const windup = state === 2;
    const armTarget = windup ? -2.6 : stunned ? 0.8 : -s * 0.6 - 0.2;
    u.armL.rotation.x += (armTarget - u.armL.rotation.x) * Math.min(1, dt * 14);
    u.armR.rotation.x += ((windup ? -2.6 : stunned ? 0.8 : s * 0.6 - 0.2) - u.armR.rotation.x) * Math.min(1, dt * 14);
    u.body.position.y = moving ? Math.abs(Math.cos(t * u.stride)) * 0.06 : 0;
    u.body.rotation.z = stunned ? Math.sin(t * 9) * 0.25 : 0;
    flapWings(u, t, 45, 0.5);
  } else if (u.kind === 'floater') {
    u.body.position.y = 1.6 + Math.sin(t * 2.5) * 0.15 - (stunned ? 0.5 : 0);
    u.body.rotation.z = stunned ? t * 6 : Math.sin(t * 1.3) * 0.15;
    u.tents.forEach((tn, i) => { tn.rotation.x = Math.sin(t * 4 + i * 2) * 0.4; tn.rotation.z = Math.cos(t * 3 + i) * 0.3; });
    flapWings(u, t, stunned ? 10 : 55, 0.7);
  } else if (u.kind === 'idol') {
    u.body.position.y = 2.2 + Math.abs(Math.sin(t * 5.7)) * 0.35; // bouncing on the beat
    u.body.rotation.y = Math.sin(t * 2.85) * 0.3;
    u.crown.rotation.z = Math.sin(t * 5.7) * 0.15;
    const windup = state === 2;
    u.armL.rotation.x += ((windup ? -2.6 : -1.2 + Math.sin(t * 5.7) * 0.8) - u.armL.rotation.x) * Math.min(1, dt * 10);
    u.armR.rotation.x += ((windup ? -2.6 : -2.2) - u.armR.rotation.x) * Math.min(1, dt * 10);
    u.notes.forEach((n, i) => { const a = t * 1.5 + (i / u.notes.length) * Math.PI * 2; n.position.set(Math.cos(a) * 2.4, 2.4 + Math.sin(t * 3 + i) * 0.6, Math.sin(a) * 2.4); n.rotation.y = t * 3; });
    flapWings(u, t, 30, 0.45);
  } else if (u.kind === 'boss') {
    u.body.position.y = 2.5 + Math.sin(t * 1.5) * 0.2;
    u.crown.rotation.y = t * 1.2;
    u.body.rotation.z = stunned ? Math.sin(t * 7) * 0.12 : 0;
    const windup = state === 2;
    u.armL.rotation.x += ((windup ? -2.4 : Math.sin(t * 2) * 0.3) - u.armL.rotation.x) * Math.min(1, dt * 8);
    u.armR.rotation.x += ((windup ? -2.4 : -Math.sin(t * 2) * 0.3) - u.armR.rotation.x) * Math.min(1, dt * 8);
    flapWings(u, t, 28, 0.5);
  }
}

export function setFlash(model, v) {
  for (const m of model.userData.mats) m.uniforms.uFlash.value = v;
}

// ---------- players ----------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function makeNameTag(name, color) {
  const w = textWidth(name) + 4, h = 11;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, w, h);
  drawText(g, name, 2, 2, color, 1, 'left', false);
  const tex = pixelTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sp.scale.set(w * 0.035, h * 0.035, 1);
  return sp;
}

export function makePlayerModel(colorHex, name, hat = 'none') { // a bee with a shotgun, a scarf in the player's color, and maybe a hat
  const g = new THREE.Group(); const mats = [];
  const col = hexToRgb(colorHex);
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.14, 0.85, 0.14, BLK, [-0.15, 0.85, 0], mats);
  const legR = limb(body, 0.14, 0.85, 0.14, BLK, [0.15, 0.85, 0], mats);
  const torso = new THREE.Group(); torso.position.y = 0.85; body.add(torso);
  part(torso, new THREE.BoxGeometry(0.56, 0.62, 0.36), YEL, { pos: [0, 0.31, 0], mats });
  part(torso, new THREE.BoxGeometry(0.58, 0.12, 0.38), BLK, { pos: [0, 0.2, 0], mats });
  part(torso, new THREE.BoxGeometry(0.58, 0.12, 0.38), BLK, { pos: [0, 0.45, 0], mats });
  part(torso, new THREE.BoxGeometry(0.6, 0.1, 0.4), col, { emissive: col.map((v) => v * 0.3), pos: [0, 0.6, 0], mats }); // scarf
  abdomen(torso, 0.55, 0.22, YEL, BLK, [0, 0.15, -0.18], [0.5, 0, 0], mats);
  const head = new THREE.Group(); head.position.y = 0.82; torso.add(head);
  part(head, new THREE.BoxGeometry(0.34, 0.34, 0.34), YEL, { mats });
  part(head, new THREE.BoxGeometry(0.12, 0.14, 0.04), BLK, { pos: [-0.09, 0.03, 0.17], mats });
  part(head, new THREE.BoxGeometry(0.12, 0.14, 0.04), BLK, { pos: [0.09, 0.03, 0.17], mats });
  part(head, new THREE.BoxGeometry(0.02, 0.3, 0.02), BLK, { pos: [-0.08, 0.3, 0.05], rot: [0.3, 0, -0.3], mats });
  part(head, new THREE.BoxGeometry(0.02, 0.3, 0.02), BLK, { pos: [0.08, 0.3, 0.05], rot: [0.3, 0, 0.3], mats });
  const armL = limb(torso, 0.12, 0.6, 0.12, BLK, [-0.36, 0.58, 0], mats);
  const armR = limb(torso, 0.12, 0.6, 0.12, BLK, [0.36, 0.58, 0], mats);
  armL.rotation.x = -1.2; armR.rotation.x = -1.3; armL.rotation.z = -0.4;
  const gun = new THREE.Group(); gun.position.set(0.12, 0.42, 0.42); torso.add(gun);
  part(gun, new THREE.BoxGeometry(0.1, 0.12, 0.8), [0.25, 0.2, 0.1], { mats });
  part(gun, new THREE.BoxGeometry(0.1, 0.14, 0.3), [0.75, 0.5, 0.15], { pos: [0, -0.04, -0.45], mats });
  const wg = wings(torso, 0.55, 0.3, [0, 0.55, -0.2], mats);
  const tag = makeNameTag(name, colorHex);
  tag.position.y = 2.25;
  g.add(tag);
  const horse = makeHorse(); horse.visible = false; g.add(horse);
  addHat(head, hat, mats);
  g.userData = { mats, legL, legR, torso, head, body, tag, wings: wg, horse, hat };
  return g;
}

export function animatePlayer(model, t, speed, pitch, ducked, riding) {
  const u = model.userData;
  if (u.kind === 'gltf') { // the art team's player model
    const dt = Math.min(0.1, Math.max(0, t - (u.lastT ?? t))); u.lastT = t;
    if (u.mixer) { u.play(speed > 0.5 && !riding ? 'move' : 'idle'); u.mixer.update(dt); }
    u.pivot.position.y = (u.asset === 'playerGun' || u.asset === 'player' ? 0 : u.pivot.position.y) + (riding ? 1.15 : ducked ? -0.45 : 0);
    if (u.horse) { u.horse.visible = !!riding; if (riding) animateHorse(u.horse, t, speed); }
    return;
  }
  const moving = speed > 0.5;
  const s = moving && !riding ? Math.sin(t * 10) : 0;
  u.legL.rotation.x = riding ? -1.2 : s * 0.6; u.legR.rotation.x = riding ? -1.2 : -s * 0.6;
  u.legL.rotation.z = riding ? -0.5 : 0; u.legR.rotation.z = riding ? 0.5 : 0;
  u.torso.rotation.x = -pitch * 0.4;
  u.head.rotation.x = -pitch * 0.5;
  u.body.position.y = riding ? 1.15 : ducked ? -0.45 : 0;
  u.horse.visible = !!riding;
  if (riding) animateHorse(u.horse, t, speed);
  flapWings(u, t, moving ? 50 : 20, 0.4);
}

// ---------- the horse (and its javelins) ----------
export function makeHorse() {
  const g = new THREE.Group(); const mats = [];
  const coat = [0.55, 0.35, 0.18], dark = [0.25, 0.15, 0.08];
  const body = new THREE.Group(); body.position.y = 1.2; g.add(body);
  part(body, new THREE.BoxGeometry(0.6, 0.6, 1.5), coat, { mats });
  const neck = new THREE.Group(); neck.position.set(0, 0.2, 0.65); neck.rotation.x = -0.6; body.add(neck);
  part(neck, new THREE.BoxGeometry(0.32, 0.8, 0.35), coat, { pos: [0, 0.4, 0], mats });
  part(neck, new THREE.BoxGeometry(0.3, 0.3, 0.6), coat, { pos: [0, 0.8, 0.2], rot: [0.6, 0, 0], mats }); // head
  part(neck, new THREE.BoxGeometry(0.06, 0.6, 0.2), dark, { pos: [0, 0.45, -0.2], mats }); // mane
  part(neck, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [0.9, 0.9, 1], pos: [-0.14, 0.92, 0.3], mats });
  part(neck, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0, 0, 0], { emissive: [0.9, 0.9, 1], pos: [0.14, 0.92, 0.3], mats });
  part(body, new THREE.BoxGeometry(0.62, 0.12, 0.6), [0.7, 0.1, 0.1], { pos: [0, 0.32, 0], mats }); // saddle
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.75); body.add(tail);
  part(tail, new THREE.BoxGeometry(0.1, 0.7, 0.1), dark, { pos: [0, -0.35, 0], mats });
  const legs = [];
  for (const [x, z] of [[-0.22, 0.6], [0.22, 0.6], [-0.22, -0.6], [0.22, -0.6]]) legs.push(limb(body, 0.14, 1.2, 0.14, coat, [x, -0.25, z], mats));
  g.userData = { mats, body, neck, tail, legs };
  return g;
}

export function animateHorse(h, t, speed) {
  const u = h.userData;
  const run = Math.min(1, speed / 6);
  const f = 8 + speed * 0.8;
  u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * f + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.5) * 0.7 * run; });
  u.body.position.y = 1.2 + Math.abs(Math.sin(t * f)) * 0.08 * run;
  u.neck.rotation.x = -0.6 + Math.sin(t * f) * 0.1 * run;
  u.tail.rotation.x = 0.4 + Math.sin(t * 3) * 0.2;
}

export function makeJavelin() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.BoxGeometry(0.05, 0.05, 1.8), [0.6, 0.4, 0.2], { mats });
  part(g, new THREE.ConeGeometry(0.07, 0.3, 4), [0.8, 0.8, 0.85], { emissive: [0.3, 0.3, 0.35], pos: [0, 0, -1.0], rot: [-Math.PI / 2, 0, 0], mats });
  g.userData = { mats };
  return g;
}

// ---------- props ----------
export function makeBrazier(themeTorch) { // a wax candle with a honey flame
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.CylinderGeometry(0.16, 0.22, 1.0, 6), [0.95, 0.85, 0.6], { pos: [0, 0.5, 0], mats });
  part(g, new THREE.CylinderGeometry(0.42, 0.24, 0.3, 6), [0.8, 0.55, 0.15], { pos: [0, 1.12, 0], mats });
  part(g, new THREE.BoxGeometry(0.08, 0.3, 0.08), [0.9, 0.6, 0.1], { emissive: [0.4, 0.25, 0], pos: [0.3, 0.9, 0], mats }); // drip
  const flame = part(g, new THREE.ConeGeometry(0.3, 0.7, 5), [0, 0, 0], { emissive: themeTorch, pos: [0, 1.6, 0], mats });
  const core = part(g, new THREE.ConeGeometry(0.16, 0.4, 4), [0, 0, 0], { emissive: [1, 1, 0.75], pos: [0, 1.48, 0], mats });
  g.userData = { mats, flame, core };
  return g;
}

export function makePortal() {
  const g = new THREE.Group(); const mats = [];
  const ring = part(g, new THREE.TorusGeometry(1.25, 0.2, 4, 6), [0.85, 0.6, 0.15], { mats }); // a hexagon, naturally
  ring.position.y = 1.5;
  const discMat = retroMaterial({ color: [0, 0, 0], emissive: [0.3, 0.3, 0.35], side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 6), discMat);
  disc.position.y = 1.5; g.add(disc); mats.push(discMat);
  const base = part(g, new THREE.CylinderGeometry(1.6, 1.8, 0.2, 6), [0.6, 0.45, 0.2], { pos: [0, 0.1, 0], mats });
  const shards = [];
  for (let k = 0; k < 6; k++) shards.push(part(g, new THREE.OctahedronGeometry(0.16, 0), [0, 0, 0], { emissive: [0.4, 0.4, 0.45], mats }));
  g.userData = { mats, ring, disc, discMat, base, shards };
  return g;
}

function signTexture(text, fg, bg) {
  const w = textWidth(text) + 6, h = 11;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  drawText(g, text, 3, 2, fg, 1, 'left', false);
  return { tex: pixelTexture(c), w, h };
}

function sign(group, text, fg, bg, y, mats) {
  const { tex, w, h } = signTexture(text, fg, bg);
  const m = retroMaterial({ map: tex, color: [1, 1, 1], emissive: [0.9, 0.9, 0.9] });
  mats.push(m);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.03, h * 0.03), m);
  mesh.position.set(0, y, 0.36);
  group.add(mesh);
  return mesh;
}

function cabinet(colA, colB, mats) {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(1.0, 1.9, 0.7), colA, { pos: [0, 0.95, 0], mats });
  part(g, new THREE.BoxGeometry(1.04, 0.15, 0.74), colB, { emissive: colB.map((v) => v * 0.6), pos: [0, 1.9, 0], mats });
  part(g, new THREE.BoxGeometry(1.04, 0.1, 0.74), colB, { emissive: colB.map((v) => v * 0.6), pos: [0, 0.05, 0], mats });
  return g;
}

export function makeSlots() {
  const mats = []; const g = cabinet([0.6, 0.1, 0.12], [1, 0.8, 0.2], mats);
  const reels = [];
  for (let i = 0; i < 3; i++) reels.push(part(g, new THREE.BoxGeometry(0.22, 0.3, 0.05), [0, 0, 0], { emissive: [1, 1, 0.8], pos: [-0.27 + i * 0.27, 1.25, 0.36], mats }));
  const lever = new THREE.Group(); lever.position.set(0.56, 1.1, 0); g.add(lever);
  part(lever, new THREE.BoxGeometry(0.05, 0.6, 0.05), [0.7, 0.7, 0.75], { pos: [0, 0.3, 0], mats });
  part(lever, new THREE.IcosahedronGeometry(0.09, 0), [1, 0.1, 0.1], { emissive: [0.6, 0, 0], pos: [0, 0.62, 0], mats });
  sign(g, 'HONEY SLOTS', '#ffd040', '#300808', 1.66, mats);
  g.userData = { mats, reels, lever, kind: 'slots' };
  return g;
}

export function makeWheel() {
  const mats = []; const g = cabinet([0.15, 0.1, 0.4], [0.4, 0.9, 1], mats);
  const wheel = new THREE.Group(); wheel.position.set(0, 1.15, 0.38); g.add(wheel);
  const cols = [[1, 0.8, 0.2], [0.4, 1, 0.5], [1, 0.3, 0.2], [1, 0.4, 0.6]];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    part(wheel, new THREE.BoxGeometry(0.1, 0.34, 0.03), [0, 0, 0], { emissive: cols[k % 4], pos: [Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0], rot: [0, 0, -a], mats });
  }
  sign(g, 'BUZZ WHEEL', '#4ac8ff', '#080830', 1.66, mats);
  g.userData = { mats, wheel, kind: 'wheel' };
  return g;
}

export function makeDerby() {
  const mats = []; const g = cabinet([0.1, 0.35, 0.12], [1, 1, 1], mats);
  const runners = [];
  const cols = [[1, 1, 1], [0.75, 0.5, 0.25], [1, 0.8, 0.2], [1, 0.3, 0.2]];
  for (let i = 0; i < 4; i++) {
    part(g, new THREE.BoxGeometry(0.8, 0.02, 0.02), [0.3, 0.3, 0.3], { pos: [0, 0.95 + i * 0.16, 0.36], mats });
    runners.push(part(g, new THREE.BoxGeometry(0.08, 0.08, 0.04), [0, 0, 0], { emissive: cols[i], pos: [-0.35, 1.0 + i * 0.16, 0.37], mats }));
  }
  sign(g, 'BEE-DERBY', '#ffffff', '#083010', 1.66, mats);
  g.userData = { mats, runners, kind: 'derby' };
  return g;
}

export function makeBooth() {
  const mats = []; const g = cabinet([0.7, 0.25, 0.45], [1, 0.5, 0.8], mats);
  const heart = new THREE.Group(); heart.position.set(0, 1.2, 0.38); g.add(heart);
  part(heart, new THREE.BoxGeometry(0.2, 0.2, 0.04), [0, 0, 0], { emissive: [1, 0.2, 0.4], pos: [-0.1, 0.06, 0], rot: [0, 0, 0.785], mats });
  part(heart, new THREE.BoxGeometry(0.2, 0.2, 0.04), [0, 0, 0], { emissive: [1, 0.2, 0.4], pos: [0.1, 0.06, 0], rot: [0, 0, 0.785], mats });
  part(heart, new THREE.BoxGeometry(0.25, 0.25, 0.04), [0, 0, 0], { emissive: [1, 0.2, 0.4], pos: [0, -0.06, 0], rot: [0, 0, 0.785], mats });
  sign(g, 'HIVE HEARTS', '#ffb0d0', '#300818', 1.66, mats);
  g.userData = { mats, heart, kind: 'booth' };
  return g;
}

export function addHat(head, hat, mats) {
  const h = new THREE.Group(); h.position.y = 0.17; head.add(h);
  switch (hat) {
    case 'party': part(h, new THREE.ConeGeometry(0.13, 0.36, 6), [1, 0.3, 0.7], { emissive: [0.4, 0.1, 0.3], pos: [0, 0.18, 0], mats }); part(h, new THREE.IcosahedronGeometry(0.05, 0), [1, 1, 0.4], { emissive: [0.8, 0.8, 0.2], pos: [0, 0.38, 0], mats }); break;
    case 'cone': part(h, new THREE.ConeGeometry(0.15, 0.42, 4), [1, 0.45, 0.1], { pos: [0, 0.21, 0], mats }); part(h, new THREE.CylinderGeometry(0.1, 0.11, 0.06, 4), [1, 1, 1], { pos: [0, 0.2, 0], mats }); break;
    case 'propeller': part(h, new THREE.CylinderGeometry(0.17, 0.18, 0.08, 6), [0.3, 0.5, 1], { pos: [0, 0.04, 0], mats }); part(h, new THREE.BoxGeometry(0.42, 0.02, 0.06), [1, 0.9, 0.2], { pos: [0, 0.12, 0], mats }); break;
    case 'tophat': part(h, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 8), [0.08, 0.08, 0.08], { pos: [0, 0.01, 0], mats }); part(h, new THREE.CylinderGeometry(0.15, 0.15, 0.36, 8), [0.08, 0.08, 0.08], { pos: [0, 0.2, 0], mats }); break;
    case 'cowboy': part(h, new THREE.CylinderGeometry(0.33, 0.33, 0.03, 8), [0.55, 0.35, 0.18], { pos: [0, 0.01, 0], mats }); part(h, new THREE.BoxGeometry(0.24, 0.16, 0.22), [0.55, 0.35, 0.18], { pos: [0, 0.09, 0], mats }); break;
    case 'crown': part(h, new THREE.CylinderGeometry(0.15, 0.15, 0.1, 6, 1, true), [1, 0.8, 0.2], { emissive: [0.5, 0.35, 0.05], pos: [0, 0.05, 0], mats });
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; part(h, new THREE.ConeGeometry(0.035, 0.1, 4), [1, 0.8, 0.2], { emissive: [0.5, 0.35, 0.05], pos: [Math.cos(a) * 0.13, 0.14, Math.sin(a) * 0.13], mats }); } break;
    case 'halo': part(h, new THREE.TorusGeometry(0.17, 0.025, 4, 10), [0, 0, 0], { emissive: [1, 0.95, 0.5], pos: [0, 0.22, 0], rot: [Math.PI / 2, 0, 0], mats }); break;
  }
  return h;
}

export function makeShop() {
  const mats = []; const g = cabinet([0.85, 0.6, 0.15], [1, 0.9, 0.5], mats);
  const jar = new THREE.Group(); jar.position.set(0, 1.15, 0.38); g.add(jar);
  part(jar, new THREE.CylinderGeometry(0.16, 0.16, 0.3, 6), [0, 0, 0], { emissive: [1, 0.7, 0.1], mats });
  part(jar, new THREE.CylinderGeometry(0.18, 0.18, 0.05, 6), [0.6, 0.4, 0.2], { pos: [0, 0.17, 0], mats });
  sign(g, 'HONEY SHOP', '#ffd040', '#402008', 1.66, mats);
  g.userData = { mats, jar, kind: 'shop' };
  return g;
}

// a classic straw skep hive hanging from the ceiling, with a few bees circling it
export function makeHangingHive() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), [0.4, 0.3, 0.15], { pos: [0, -0.25, 0], mats });
  const rings = 6;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const r = 0.25 + Math.sin(t * Math.PI * 0.85) * 0.45;
    part(g, new THREE.CylinderGeometry(r, r * 1.02, 0.2, 8), i % 2 ? [0.85, 0.62, 0.25] : [0.75, 0.52, 0.2], { pos: [0, -0.6 - i * 0.19, 0], mats });
  }
  part(g, new THREE.BoxGeometry(0.16, 0.12, 0.08), [0.05, 0.03, 0.02], { pos: [0, -1.5, 0.6], mats }); // the entrance
  part(g, new THREE.BoxGeometry(0.16, 0.06, 0.06), [0, 0, 0], { emissive: [1, 0.7, 0.1], pos: [0.3, -1.05, 0.5], mats }); // a honey drip
  const bees = [];
  for (let k = 0; k < 3; k++) bees.push(part(g, new THREE.BoxGeometry(0.07, 0.05, 0.05), [0, 0, 0], { emissive: [1, 0.8, 0.1], mats }));
  g.userData = { mats, bees };
  return g;
}

export const PROP_BUILDERS = { slots: makeSlots, wheel: makeWheel, derby: makeDerby, booth: makeBooth, shop: makeShop, typing: () => makeTypingStand() };

// ---------- pickups ----------
export function makeOrb() { // royal jelly (heal)
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.OctahedronGeometry(0.25, 0), [0, 0, 0], { emissive: [1, 0.55, 0.8], mats });
  part(g, new THREE.BoxGeometry(0.5, 0.08, 0.08), [0, 0, 0], { emissive: [1, 1, 1], mats });
  part(g, new THREE.BoxGeometry(0.08, 0.5, 0.08), [0, 0, 0], { emissive: [1, 1, 1], mats });
  g.userData = { mats };
  return g;
}

export function makeMedkit() { // a white case with a red cross on both faces, and a handle
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.BoxGeometry(0.5, 0.34, 0.24), [0.92, 0.92, 0.9], { emissive: [0.45, 0.45, 0.45], mats });
  for (const s of [-1, 1]) {
    part(g, new THREE.BoxGeometry(0.26, 0.08, 0.02), [1, 0.1, 0.1], { emissive: [0.9, 0.05, 0.05], pos: [0, 0, 0.13 * s], mats });
    part(g, new THREE.BoxGeometry(0.08, 0.26, 0.02), [1, 0.1, 0.1], { emissive: [0.9, 0.05, 0.05], pos: [0, 0, 0.13 * s], mats });
  }
  part(g, new THREE.BoxGeometry(0.22, 0.05, 0.06), [0.3, 0.3, 0.3], { emissive: [0.15, 0.15, 0.15], pos: [0, 0.2, 0], mats });
  g.userData = { mats };
  return g;
}

export function makeHoneyDrop() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.OctahedronGeometry(0.15, 0), [0, 0, 0], { emissive: [1, 0.72, 0.1], scale: [1, 1.4, 1], mats });
  g.userData = { mats };
  return g;
}

export function makeWafer() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.CylinderGeometry(0.26, 0.26, 0.06, 6), [0.95, 0.8, 0.5], { emissive: [0.6, 0.45, 0.2], mats });
  part(g, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6), [0, 0, 0], { emissive: [1, 0.9, 0.5], mats });
  g.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(g); w.userData = { mats };
  return w;
}

export function makeDew() { // a drop of water for the thirst meter
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.OctahedronGeometry(0.22, 0), [0, 0, 0], { emissive: [0.35, 0.7, 1], scale: [1, 1.35, 1], mats });
  part(g, new THREE.OctahedronGeometry(0.08, 0), [0, 0, 0], { emissive: [0.9, 1, 1], pos: [-0.06, 0.08, 0.1], mats });
  g.userData = { mats };
  return g;
}

export function makeKeyModel() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.TorusGeometry(0.16, 0.05, 4, 6), [0, 0, 0], { emissive: [1, 0.85, 0.2], pos: [0, 0.25, 0], mats });
  part(g, new THREE.BoxGeometry(0.06, 0.4, 0.06), [0, 0, 0], { emissive: [1, 0.85, 0.2], pos: [0, -0.05, 0], mats });
  part(g, new THREE.BoxGeometry(0.14, 0.06, 0.06), [0, 0, 0], { emissive: [1, 0.85, 0.2], pos: [0.07, -0.2, 0], mats });
  g.userData = { mats };
  return g;
}

export function makeItemPickup(colorHex) { // a relic on a pedestal
  const g = new THREE.Group(); const mats = [];
  const col = hexToRgb(colorHex);
  part(g, new THREE.CylinderGeometry(0.45, 0.55, 0.9, 6), [0.85, 0.7, 0.4], { pos: [0, 0.45, 0], mats });
  const relic = new THREE.Group(); relic.position.y = 1.35; g.add(relic);
  part(relic, new THREE.OctahedronGeometry(0.28, 0), col, { emissive: col.map((v) => v * 0.7), mats });
  part(relic, new THREE.BoxGeometry(0.7, 0.04, 0.04), [0, 0, 0], { emissive: [1, 1, 1], mats });
  g.userData = { mats, relic };
  return g;
}

export function makeProjectile(boss, reflected) {
  const g = new THREE.Group(); const mats = [];
  const c = reflected ? [1, 0.85, 0.2] : boss ? [1, 0.25, 0.1] : [0.75, 1, 0.2];
  part(g, new THREE.OctahedronGeometry(boss ? 0.3 : 0.22, 0), [0, 0, 0], { emissive: c, mats });
  part(g, new THREE.OctahedronGeometry(boss ? 0.15 : 0.1, 0), [0, 0, 0], { emissive: [1, 1, 0.9], mats });
  g.userData = { mats };
  return g;
}

// ---------- first-person: the honey shotgun, a stinger for parries, and the javelin ----------
export function makeViewmodel(colorHex) {
  const g = new THREE.Group(); const mats = [];
  const metal = [0.3, 0.22, 0.1], wood = [0.85, 0.6, 0.15];
  const col = hexToRgb(colorHex);
  const glow = (c) => c.map((v) => v * 0.6);
  const gun = new THREE.Group(); g.add(gun); gun.scale.setScalar(0.78);
  part(gun, new THREE.BoxGeometry(0.11, 0.13, 0.36), metal, { emissive: glow(metal), pos: [0, 0, 0], mats });
  const b1 = part(gun, new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), [0.2, 0.16, 0.08], { emissive: glow([0.2, 0.16, 0.08]), pos: [-0.028, 0.035, -0.52], rot: [Math.PI / 2, 0, 0], mats });
  part(gun, new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), [0.2, 0.16, 0.08], { emissive: glow([0.2, 0.16, 0.08]), pos: [0.028, 0.035, -0.52], rot: [Math.PI / 2, 0, 0], mats });
  for (let k = 0; k < 3; k++) part(gun, new THREE.BoxGeometry(0.125, 0.025, 0.03), [1, 0.8, 0.1], { emissive: [0.6, 0.45, 0.05], pos: [0, 0.035, -0.3 - k * 0.18], mats }); // bee stripes
  const pump = new THREE.Group(); gun.add(pump);
  part(pump, new THREE.BoxGeometry(0.1, 0.08, 0.24), wood, { emissive: glow(wood), pos: [0, -0.04, -0.45], mats });
  part(gun, new THREE.BoxGeometry(0.09, 0.14, 0.34), wood, { emissive: glow(wood), pos: [0, -0.06, 0.32], rot: [-0.25, 0, 0], mats });
  part(gun, new THREE.BoxGeometry(0.02, 0.03, 0.04), [0.9, 0.9, 0.9], { emissive: glow([0.9, 0.9, 0.9]), pos: [0, 0.075, -0.86], mats });
  const sleeve = part(gun, new THREE.BoxGeometry(0.12, 0.12, 0.3), col, { emissive: glow(col), pos: [0.06, -0.12, 0.42], rot: [0.3, 0.2, 0], mats }); // sleeve
  const pumpSleeve = part(pump, new THREE.BoxGeometry(0.1, 0.1, 0.24), col, { emissive: glow(col), pos: [-0.05, -0.12, -0.42], rot: [0, -0.3, 0], mats });
  // muzzle flash: crossed star planes
  const fc = document.createElement('canvas'); fc.width = fc.height = 16;
  const fg = fc.getContext('2d');
  fg.fillStyle = '#ffd040'; fg.beginPath();
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, r = k % 2 ? 3 : 8; fg.lineTo(8 + Math.cos(a) * r, 8 + Math.sin(a) * r); }
  fg.fill(); fg.fillStyle = '#ffffff'; fg.fillRect(6, 6, 4, 4);
  const fm = new THREE.MeshBasicMaterial({ map: pixelTexture(fc), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const flash = new THREE.Group();
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), fm);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), fm); p2.rotation.y = Math.PI / 2;
  const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), fm); p3.rotation.x = Math.PI / 2;
  flash.add(p1, p2, p3);
  flash.position.set(0, 0.035, -0.95);
  flash.visible = false;
  gun.add(flash);
  // the art team's HORNETGUN replaces the procedural one when it has loaded (the sleeves and flash stay)
  const art = makeAsset('hornetgun', { center: true });
  if (art) {
    for (const c of gun.children) if (c !== flash && c !== sleeve && c !== pump) c.visible = false;
    for (const c of pump.children) if (c !== pumpSleeve) c.visible = false;
    art.scale.setScalar(1.05); art.position.set(0, 0.02, -0.42);
    for (const m of art.userData.mats) { m.uniforms.uEmissive.value.set(0.55, 0.55, 0.55); mats.push(m); }
    gun.add(art);
  }
  // the stinger: thrust out from the left on a parry
  const stinger = new THREE.Group(); g.add(stinger);
  part(stinger, new THREE.ConeGeometry(0.035, 0.6, 4), [0.2, 0.15, 0.1], { emissive: [0.5, 0.4, 0.2], pos: [0, 0, -0.3], rot: [-Math.PI / 2, 0, 0], mats });
  part(stinger, new THREE.BoxGeometry(0.1, 0.1, 0.18), YEL, { emissive: [0.5, 0.4, 0.05], pos: [0, 0, 0.02], mats });
  stinger.visible = false;
  // the javelin (while riding)
  const jav = makeJavelin(); jav.position.set(0.05, 0.05, -0.2); jav.rotation.set(0.05, 0.08, 0); jav.visible = false; g.add(jav);
  // the dropkick leg, swung up from below the screen
  const leg = new THREE.Group(); g.add(leg);
  part(leg, new THREE.BoxGeometry(0.13, 0.13, 0.55), YEL, { emissive: [0.45, 0.35, 0.05], pos: [0, 0, -0.25], mats });
  part(leg, new THREE.BoxGeometry(0.135, 0.135, 0.06), BLK, { pos: [0, 0, -0.2], mats });
  part(leg, new THREE.BoxGeometry(0.16, 0.16, 0.14), [0.15, 0.1, 0.08], { emissive: [0.1, 0.07, 0.05], pos: [0, -0.02, -0.56], mats }); // the boot
  leg.visible = false;
  // the HIVE CLEAVER: a huge honey-gold blade, swung across the whole screen
  const blade = new THREE.Group(); g.add(blade);
  const sw = new THREE.Group(); blade.add(sw);
  part(sw, new THREE.BoxGeometry(0.05, 0.16, 1.35), [1, 0.82, 0.3], { emissive: [0.55, 0.4, 0.08], pos: [0, 0, -0.8], mats });
  part(sw, new THREE.BoxGeometry(0.052, 0.04, 1.3), [1, 1, 0.85], { emissive: [0.9, 0.9, 0.7], pos: [0, 0.08, -0.82], mats }); // the edge
  for (let k = 0; k < 4; k++) part(sw, new THREE.BoxGeometry(0.055, 0.17, 0.05), [0.2, 0.12, 0.05], { pos: [0, 0, -0.35 - k * 0.3], mats }); // bee stripes
  part(sw, new THREE.BoxGeometry(0.3, 0.06, 0.07), [0.35, 0.25, 0.1], { pos: [0, 0, -0.08], mats }); // guard
  part(sw, new THREE.BoxGeometry(0.06, 0.06, 0.28), [0.25, 0.15, 0.07], { pos: [0, 0, 0.08], mats }); // grip
  sw.scale.setScalar(0.8);
  blade.visible = false;
  // the BATTER's bat, resting on the shoulder
  const bat = new THREE.Group(); g.add(bat);
  part(bat, new THREE.CylinderGeometry(0.035, 0.07, 0.95, 6), [0.75, 0.55, 0.3], { emissive: [0.2, 0.12, 0.05], pos: [0, 0.45, 0], mats });
  part(bat, new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), [0.15, 0.1, 0.08], { pos: [0, -0.1, 0], mats }); // the grip tape
  part(bat, new THREE.CylinderGeometry(0.072, 0.072, 0.04, 6), [0.9, 0.2, 0.15], { pos: [0, 0.8, 0], mats }); // a red band
  bat.visible = false;
  // the GRENADER's honey bomb in hand
  const bomb = makeBomb(); bomb.position.set(0.02, 0.02, -0.15); g.add(bomb); bomb.visible = false;
  const ball = makeSpinBall(false); ball.scale.setScalar(0.35); ball.position.set(0.06, -0.06, -0.3); g.add(ball); ball.visible = false;
  g.userData = { mats, gun, pump, flash, b1, stinger, jav, leg, blade, bladeSwing: sw, bat, bomb, ball };
  g.position.set(0.2, -0.24, -0.38); // born at its rest pose in the hand, never at the eye
  return g;
}

// =====================================================================================
// RANDOMLINGS: not bees, not bugs, not from here.
// =====================================================================================
export function makeStomperProc() { // fallback STOMPER (the art team's rig replaces it once loaded)
  const g = new THREE.Group(); const mats = [];
  const grey = [0.6, 0.58, 0.64], dark = [0.25, 0.24, 0.28];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.7, 1.6, 0.7, dark, [-0.55, 1.6, 0], mats);
  const legR = limb(body, 0.7, 1.6, 0.7, dark, [0.55, 1.6, 0], mats);
  part(legL, new THREE.BoxGeometry(0.9, 0.3, 1.1), grey, { pos: [0, -1.65, 0.1], mats });
  part(legR, new THREE.BoxGeometry(0.9, 0.3, 1.1), grey, { pos: [0, -1.65, 0.1], mats });
  part(body, new THREE.BoxGeometry(2.0, 1.4, 1.4), grey, { pos: [0, 2.3, 0], mats });
  part(body, new THREE.BoxGeometry(0.9, 0.12, 0.05), [0, 0, 0], { emissive: [1, 0.3, 0.1], pos: [0, 2.6, 0.72], mats });
  const armL = limb(body, 0.45, 1.3, 0.45, dark, [-1.25, 2.8, 0], mats);
  const armR = limb(body, 0.45, 1.3, 0.45, dark, [1.25, 2.8, 0], mats);
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 3 };
  return g;
}

export function makeMarauder() { // scythes for arms, a ring of blades orbiting the waist
  const g = new THREE.Group(); const mats = [];
  const skin = [0.22, 0.2, 0.26], cloth = [0.35, 0.12, 0.14], steel = [0.82, 0.84, 0.9];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.16, 0.95, 0.16, skin, [-0.16, 0.95, 0], mats);
  const legR = limb(body, 0.16, 0.95, 0.16, skin, [0.16, 0.95, 0], mats);
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  part(torso, new THREE.BoxGeometry(0.5, 0.7, 0.3), cloth, { pos: [0, 0.35, 0], mats });
  part(torso, new THREE.BoxGeometry(0.3, 0.32, 0.3), skin, { pos: [0, 0.9, 0], mats });
  part(torso, new THREE.BoxGeometry(0.22, 0.05, 0.02), [0, 0, 0], { emissive: [1, 0.15, 0.2], pos: [0, 0.94, 0.16], mats });
  const scythe = (side) => {
    const arm = limb(torso, 0.1, 0.55, 0.1, skin, [side * 0.33, 0.62, 0], mats);
    part(arm, new THREE.BoxGeometry(0.05, 0.95, 0.05), [0.3, 0.25, 0.2], { pos: [0, -0.75, 0], mats });
    part(arm, new THREE.BoxGeometry(0.04, 0.12, 0.9), steel, { emissive: [0.25, 0.25, 0.3], pos: [0, -1.18, 0.38], rot: [0.25, 0, 0], mats });
    part(arm, new THREE.BoxGeometry(0.035, 0.05, 0.7), [1, 1, 1], { emissive: [0.5, 0.5, 0.55], pos: [0, -1.25, 0.5], rot: [0.45, 0, 0], mats });
    return arm;
  };
  const armL = scythe(-1), armR = scythe(1);
  const ring = new THREE.Group(); ring.position.y = 1.0; g.add(ring);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, b = new THREE.Group();
    b.position.set(Math.cos(a) * 1.5, Math.sin(k * 2.1) * 0.15, Math.sin(a) * 1.5); b.rotation.y = -a;
    part(b, new THREE.BoxGeometry(0.04, 0.08, 0.6), steel, { emissive: [0.35, 0.35, 0.4], rot: [0, 0, 0.3], mats });
    ring.add(b);
  }
  g.userData = { mats, legL, legR, armL, armR, body, ring, kind: 'walker', stride: 11 };
  return g;
}

export function makeCruiser() { // a cube. Panels, rivets, a visor, little feet, an antenna.
  const g = new THREE.Group(); const mats = [];
  const shell = [0.42, 0.5, 0.62], trim = [0.22, 0.26, 0.34];
  const body = new THREE.Group(); g.add(body);
  part(body, new THREE.BoxGeometry(2.2, 2.0, 2.2), shell, { pos: [0, 1.35, 0], mats });
  for (const s of [-1, 1]) for (const t of [-1, 1]) part(body, new THREE.BoxGeometry(0.3, 2.04, 0.3), trim, { pos: [s * 0.98, 1.35, t * 0.98], mats }); // corner posts
  part(body, new THREE.BoxGeometry(1.5, 0.22, 0.06), [0, 0, 0], { emissive: [0.3, 1, 0.9], pos: [0, 1.75, 1.12], mats }); // visor
  part(body, new THREE.BoxGeometry(1.0, 0.7, 0.05), trim, { pos: [0, 0.95, 1.11], mats }); // a hatch
  for (let k = 0; k < 6; k++) part(body, new THREE.BoxGeometry(0.08, 0.08, 0.04), [0.8, 0.8, 0.85], { pos: [-0.6 + k * 0.24, 2.25, 1.12], mats }); // rivets
  part(body, new THREE.BoxGeometry(2.3, 0.12, 2.3), trim, { pos: [0, 2.37, 0], mats });
  part(body, new THREE.BoxGeometry(0.05, 0.6, 0.05), [0.3, 0.3, 0.3], { pos: [0.6, 2.75, -0.5], mats });
  part(body, new THREE.IcosahedronGeometry(0.09, 0), [0, 0, 0], { emissive: [1, 0.2, 0.2], pos: [0.6, 3.07, -0.5], mats });
  const feet = [];
  for (const [x, z] of [[-0.7, 0.7], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7]]) feet.push(part(g, new THREE.BoxGeometry(0.45, 0.35, 0.55), trim, { pos: [x, 0.17, z], mats }));
  g.userData = { mats, body, feet, kind: 'cube' };
  return g;
}

// =====================================================================================
// THE HIVE BOSSES (all originals)
// =====================================================================================
export function makeNyaslop() { // a gremlin cat with a head bigger than its body and one word to say
  const g = new THREE.Group(); const mats = [];
  const fur = [0.95, 0.88, 0.72], brown = [0.45, 0.3, 0.2];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.22, 0.5, 0.22, brown, [-0.22, 0.5, 0], mats);
  const legR = limb(body, 0.22, 0.5, 0.22, brown, [0.22, 0.5, 0], mats);
  const torso = new THREE.Group(); torso.position.y = 0.5; body.add(torso);
  part(torso, new THREE.BoxGeometry(0.75, 0.7, 0.55), [0.3, 0.3, 0.55], { pos: [0, 0.35, 0], mats }); // a hoodie
  const head = new THREE.Group(); head.position.set(0, 1.45, 0.05); torso.add(head);
  part(head, new THREE.BoxGeometry(1.5, 1.15, 1.2), fur, { mats });
  for (const s of [-1, 1]) {
    part(head, new THREE.ConeGeometry(0.3, 0.55, 4), fur, { pos: [s * 0.52, 0.78, 0], rot: [0, Math.PI / 4, s * -0.25], mats });
    part(head, new THREE.BoxGeometry(0.3, 0.08, 0.05), [0, 0, 0], { emissive: [1, 0.9, 0.1], pos: [s * 0.35, 0.18, 0.61], rot: [0, 0, s * 0.25], mats }); // slit eyes
    for (let w = 0; w < 3; w++) part(head, new THREE.BoxGeometry(0.4, 0.02, 0.02), [0.2, 0.15, 0.1], { pos: [s * 0.85, -0.12 + w * 0.08, 0.5], rot: [0, 0, s * (0.1 - w * 0.1)], mats });
  }
  part(head, new THREE.BoxGeometry(0.95, 0.28, 0.05), [0.35, 0.05, 0.08], { pos: [0, -0.28, 0.61], mats }); // the grin
  for (let k = 0; k < 6; k++) part(head, new THREE.BoxGeometry(0.1, 0.1, 0.06), [1, 1, 1], { pos: [-0.38 + k * 0.152, -0.18, 0.63], mats });
  const tail = limb(torso, 0.12, 0.9, 0.12, brown, [0, 0.2, -0.3], mats); tail.rotation.x = -2.4;
  const armL = limb(torso, 0.16, 0.5, 0.16, fur, [-0.48, 0.6, 0], mats);
  const armR = limb(torso, 0.16, 0.5, 0.16, fur, [0.48, 0.6, 0], mats);
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 14 };
  return g;
}

export function makeSeamstress() { // a porcelain doll with shears the size of a door
  const g = new THREE.Group(); const mats = [];
  const china = [0.96, 0.94, 0.92], dress = [0.45, 0.2, 0.5];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.12, 0.6, 0.12, china, [-0.15, 0.6, 0], mats);
  const legR = limb(body, 0.12, 0.6, 0.12, china, [0.15, 0.6, 0], mats);
  part(body, new THREE.ConeGeometry(1.0, 1.6, 8), dress, { pos: [0, 1.25, 0], mats });
  part(body, new THREE.CylinderGeometry(1.02, 1.02, 0.12, 8), [0.9, 0.8, 0.95], { pos: [0, 0.5, 0], mats }); // lace hem
  const torso = new THREE.Group(); torso.position.y = 1.9; body.add(torso);
  part(torso, new THREE.BoxGeometry(0.55, 0.6, 0.38), dress, { pos: [0, 0.2, 0], mats });
  const head = new THREE.Group(); head.position.y = 0.85; torso.add(head);
  part(head, new THREE.IcosahedronGeometry(0.42, 1), china, { mats });
  for (const s of [-1, 1]) {
    part(head, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 6), [0.05, 0.05, 0.05], { pos: [s * 0.15, 0.05, 0.4], rot: [Math.PI / 2, 0, 0], mats }); // button eyes
    part(head, new THREE.BoxGeometry(0.02, 0.02, 0.02), [0.9, 0.9, 0.9], { pos: [s * 0.15, 0.05, 0.43], mats });
    part(head, new THREE.BoxGeometry(0.2, 0.55, 0.12), [0.25, 0.12, 0.08], { pos: [s * 0.38, -0.2, -0.05], mats }); // ringlets
  }
  part(head, new THREE.BoxGeometry(0.16, 0.03, 0.02), [0.7, 0.1, 0.2], { pos: [0, -0.18, 0.4], mats }); // stitched mouth
  const shears = (s) => {
    const arm = limb(torso, 0.12, 0.6, 0.12, china, [s * 0.38, 0.4, 0], mats);
    part(arm, new THREE.TorusGeometry(0.16, 0.04, 4, 6), [0.3, 0.3, 0.32], { pos: [0, -0.7, 0], mats });
    part(arm, new THREE.BoxGeometry(0.06, 0.08, 1.7), [0.85, 0.87, 0.9], { emissive: [0.3, 0.3, 0.32], pos: [0, -0.7, 0.9], rot: [0, s * 0.12, 0], mats });
    return arm;
  };
  const armL = shears(-1), armR = shears(1);
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 8 };
  return g;
}

export function makeApiarist() { // the beekeeper: suit, veil, smoker
  const g = new THREE.Group(); const mats = [];
  const suit = [0.92, 0.92, 0.86], glove = [0.85, 0.75, 0.4];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.32, 1.3, 0.32, suit, [-0.3, 1.3, 0], mats);
  const legR = limb(body, 0.32, 1.3, 0.32, suit, [0.3, 1.3, 0], mats);
  const torso = new THREE.Group(); torso.position.y = 1.3; body.add(torso);
  part(torso, new THREE.BoxGeometry(1.1, 1.25, 0.65), suit, { pos: [0, 0.62, 0], mats });
  part(torso, new THREE.BoxGeometry(1.12, 0.1, 0.67), [0.6, 0.6, 0.55], { pos: [0, 0.2, 0], mats }); // belt
  const head = new THREE.Group(); head.position.y = 1.6; torso.add(head);
  part(head, new THREE.BoxGeometry(0.62, 0.62, 0.62), suit, { mats });
  part(head, new THREE.BoxGeometry(0.66, 0.4, 0.66), [0.12, 0.12, 0.14], { pos: [0, -0.02, 0.01], mats, opacity: 0.8 }); // the veil
  part(head, new THREE.CylinderGeometry(0.85, 0.85, 0.06, 10), [0.95, 0.92, 0.75], { pos: [0, 0.32, 0], mats }); // the brim
  part(head, new THREE.CylinderGeometry(0.35, 0.38, 0.3, 8), [0.95, 0.92, 0.75], { pos: [0, 0.48, 0], mats });
  part(head, new THREE.BoxGeometry(0.4, 0.05, 0.02), [0, 0, 0], { emissive: [1, 0.85, 0.3], pos: [0, 0.02, 0.35], mats }); // eyes behind the veil
  const armL = limb(torso, 0.26, 1.05, 0.26, suit, [-0.72, 1.15, 0], mats);
  const armR = limb(torso, 0.26, 1.05, 0.26, suit, [0.72, 1.15, 0], mats);
  part(armL, new THREE.BoxGeometry(0.3, 0.3, 0.3), glove, { pos: [0, -1.1, 0], mats });
  part(armR, new THREE.BoxGeometry(0.3, 0.3, 0.3), glove, { pos: [0, -1.1, 0], mats });
  part(armR, new THREE.CylinderGeometry(0.2, 0.2, 0.5, 6), [0.6, 0.55, 0.5], { pos: [0, -1.4, 0.15], mats }); // the smoker
  part(armR, new THREE.ConeGeometry(0.18, 0.25, 6), [0.3, 0.28, 0.25], { pos: [0, -1.05, 0.15], mats });
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 5, smoker: true };
  return g;
}

export function makeCombstack() { // a golem of stacked wax hexes, honey glowing in the cells
  const g = new THREE.Group(); const mats = [];
  const wax = [0.95, 0.75, 0.3], deep = [0.6, 0.38, 0.12], honey = [1, 0.7, 0.1];
  const hex = (grp, r, h, col, pos, opts = {}) => part(grp, new THREE.CylinderGeometry(r, r, h, 6), col, { pos, mats, ...opts });
  const body = new THREE.Group(); g.add(body);
  const legL = new THREE.Group(); legL.position.set(-0.6, 1.5, 0); body.add(legL); hex(legL, 0.42, 1.5, deep, [0, -0.75, 0]);
  const legR = new THREE.Group(); legR.position.set(0.6, 1.5, 0); body.add(legR); hex(legR, 0.42, 1.5, deep, [0, -0.75, 0]);
  hex(body, 1.2, 1.4, wax, [0, 2.2, 0]);
  hex(body, 0.9, 0.7, wax, [0, 3.25, 0]);
  hex(body, 0.55, 0.55, deep, [0, 3.85, 0]);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5; hex(body, 0.22, 0.05, [0, 0, 0], [Math.cos(a) * 0.95, 2.2 + (k % 2) * 0.3, Math.sin(a) * 0.95], { emissive: honey, rot: [Math.PI / 2, 0, -a] }); }
  part(body, new THREE.BoxGeometry(0.6, 0.12, 0.05), [0, 0, 0], { emissive: [1, 0.4, 0.05], pos: [0, 3.9, 0.5], mats });
  const armL = new THREE.Group(); armL.position.set(-1.4, 2.7, 0); body.add(armL); hex(armL, 0.35, 1.6, deep, [0, -0.8, 0]); hex(armL, 0.5, 0.5, wax, [0, -1.7, 0]);
  const armR = new THREE.Group(); armR.position.set(1.4, 2.7, 0); body.add(armR); hex(armR, 0.35, 1.6, deep, [0, -0.8, 0]); hex(armR, 0.5, 0.5, wax, [0, -1.7, 0]);
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 3.5 };
  return g;
}

export function makeLampmother() { // the mother of all moths and her lamp that has never been lit
  const g = new THREE.Group(); const mats = [];
  const fuzz = [0.75, 0.65, 0.5], wingc = [0.65, 0.55, 0.4];
  const body = new THREE.Group(); body.position.y = 2.4; g.add(body);
  part(body, new THREE.BoxGeometry(0.7, 0.7, 1.6), fuzz, { mats });
  part(body, new THREE.BoxGeometry(0.8, 0.8, 0.6), [0.9, 0.85, 0.75], { pos: [0, 0.05, 0.9], mats }); // the ruff
  part(body, new THREE.BoxGeometry(0.5, 0.5, 0.4), fuzz, { pos: [0, 0.1, 1.3], mats });
  for (const s of [-1, 1]) {
    part(body, new THREE.IcosahedronGeometry(0.16, 0), [0, 0, 0], { emissive: [0.3, 0.9, 1], pos: [s * 0.2, 0.18, 1.5], mats });
    part(body, new THREE.BoxGeometry(0.5, 0.04, 0.12), [0.4, 0.3, 0.2], { pos: [s * 0.3, 0.55, 1.4], rot: [0.6, 0, s * 0.6], mats }); // feathery antennae
  }
  const wg = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * 0.3, 0.3, 0.1); body.add(pv);
    part(pv, new THREE.BoxGeometry(2.4, 0.04, 1.5), wingc, { pos: [s * 1.25, 0, 0.2], mats });
    part(pv, new THREE.BoxGeometry(0.5, 0.05, 0.5), [0, 0, 0], { emissive: [0.9, 0.4, 0.1], pos: [s * 1.5, 0.03, 0.3], mats }); // eye spots
    part(pv, new THREE.BoxGeometry(1.6, 0.04, 1.0), wingc.map((v) => v * 0.8), { pos: [s * 0.95, -0.02, -0.9], mats });
    wg.push(pv);
  }
  const tents = [limb(body, 0.05, 0.9, 0.05, [0.3, 0.25, 0.2], [0, -0.35, 0.4], mats)];
  const lamp = new THREE.Group(); lamp.position.set(0, -1.4, 0.4); tents[0].add(lamp);
  part(lamp, new THREE.CylinderGeometry(0.22, 0.28, 0.5, 6), [0.25, 0.25, 0.28], { pos: [0, -0.2, 0], mats });
  part(lamp, new THREE.IcosahedronGeometry(0.18, 0), [0.6, 0.6, 0.55], { pos: [0, -0.2, 0], mats, opacity: 0.6 });
  g.userData = { mats, body, tents, wings: wg, kind: 'floater' };
  return g;
}

export function makeTyrant() { // a tarantula in a tiny crown. You owe it back taxes.
  const g = new THREE.Group(); const mats = [];
  const hair = [0.28, 0.2, 0.14], band = [0.75, 0.45, 0.15];
  const body = new THREE.Group(); g.add(body);
  part(body, new THREE.IcosahedronGeometry(1.2, 0), hair, { pos: [0, 1.4, -1.0], scale: [1, 0.85, 1.15], mats });
  part(body, new THREE.BoxGeometry(1.2, 0.8, 1.1), hair, { pos: [0, 1.2, 0.3], mats });
  for (let k = 0; k < 4; k++) part(body, new THREE.BoxGeometry(1.0 - k * 0.15, 0.06, 0.06), band, { pos: [0, 1.62, -0.4 - k * 0.4], mats });
  for (let k = 0; k < 4; k++) part(body, new THREE.BoxGeometry(0.1, 0.1, 0.05), [0, 0, 0], { emissive: [1, 0.15, 0.15], pos: [-0.25 + (k % 2) * 0.5, 1.45 + Math.floor(k / 2) * 0.15, 0.86], mats });
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; part(body, new THREE.ConeGeometry(0.07, 0.22, 4), [0, 0, 0], { emissive: [1, 0.8, 0.2], pos: [Math.cos(a) * 0.2, 1.75, 0.35 + Math.sin(a) * 0.2], mats }); }
  part(body, new THREE.ConeGeometry(0.1, 0.4, 4), [0.1, 0.08, 0.06], { pos: [-0.2, 0.8, 0.9], rot: [Math.PI, 0, 0], mats });
  part(body, new THREE.ConeGeometry(0.1, 0.4, 4), [0.1, 0.08, 0.06], { pos: [0.2, 0.8, 0.9], rot: [Math.PI, 0, 0], mats });
  const legs = [];
  for (let k = 0; k < 8; k++) {
    const s = k % 2 ? 1 : -1, row = Math.floor(k / 2);
    const pv = new THREE.Group(); pv.position.set(s * 0.6, 1.3, 0.55 - row * 0.4); body.add(pv);
    pv.rotation.z = s * 0.9; pv.rotation.y = s * (0.6 - row * 0.4);
    part(pv, new THREE.BoxGeometry(1.2, 0.16, 0.16), hair, { pos: [s * 0.6, 0, 0], mats });
    part(pv, new THREE.BoxGeometry(0.16, 1.2, 0.16), hair, { pos: [s * 1.15, -0.55, 0], mats });
    legs.push(pv);
  }
  g.userData = { mats, body, legs, kind: 'crawler' };
  return g;
}

export function makeSwarmheart() { // ten thousand gnats agreeing, for one moment, to be a heart
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); body.position.y = 2.4; g.add(body);
  const core = new THREE.Group(); body.add(core);
  part(core, new THREE.IcosahedronGeometry(0.75, 0), [0.6, 0.05, 0.12], { emissive: [0.6, 0.05, 0.15], pos: [-0.35, 0.3, 0], mats });
  part(core, new THREE.IcosahedronGeometry(0.75, 0), [0.6, 0.05, 0.12], { emissive: [0.6, 0.05, 0.15], pos: [0.35, 0.3, 0], mats });
  part(core, new THREE.ConeGeometry(0.95, 1.3, 6), [0.6, 0.05, 0.12], { emissive: [0.6, 0.05, 0.15], pos: [0, -0.5, 0], rot: [Math.PI, 0, 0], mats });
  const motes = [];
  for (let k = 0; k < 28; k++) motes.push(part(body, new THREE.BoxGeometry(0.1, 0.08, 0.12), [0.1, 0.1, 0.08], { emissive: [0.15, 0.1, 0.05], mats }));
  g.userData = { mats, body, core, motes, tents: [], wings: null, kind: 'swarm' };
  return g;
}

// =====================================================================================
// art-team models: the glTF ones replace the procedural ones once they've loaded
// =====================================================================================
function withAsset(id, fallback) {
  const f = () => {
    const m = makeAsset(id);
    if (!m) return fallback();
    m.userData.fallbackKind = id;
    return m;
  };
  Object.defineProperty(f, 'name', { value: fallback.name });
  return f;
}
export const makeGroundBee = withAsset('groundBee', makeGrunt);
export const makeFlyingBee = withAsset('flyingBee', makeSpitter);
export const makeMothArt = withAsset('moth', makeMoth);
export const makeStomper = withAsset('stomper', makeStomperProc);
export const makeMarauderArt = withAsset('marauder', makeMarauder);
export const makeCruiserArt = withAsset('cruiser', makeCruiser);

// the bee you play: the art team's beekeeper bee, with a scarf in your color and your hat
export function makePlayerAvatar(colorHex, name, hat = 'none') {
  const art = makeAsset('playerGun');
  if (!art) return makePlayerModel(colorHex, name, hat);
  const u = art.userData;
  const col = hexToRgb(colorHex);
  part(u.pivot, new THREE.BoxGeometry(0.62, 0.1, 0.42), col, { emissive: col.map((v) => v * 0.4), pos: [0, 1.32, 0], mats: u.mats }); // the scarf
  const head = new THREE.Group(); head.position.y = 1.72; u.pivot.add(head);
  addHat(head, hat, u.mats);
  const tag = makeNameTag(name, colorHex); tag.position.y = 2.25; art.add(tag);
  const horse = makeHorse(); horse.visible = false; art.add(horse);
  u.tag = tag; u.horse = horse; u.hat = hat; u.player = true;
  return art;
}

// a build-mode ghost: where your next wax block goes
export function makeGhostCube() {
  const mat = retroMaterial({ color: [1, 0.85, 0.3], emissive: [0.6, 0.45, 0.1], transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  mat.depthWrite = false;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), mat);
  m.userData = { mat, mats: [mat] };
  return m;
}

// loot: a weapon crate and the boss chest
export function makeWeaponDrop() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.BoxGeometry(0.7, 0.35, 0.35), [0.35, 0.25, 0.15], { mats });
  part(g, new THREE.BoxGeometry(0.72, 0.06, 0.37), [0, 0, 0], { emissive: [1, 0.85, 0.3], mats });
  part(g, new THREE.BoxGeometry(0.06, 0.37, 0.37), [0, 0, 0], { emissive: [0.4, 0.8, 1], pos: [0.2, 0, 0], mats });
  g.userData = { mats };
  return g;
}
export function makeChest() {
  const g = new THREE.Group(); const mats = [];
  part(g, new THREE.BoxGeometry(1.4, 0.8, 0.9), [0.55, 0.32, 0.12], { pos: [0, 0.4, 0], mats });
  part(g, new THREE.BoxGeometry(1.45, 0.35, 0.95), [0.6, 0.36, 0.14], { pos: [0, 0.95, 0], mats });
  for (const x of [-0.55, 0, 0.55]) part(g, new THREE.BoxGeometry(0.1, 1.2, 0.97), [0, 0, 0], { emissive: [1, 0.8, 0.2], pos: [x, 0.6, 0], mats });
  part(g, new THREE.BoxGeometry(0.22, 0.26, 0.05), [0, 0, 0], { emissive: [1, 0.95, 0.5], pos: [0, 0.75, 0.49], mats });
  g.userData = { mats };
  return g;
}

// one horse in twenty-five is made of diamond
export function makeDiamondHorse() {
  const h = makeHorse();
  for (const m of h.userData.mats) { m.uniforms.uColor.value.set(0.65, 0.95, 1.1); m.uniforms.uEmissive.value.set(0.25, 0.45, 0.55); }
  const sparkle = [];
  for (let k = 0; k < 6; k++) sparkle.push(part(h.userData.body, new THREE.OctahedronGeometry(0.07, 0), [0, 0, 0], { emissive: [1, 1, 1], pos: [(Math.random() - 0.5) * 0.6, (Math.random() - 0.3) * 0.6, (Math.random() - 0.5) * 1.4], mats: h.userData.mats }));
  h.userData.sparkle = sparkle; h.userData.diamond = true;
  return h;
}

// THE HORSE. Lunges at the camera, mouth open, eyes wide. One frame. You will not see it coming.
export function makeHorseScare() {
  const g = new THREE.Group(); const mats = [];
  const coat = [0.42, 0.26, 0.14], dark = [0.16, 0.09, 0.05];
  const head = new THREE.Group(); head.rotation.set(-0.15, 0.25, -0.2); g.add(head);
  // a skull built from many facets so it reads as a real head at this distance
  part(head, new THREE.IcosahedronGeometry(0.3, 2), coat, { emissive: [0.12, 0.07, 0.04], scale: [0.85, 1, 1.3], pos: [0, 0.08, 0], mats });
  part(head, new THREE.CylinderGeometry(0.17, 0.22, 0.5, 12), coat, { emissive: [0.1, 0.06, 0.03], pos: [0, -0.08, 0.32], rot: [Math.PI / 2 + 0.35, 0, 0], mats }); // muzzle
  for (const s of [-1, 1]) {
    part(head, new THREE.IcosahedronGeometry(0.075, 2), [1, 0.98, 0.92], { emissive: [0.9, 0.88, 0.8], pos: [s * 0.2, 0.18, 0.17], mats }); // eyes, wide open
    part(head, new THREE.IcosahedronGeometry(0.03, 1), [0, 0, 0], { emissive: [0.04, 0, 0], pos: [s * 0.215, 0.18, 0.235], mats }); // pinprick pupils
    part(head, new THREE.ConeGeometry(0.07, 0.24, 8), coat, { pos: [s * 0.13, 0.42, -0.08], rot: [-0.4, 0, s * 0.3], mats }); // ears pinned back
    part(head, new THREE.IcosahedronGeometry(0.035, 1), [0.05, 0.02, 0.02], { pos: [s * 0.08, -0.1, 0.56], mats }); // flared nostrils
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.22, 0.1); jaw.rotation.x = 0.75; head.add(jaw); // the mouth, open far too wide
  part(jaw, new THREE.BoxGeometry(0.26, 0.07, 0.5), coat, { pos: [0, 0, 0.22], mats });
  part(head, new THREE.BoxGeometry(0.24, 0.2, 0.45), [0.35, 0.02, 0.04], { emissive: [0.25, 0, 0.02], pos: [0, -0.22, 0.3], mats }); // the throat
  for (let k = 0; k < 8; k++) {
    part(head, new THREE.BoxGeometry(0.035, 0.07, 0.04), [0.95, 0.9, 0.75], { emissive: [0.4, 0.38, 0.3], pos: [-0.12 + k * 0.034, -0.18, 0.52 - Math.abs(k - 3.5) * 0.02], mats });
    part(jaw, new THREE.BoxGeometry(0.035, 0.07, 0.04), [0.95, 0.9, 0.75], { emissive: [0.4, 0.38, 0.3], pos: [-0.12 + k * 0.034, 0.05, 0.45 - Math.abs(k - 3.5) * 0.02], mats });
  }
  for (let k = 0; k < 10; k++) part(head, new THREE.BoxGeometry(0.04, 0.4, 0.08), dark, { pos: [0, 0.3 - k * 0.05, -0.2 - k * 0.06], rot: [0.4, 0, (k % 2 ? 0.3 : -0.3)], mats }); // mane
  g.userData = { mats };
  return g;
}

// THE TYPING STAND (in the lounge): type fast, hit harder
export function makeTypingStand() {
  const mats = []; const g = cabinet([0.2, 0.25, 0.3], [0.6, 1, 0.8], mats);
  const kb = new THREE.Group(); kb.position.set(0, 1.0, 0.38); kb.rotation.x = -0.5; g.add(kb);
  part(kb, new THREE.BoxGeometry(0.7, 0.04, 0.25), [0.15, 0.15, 0.18], { mats });
  const keys = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) keys.push(part(kb, new THREE.BoxGeometry(0.06, 0.03, 0.05), [0.8, 0.8, 0.8], { emissive: [0.2, 0.2, 0.2], pos: [-0.28 + c * 0.08 + r * 0.02, 0.03, -0.07 + r * 0.07], mats }));
  part(g, new THREE.BoxGeometry(0.6, 0.35, 0.04), [0, 0, 0], { emissive: [0.2, 0.9, 0.5], pos: [0, 1.45, 0.36], mats }); // the screen
  sign(g, 'TYPING TEST', '#80ffc0', '#082018', 1.66, mats);
  g.userData = { mats, keys, kind: 'typing' };
  return g;
}

// THE EVIL HORSE: curse in chat and the horse hears you. It hunts you down.
export function makeEvilHorse() {
  const h = makeHorse();
  const u = h.userData;
  for (const m of u.mats) { m.uniforms.uColor.value.set(0.13, 0.08, 0.09); m.uniforms.uEmissive.value.set(0.06, 0, 0.01); }
  for (const s of [-1, 1]) part(u.neck, new THREE.BoxGeometry(0.08, 0.08, 0.05), [0, 0, 0], { emissive: [1, 0.05, 0.02], pos: [s * 0.15, 0.92, 0.31], mats: u.mats });
  for (let k = 0; k < 4; k++) part(u.neck, new THREE.BoxGeometry(0.04, 0.1, 0.04), [0.95, 0.9, 0.8], { pos: [-0.06 + k * 0.04, 0.62, 0.48], mats: u.mats });
  u.kind = 'horse';
  return h;
}

// A PERSON (npcs.js): jeans, sneakers, a shirt whose color the snapshot sets (RED ones fight you)
export function makeCivilian() {
  const g = new THREE.Group(); const mats = [];
  const body = new THREE.Group(); g.add(body);
  const skins = [[0.95, 0.78, 0.62], [0.78, 0.58, 0.42], [0.55, 0.38, 0.26], [0.36, 0.24, 0.16]];
  const hairs = [[0.1, 0.07, 0.05], [0.35, 0.2, 0.1], [0.75, 0.6, 0.3], [0.15, 0.15, 0.15], [0.55, 0.15, 0.08]];
  const skin = skins[Math.floor(Math.random() * skins.length)], hair = hairs[Math.floor(Math.random() * hairs.length)];
  const jeans = [0.18, 0.25, 0.45], shoe = [0.92, 0.92, 0.9];
  const legL = limb(body, 0.2, 0.85, 0.22, jeans, [-0.13, 0.9, 0], mats);
  const legR = limb(body, 0.2, 0.85, 0.22, jeans, [0.13, 0.9, 0], mats);
  for (const L of [legL, legR]) part(L, new THREE.BoxGeometry(0.22, 0.1, 0.32), shoe, { pos: [0, -0.88, 0.05], mats });
  const shirt = [];
  const torso = part(body, new THREE.BoxGeometry(0.5, 0.6, 0.28), [0.5, 0.5, 0.5], { pos: [0, 1.2, 0], mats }); shirt.push(torso.material);
  const armL = limb(body, 0.14, 0.62, 0.16, [0.5, 0.5, 0.5], [-0.33, 1.47, 0], mats);
  const armR = limb(body, 0.14, 0.62, 0.16, [0.5, 0.5, 0.5], [0.33, 1.47, 0], mats);
  for (const A of [armL, armR]) { shirt.push(A.children[0].material); part(A, new THREE.BoxGeometry(0.12, 0.14, 0.13), skin, { pos: [0, -0.68, 0], mats }); }
  part(body, new THREE.BoxGeometry(0.3, 0.32, 0.3), skin, { pos: [0, 1.68, 0], mats }); // head
  part(body, new THREE.BoxGeometry(0.32, 0.1, 0.32), hair, { pos: [0, 1.86, -0.01], mats });
  part(body, new THREE.BoxGeometry(0.32, 0.18, 0.06), hair, { pos: [0, 1.76, -0.15], mats });
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.05, 0.05, 0.02), [0.05, 0.05, 0.05], { pos: [s * 0.07, 1.7, 0.155], mats });
  const setShirt = (i) => { const c = (SHIRTS[i] || SHIRTS[1])[2]; for (const m of shirt) m.uniforms.uColor.value.set(c[0], c[1], c[2]); };
  setShirt(1 + Math.floor(Math.random() * (SHIRTS.length - 1)));
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 8, setShirt };
  return g;
}

// every enemy model by type index (after everything it names is defined)
export const ENEMY_BUILDERS = [makeGroundBee, makeFlyingBee, makeBrute, makeWarden, makeIdol, makeMothArt, makeMantis, makeSpider, makeFirefly, makeTermite, makeScorpion, makeRoach, makeLocust, makeStag, makeFingler,
  makeLeech, makeGnat, makeBombardier, makeDragonfly, makeCentipede, makeYellowjacket, makePillbug, makeTick, makeCicada, makeWeevil,
  makeStomper, makeMarauderArt, makeCruiserArt, makeNyaslop, makeSeamstress, makeApiarist, makeCombstack, makeLampmother, makeTyrant, makeSwarmheart, makeEvilHorse, makeCivilian];
