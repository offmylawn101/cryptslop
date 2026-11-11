// Retro rendering: low-res target, PS1-style vertex snapping, banded lighting, fog, ordered dithering.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false; // raw colors in, raw colors out: predictable retro palette

export const MAX_LIGHTS = 8;

export const sharedUniforms = {
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -999, 0)) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, 0, 0)) },
  uLightRange: { value: new Array(MAX_LIGHTS).fill(1) },
  uAmbient: { value: new THREE.Vector3(0.15, 0.13, 0.11) },
  uFogColor: { value: new THREE.Vector3(0.05, 0.04, 0.03) },
  uFogNear: { value: 6 },
  uFogFar: { value: 38 },
  uSnap: { value: new THREE.Vector2(160, 120) },
  uTime: { value: 0 },
};

const vert = /* glsl */ `
  uniform vec2 uSnap;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vDepth;
  varying vec3 vColor;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    vec4 cp = projectionMatrix * mv;
    if (cp.w > 0.0) {
      vec2 ndc = cp.xy / cp.w;
      ndc = floor(ndc * uSnap + 0.5) / uSnap; // wobbly PS1 vertex snapping
      cp.xy = ndc * cp.w;
    }
    gl_Position = cp;
    vUv = uv;
    #ifdef USE_VCOLOR
      vColor = color;
    #else
      vColor = vec3(1.0);
    #endif
  }
`;

const frag = /* glsl */ `
  #define MAX_LIGHTS ${MAX_LIGHTS}
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uOpacity;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uLightPos[MAX_LIGHTS];
  uniform vec3 uLightCol[MAX_LIGHTS];
  uniform float uLightRange[MAX_LIGHTS];
  uniform float uFlash;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vDepth;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.5) discard;
    vec3 base = tex.rgb * uColor * vColor;
    vec3 n = normalize(vNormalW);
    vec3 light = uAmbient;
    for (int i = 0; i < MAX_LIGHTS; i++) {
      vec3 L = uLightPos[i] - vWorld;
      float d = length(L);
      float att = clamp(1.0 - d / uLightRange[i], 0.0, 1.0);
      att *= att;
      float nd = max(dot(n, L / max(d, 0.0001)), 0.0) * 0.7 + 0.3;
      light += uLightCol[i] * att * nd;
    }
    light = floor(light * 7.0 + 0.5) / 7.0; // banded light, like old software renderers
    vec3 col = base * light + tex.rgb * vColor * uEmissive + vec3(uFlash);
    float f = smoothstep(uFogNear, uFogFar, vDepth);
    col = mix(col, uFogColor, f);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

let whiteTex = null;
export function whiteTexture() {
  if (!whiteTex) {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2);
    whiteTex = pixelTexture(c);
  }
  return whiteTex;
}

export function pixelTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function retroMaterial({ map = null, color = [1, 1, 1], emissive = [0, 0, 0], vertexColors = false, side = THREE.FrontSide, transparent = false, opacity = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      map: { value: map || whiteTexture() },
      uColor: { value: new THREE.Vector3(...color) },
      uEmissive: { value: new THREE.Vector3(...emissive) },
      uOpacity: { value: opacity },
      uFlash: { value: 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side,
    transparent,
    vertexColors,
  });
  if (vertexColors) m.defines = { USE_VCOLOR: '' };
  return m;
}

// the same look for skinned (rigged, animated) meshes: three's skinning chunks, then the PS1 snap
const vertSkinned = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  uniform vec2 uSnap;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vDepth;
  varying vec3 vColor;
  void main() {
    #include <skinbase_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * objectNormal);
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    vec4 cp = projectionMatrix * mv;
    if (cp.w > 0.0) {
      vec2 ndc = cp.xy / cp.w;
      ndc = floor(ndc * uSnap + 0.5) / uSnap;
      cp.xy = ndc * cp.w;
    }
    gl_Position = cp;
    vUv = uv;
    #ifdef USE_VCOLOR
      vColor = color;
    #else
      vColor = vec3(1.0);
    #endif
  }
`;
export function retroSkinnedMaterial(opts = {}) {
  const m = retroMaterial(opts);
  m.vertexShader = vertSkinned;
  return m;
}

// ---------- post pass ----------
const postVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const postFrag = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tUI;
  uniform vec2 uRes;
  uniform float uHurt;
  uniform float uScan;
  varying vec2 vUv;
  float bayer(vec2 p) {
    ivec2 i = ivec2(mod(p, 4.0));
    int idx = i.x + i.y * 4;
    float m[16];
    m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
    m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
    for (int k = 0; k < 16; k++) { if (k == idx) return m[k] / 16.0 - 0.5; }
    return 0.0;
  }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    vec2 px = floor(vUv * uRes);
    // 5-bit-per-channel color with ordered dithering
    float levels = 31.0;
    c = floor(c * levels + 0.5 + bayer(px)) / levels;
    // hurt tint toward the edges
    vec2 q = vUv - 0.5;
    float vig = dot(q, q);
    c = mix(c, vec3(0.7, 0.0, 0.0), clamp(uHurt * (0.25 + vig * 3.0), 0.0, 0.85));
    c *= 1.0 - vig * 0.9; // vignette
    // UI layer (already pixel-aligned to the same low-res grid)
    vec4 ui = texture2D(tUI, vUv);
    c = mix(c, ui.rgb, ui.a);
    // scanlines on the real screen pixels
    float s = mod(gl_FragCoord.y, 3.0) < 1.0 ? 1.0 - uScan : 1.0;
    gl_FragColor = vec4(c * s, 1.0);
  }
`;

export class RetroRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    // PC VR (Rift, Index, any headset driven by a desktop GPU): the context must be made XR-compatible
    // when it is CREATED. Otherwise entering VR calls makeXRCompatible(), which on a PC can move the
    // context to the headset's GPU by losing and restoring it: the page hangs ("not responding") or goes
    // black. Standalone headsets (Quest) never need the move, which is why VR only broke on PC.
    let context;
    try {
      if (typeof navigator !== 'undefined' && navigator.xr) {
        context = canvas.getContext('webgl2', { alpha: false, depth: true, stencil: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance', xrCompatible: true }) || undefined;
      }
    } catch (e) { context = undefined; }
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, powerPreference: 'high-performance' });
    // if the GPU ever drops the context (a driver reset, a headset plugged in), let it come back instead of dying
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('[cryptslop] WebGL context lost'); }, false);
    canvas.addEventListener('webglcontextrestored', () => { console.warn('[cryptslop] WebGL context restored'); try { this.resize(); } catch (err) { /* ignore */ } }, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.lowHeight = 240;
    this.rt = null;
    this.uiCanvas = document.createElement('canvas');
    // a CPU-side canvas: copying it into WebGL every frame is then a plain upload, with no GPU-to-GPU sync
    // that a desktop browser can stall on while it paces frames for a PC headset
    this.uiCtx = this.uiCanvas.getContext('2d', { willReadFrequently: true }) || this.uiCanvas.getContext('2d');
    this.uiTex = this.makeUiTexture();
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tUI: { value: this.uiTex }, uRes: { value: new THREE.Vector2(1, 1) },
        uHurt: { value: 0 }, uScan: { value: 0.12 },
      },
      vertexShader: postVert, fragmentShader: postFrag, depthTest: false, depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  makeUiTexture() {
    const t = new THREE.CanvasTexture(this.uiCanvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
    t.flipY = true;
    return t;
  }

  setLowHeight(h) { this.lowHeight = h; this.resize(); }

  resize() {
    if (this.renderer.xr && this.renderer.xr.isPresenting) { this.resizeLater = true; return; } // the headset owns the size; redo it when VR ends
    this.resizeLater = false;
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    const lh = this.lowHeight;
    const lw = Math.max(4, Math.round(lh * (w / h)));
    this.width = lw; this.height = lh; this.aspect = w / h;
    if (this.rt) this.rt.dispose();
    this.rt = new THREE.WebGLRenderTarget(lw, lh, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false,
    });
    this.postMat.uniforms.tScene.value = this.rt.texture;
    this.postMat.uniforms.uRes.value.set(lw, lh);
    this.uiCanvas.width = lw; this.uiCanvas.height = lh;
    this.uiCtx.imageSmoothingEnabled = false;
    // GPU texture storage is fixed-size once uploaded, so a resized canvas needs a fresh texture
    this.uiTex.dispose();
    this.uiTex = this.makeUiTexture();
    this.postMat.uniforms.tUI.value = this.uiTex;
    sharedUniforms.uSnap.value.set(lw / 2, lh / 2);
    if (this.onResize) this.onResize(lw, lh);
  }

  render(scene, camera, viewScene, viewCamera) {
    const r = this.renderer;
    r.info.autoReset = false; r.info.reset(); // count the whole frame, not just the last pass
    if (r.xr.isPresenting) { // VR: straight to the headset at full resolution (the HUD rides on a plane in front of the camera)
      // three.js has already bound the headset's framebuffer for this XR frame: do NOT setRenderTarget(null)
      // here, that sends the frame to the page canvas instead and the headset gets nothing (black, then
      // "page not responding")
      this.uiTex.needsUpdate = true;
      r.setClearColor(new THREE.Color(...sharedUniforms.uFogColor.value.toArray()), 1);
      r.clear(true, true, true);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.rt);
    r.setClearColor(new THREE.Color(...sharedUniforms.uFogColor.value.toArray()), 1);
    r.clear(true, true, true);
    r.render(scene, camera);
    if (viewScene) { r.clearDepth(); r.render(viewScene, viewCamera); }
    this.uiTex.needsUpdate = true;
    r.setRenderTarget(null);
    r.clear(true, true, true);
    r.render(this.postScene, this.postCam);
  }
}

// ---------- procedural pixel textures ----------
function noiseFill(g, w, h, base, amt, R) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (R() - 0.5) * amt;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
}

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// pointy-top honeycomb on a 16 x 32 period lattice (rows 16px apart, odd rows offset 8px), seamless in 32x32
function honeycomb(g, R, { edge, cell, honeyChance = 0, honey = [255, 190, 40], inset = 1 }) {
  g.fillStyle = edge; g.fillRect(0, 0, 32, 32);
  const hexPath = (cx, cy, rw, rh) => {
    g.beginPath();
    g.moveTo(cx, cy - rh); g.lineTo(cx + rw, cy - rh / 2); g.lineTo(cx + rw, cy + rh / 2);
    g.lineTo(cx, cy + rh); g.lineTo(cx - rw, cy + rh / 2); g.lineTo(cx - rw, cy - rh / 2); g.closePath();
  };
  for (let row = -1; row <= 2; row++) {
    for (let col = -1; col <= 2; col++) {
      const cx = col * 16 + (row % 2 ? 8 : 0) + 8, cy = row * 16;
      const filled = R() < honeyChance;
      const s = cell[0] + Math.floor(R() * 30) - 15;
      g.fillStyle = filled ? `rgb(${honey[0]},${honey[1] + Math.floor(R() * 30)},${honey[2]})` : `rgb(${s},${Math.max(0, s - cell[1])},${Math.max(0, s - cell[2])})`;
      hexPath(cx, cy, 8 - inset, 10.67 - inset * 1.2);
      g.fill();
      if (filled) { g.fillStyle = 'rgba(255,255,220,0.7)'; g.fillRect(cx - 3, cy - 4, 2, 2); }
    }
  }
}

export function makeLevelTextures() {
  const R = lcg(1337);
  // honeycomb walls (warm amber; themes tint on top)
  const brick = mkCanvas(32, 32); let g = brick.getContext('2d');
  honeycomb(g, R, { edge: '#5a3a14', cell: [200, 40, 120], honeyChance: 0.18 });
  noiseFill(g, 32, 32, 0, 26, R);
  // floor: packed wax hex tiles
  const slab = mkCanvas(32, 32); g = slab.getContext('2d');
  honeycomb(g, R, { edge: '#6a5030', cell: [170, 25, 70], inset: 1 });
  noiseFill(g, 32, 32, 0, 22, R);
  // ceiling: dark capped comb
  const plank = mkCanvas(32, 32); g = plank.getContext('2d');
  honeycomb(g, R, { edge: '#2a1a08', cell: [120, 30, 80], honeyChance: 0.08, honey: [200, 140, 30] });
  noiseFill(g, 32, 32, 0, 18, R);
  // platform: pressed wax plate
  const plate = mkCanvas(32, 32); g = plate.getContext('2d');
  g.fillStyle = '#c8a860'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#ecd490'; g.fillRect(0, 0, 32, 2); g.fillRect(0, 0, 2, 32);
  g.fillStyle = '#806030'; g.fillRect(0, 30, 32, 2); g.fillRect(30, 0, 2, 32);
  g.fillStyle = '#a88848';
  for (let y = 6; y < 28; y += 6) for (let x = 6 + (y % 12 ? 3 : 0); x < 28; x += 6) g.fillRect(x, y, 2, 1);
  noiseFill(g, 32, 32, 0, 20, R);
  // jump pad
  const pad = mkCanvas(32, 32); g = pad.getContext('2d');
  g.fillStyle = '#202830'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#ffd040';
  for (let k = 0; k < 3; k++) {
    const y = 6 + k * 8;
    for (let d = 0; d < 6; d++) { g.fillRect(16 - 6 + d, y + d, 2, 2); g.fillRect(16 + 4 - d, y + d, 2, 2); }
  }
  g.strokeStyle = '#ffd040'; g.strokeRect(1.5, 1.5, 29, 29);
  // gates: soft wax (cracked, glowing), hardened wax (dark, riveted), royal seal (crowned)
  const wax = mkCanvas(32, 32); g = wax.getContext('2d');
  honeycomb(g, R, { edge: '#c09030', cell: [250, 20, 140], inset: 2 });
  g.fillStyle = '#5a3a10';
  for (let k = 0; k < 14; k++) { const x = 6 + k * 1.5, y = 4 + ((k * 7) % 24); g.fillRect(Math.floor(x), Math.floor(y), 1, 3); }
  const hard = mkCanvas(32, 32); g = hard.getContext('2d');
  honeycomb(g, R, { edge: '#201008', cell: [110, 40, 70], inset: 1 });
  g.fillStyle = '#c0c0c0'; for (const [x, y] of [[3, 3], [27, 3], [3, 27], [27, 27], [15, 15]]) g.fillRect(x, y, 2, 2);
  const seal = mkCanvas(32, 32); g = seal.getContext('2d');
  g.fillStyle = '#601840'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#ffd040'; g.fillRect(9, 12, 14, 9); g.fillRect(9, 8, 2, 4); g.fillRect(15, 6, 2, 6); g.fillRect(21, 8, 2, 4);
  g.fillStyle = '#ff4060'; g.fillRect(15, 15, 2, 3);
  g.strokeStyle = '#ffd040'; g.strokeRect(1.5, 1.5, 29, 29);
  noiseFill(g, 32, 32, 0, 16, R);
  // city towers: lit and unlit windows
  const windows = mkCanvas(32, 32); g = windows.getContext('2d');
  g.fillStyle = '#20222e'; g.fillRect(0, 0, 32, 32);
  for (let y = 2; y < 32; y += 8) for (let x = 2; x < 32; x += 8) {
    const lit = R() < 0.45;
    g.fillStyle = lit ? (R() < 0.5 ? '#ffe08a' : '#8ae0ff') : '#30344a';
    g.fillRect(x, y, 5, 5);
  }
  g.fillStyle = '#14151c'; for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 32, 1);
  noiseFill(g, 32, 32, 0, 12, R);
  // REAL ROOMS: carpet, tile, floorboards, wallpaper
  const carpet = mkCanvas(32, 32); g = carpet.getContext('2d');
  g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, 32, 32); noiseFill(g, 32, 32, 0, 60, R);
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 32, 1);
  const tile = mkCanvas(32, 32); g = tile.getContext('2d');
  g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#9a9a9a'; for (let k = 0; k < 32; k += 8) { g.fillRect(k, 0, 1, 32); g.fillRect(0, k, 32, 1); }
  noiseFill(g, 32, 32, 0, 10, R);
  const wood = mkCanvas(32, 32); g = wood.getContext('2d');
  for (let y = 0; y < 32; y += 4) { const v = 170 + Math.floor(R() * 50); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, 32, 4); g.fillStyle = '#707070'; g.fillRect(0, y + 3, 32, 1); g.fillRect(Math.floor(R() * 32), y, 1, 3); }
  noiseFill(g, 32, 32, 0, 14, R);
  const paper = mkCanvas(32, 32); g = paper.getContext('2d');
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#c8c8c8'; for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 3, 32);
  g.fillStyle = '#b0b0b0'; g.fillRect(0, 26, 32, 6); // a dado rail
  noiseFill(g, 32, 32, 0, 8, R);
  return {
    carpet: pixelTexture(carpet), tile: pixelTexture(tile), wood: pixelTexture(wood), paper: pixelTexture(paper),
    windows: pixelTexture(windows),
    brick: pixelTexture(brick), slab: pixelTexture(slab), plank: pixelTexture(plank), plate: pixelTexture(plate), pad: pixelTexture(pad),
    wax: pixelTexture(wax), hard: pixelTexture(hard), seal: pixelTexture(seal),
  };
}
