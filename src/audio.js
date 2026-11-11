// All sound is synthesized with WebAudio: no asset files, crunchy and retro.
export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.6;
    this.musicVol = 0.35;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.musicOn = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 1; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
      this.music = this.ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
      // a 12-bit-ish crusher for that sampler crunch
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.sfx) this.sfx.gain.value = sfx;
    if (this.music) this.music.gain.value = music;
  }

  // returns a destination node with distance attenuation + stereo pan for world-space sounds
  spatial(pos, range = 30) {
    if (!pos) return this.sfx;
    const L = this.listener;
    const dx = pos.x - L.x, dz = pos.z - L.z, dy = (pos.y || 0) - L.y;
    const d = Math.hypot(dx, dy, dz);
    const vol = Math.max(0, 1 - d / range);
    if (vol <= 0.01) return null;
    const g = this.ctx.createGain(); g.gain.value = vol * vol;
    // right vector of the listener
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = pan * 0.8;
      g.connect(p); p.connect(this.sfx);
    } else g.connect(this.sfx);
    return g;
  }

  tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, pos = null, range, delay = 0 }) {
    if (!this.ctx) return;
    const out = this.spatial(pos, range); if (!out) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.4, f0 = 3000, f1 = 300, q = 0.8, pos = null, range, type = 'lowpass', delay = 0 }) {
    if (!this.ctx) return;
    const out = this.spatial(pos, range); if (!out) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.5 + Math.random() * 0.2; // lower rate = grittier
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name, pos = null) {
    if (!this.ctx) return;
    switch (name) {
      case 'shotgun':
        this.noise({ dur: 0.35, vol: 0.9, f0: 5000, f1: 200, pos });
        this.tone({ type: 'sawtooth', f0: 140, f1: 40, dur: 0.18, vol: 0.5, pos });
        break;
      case 'pump':
        this.noise({ dur: 0.05, vol: 0.3, f0: 2500, f1: 1500, type: 'bandpass', q: 3, pos, delay: 0.0 });
        this.noise({ dur: 0.06, vol: 0.35, f0: 1800, f1: 900, type: 'bandpass', q: 3, pos, delay: 0.12 });
        break;
      case 'shell':
        this.tone({ type: 'square', f0: 900, f1: 700, dur: 0.04, vol: 0.12 });
        this.noise({ dur: 0.04, vol: 0.2, f0: 3000, f1: 2000, type: 'bandpass', q: 4, delay: 0.03 });
        break;
      case 'empty':
        this.tone({ type: 'square', f0: 300, f1: 280, dur: 0.04, vol: 0.12 }); break;
      case 'hit':
        this.tone({ type: 'square', f0: 1400, f1: 1200, dur: 0.05, vol: 0.12 }); break;
      case 'headshot':
        this.tone({ type: 'square', f0: 1900, f1: 1700, dur: 0.07, vol: 0.15 }); break;
      case 'kill':
        this.tone({ type: 'square', f0: 660, f1: 220, dur: 0.18, vol: 0.18 });
        this.noise({ dur: 0.25, vol: 0.4, f0: 1200, f1: 100, pos }); break;
      case 'land':
        this.noise({ dur: 0.08, vol: 0.25, f0: 600, f1: 100 }); break;
      case 'step':
        this.noise({ dur: 0.05, vol: 0.08, f0: 900, f1: 300 }); break;
      case 'jump':
        this.noise({ dur: 0.04, vol: 0.05, f0: 1200, f1: 600 }); break;
      case 'airjump':
        this.tone({ type: 'triangle', f0: 300, f1: 900, dur: 0.15, vol: 0.2 }); break;
      case 'pad':
        this.tone({ type: 'square', f0: 200, f1: 1200, dur: 0.3, vol: 0.18, pos }); break;
      case 'hurt':
        this.tone({ type: 'square', f0: 180, f1: 90, dur: 0.15, vol: 0.3 });
        this.noise({ dur: 0.1, vol: 0.3, f0: 800, f1: 200 }); break;
      case 'growl':
        this.tone({ type: 'sawtooth', f0: 120 + Math.random() * 40, f1: 60, dur: 0.4, vol: 0.3, pos, range: 25 }); break;
      case 'swing':
        this.noise({ dur: 0.15, vol: 0.35, f0: 400, f1: 2000, type: 'bandpass', q: 1.5, pos, range: 20 }); break;
      case 'spit':
        this.noise({ dur: 0.25, vol: 0.4, f0: 3000, f1: 400, type: 'bandpass', q: 2, pos, range: 35 });
        this.tone({ type: 'triangle', f0: 500, f1: 150, dur: 0.2, vol: 0.2, pos, range: 35 }); break;
      case 'splat':
        this.noise({ dur: 0.12, vol: 0.3, f0: 900, f1: 150, pos, range: 25 }); break;
      case 'boom':
        this.noise({ dur: 0.6, vol: 0.9, f0: 1500, f1: 60, pos, range: 45 });
        this.tone({ type: 'sine', f0: 90, f1: 30, dur: 0.5, vol: 0.6, pos, range: 45 }); break;
      case 'orb':
        this.tone({ type: 'triangle', f0: 600, f1: 1200, dur: 0.12, vol: 0.2 });
        this.tone({ type: 'triangle', f0: 900, f1: 1800, dur: 0.12, vol: 0.15, delay: 0.08 }); break;
      case 'portal':
        [261, 329, 392, 523].forEach((f, i) => this.tone({ type: 'triangle', f0: f, f1: f, dur: 0.6, vol: 0.15, delay: i * 0.1 })); break;
      case 'tick':
        this.tone({ type: 'square', f0: 880, f1: 880, dur: 0.06, vol: 0.12 }); break;
      case 'descend':
        this.tone({ type: 'sawtooth', f0: 800, f1: 40, dur: 1.2, vol: 0.25 });
        this.noise({ dur: 1.2, vol: 0.3, f0: 4000, f1: 100 }); break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'square', f0: f, f1: f, dur: 0.1, vol: 0.12, delay: i * 0.06 })); break;
      case 'die':
        this.tone({ type: 'sawtooth', f0: 400, f1: 30, dur: 1.4, vol: 0.35 }); break;
      case 'boss':
        this.tone({ type: 'sawtooth', f0: 70, f1: 50, dur: 1.5, vol: 0.4 });
        this.tone({ type: 'sawtooth', f0: 105, f1: 74, dur: 1.5, vol: 0.3 }); break;
      case 'ui':
        this.tone({ type: 'square', f0: 700, f1: 700, dur: 0.04, vol: 0.1 }); break;
      case 'chat':
        this.tone({ type: 'triangle', f0: 1000, f1: 1000, dur: 0.05, vol: 0.1 }); break;
      case 'scream': { // shot! a short synthesized yelp through an AAH formant
        if (!this.ctx) break;
        const c = this.ctx, t = c.currentTime;
        const f0 = 380 + Math.random() * 220;
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.45, t + 0.08); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.42);
        const vib = c.createOscillator(); vib.frequency.value = 28; const vg = c.createGain(); vg.gain.value = f0 * 0.04; vib.connect(vg); vg.connect(o.frequency);
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        for (const [ff, q] of [[850, 6], [1250, 7], [2700, 9]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = q; o.connect(b); b.connect(g); }
        g.connect(this.sfx);
        o.start(t); vib.start(t); o.stop(t + 0.5); vib.stop(t + 0.5);
        this.noise({ dur: 0.3, vol: 0.12, f0: 3500, f1: 1500, type: 'bandpass', q: 1.5 });
        break;
      }
      case 'fire':
        this.noise({ dur: 0.9, vol: 0.45, f0: 900, f1: 250, pos });
        this.noise({ dur: 0.25, vol: 0.5, f0: 4000, f1: 800, type: 'highpass', q: 0.7, pos }); break;
      case 'slash': // a huge whoosh with a metallic ring and a thump
        this.noise({ dur: 0.4, vol: 0.7, f0: 250, f1: 6000, type: 'bandpass', q: 1.2 });
        this.tone({ type: 'sawtooth', f0: 120, f1: 40, dur: 0.3, vol: 0.35 });
        [1760, 2349].forEach((f, i) => this.tone({ type: 'triangle', f0: f, f1: f * 0.98, dur: 0.5, vol: 0.06, delay: 0.05 + i * 0.03 })); break;
      case 'charge':
        this.tone({ type: 'sawtooth', f0: 110, f1: 440, dur: 0.9, vol: 0.08 }); break;
      case 'knife':
        this.noise({ dur: 0.12, vol: 0.25, f0: 2500, f1: 7000, type: 'bandpass', q: 3 }); break;
      case 'ping':
        this.tone({ type: 'triangle', f0: 1568, f1: 1568, dur: 0.08, vol: 0.14 });
        this.tone({ type: 'triangle', f0: 2093, f1: 2093, dur: 0.14, vol: 0.12, delay: 0.08 }); break;
      case 'micro': // the microgame sting: a fast rising arpeggio and a cymbal
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone({ type: 'square', f0: f, f1: f, dur: 0.06, vol: 0.12, delay: i * 0.05 }));
        this.noise({ dur: 0.4, vol: 0.3, f0: 9000, f1: 4000, type: 'highpass', q: 0.7, delay: 0.3 }); break;
      case 'sing': { // a default-voicebank syllable: formant-ish square + triangle with a pitch bend
        const f = [523, 587, 659, 784, 880][Math.floor(Math.random() * 5)];
        this.tone({ type: 'square', f0: f, f1: f * (Math.random() < 0.3 ? 1.5 : 1.02), dur: 0.1, vol: 0.06 });
        this.tone({ type: 'triangle', f0: f * 2.01, f1: f * 2, dur: 0.08, vol: 0.04 });
        this.noise({ dur: 0.02, vol: 0.06, f0: 6000, f1: 3000, type: 'bandpass', q: 2 });
        break;
      }
      case 'buzz': // wasps don't growl, they buzz
        this.tone({ type: 'sawtooth', f0: 210 + Math.random() * 60, f1: 180, dur: 0.35, vol: 0.18, pos, range: 25 });
        this.tone({ type: 'sawtooth', f0: 223 + Math.random() * 60, f1: 190, dur: 0.35, vol: 0.14, pos, range: 25 }); break;
      case 'dash':
        this.noise({ dur: 0.22, vol: 0.45, f0: 600, f1: 4000, type: 'bandpass', q: 2 });
        this.tone({ type: 'sawtooth', f0: 180, f1: 420, dur: 0.18, vol: 0.12 }); break;
      case 'walljump':
        this.noise({ dur: 0.06, vol: 0.3, f0: 1500, f1: 400 });
        this.tone({ type: 'triangle', f0: 420, f1: 980, dur: 0.12, vol: 0.18 }); break;
      case 'slide':
        this.noise({ dur: 0.45, vol: 0.18, f0: 2400, f1: 900, type: 'bandpass', q: 1.2 }); break;
      case 'parry':
        [1568, 2093, 3136].forEach((f, i) => this.tone({ type: 'square', f0: f, f1: f * 0.98, dur: 0.35 - i * 0.08, vol: 0.16 }));
        this.noise({ dur: 0.12, vol: 0.5, f0: 8000, f1: 3000, type: 'highpass', q: 0.7 }); break;
      case 'sting':
        this.noise({ dur: 0.1, vol: 0.3, f0: 900, f1: 5000, type: 'bandpass', q: 3 }); break;
      case 'coin':
        this.tone({ type: 'square', f0: 988, f1: 988, dur: 0.06, vol: 0.1 });
        this.tone({ type: 'square', f0: 1319, f1: 1319, dur: 0.2, vol: 0.1, delay: 0.06 }); break;
      case 'reel':
        this.tone({ type: 'square', f0: 520 + Math.random() * 80, f1: 400, dur: 0.03, vol: 0.06 }); break;
      case 'reelstop':
        this.noise({ dur: 0.05, vol: 0.25, f0: 2000, f1: 500, type: 'bandpass', q: 2 }); break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ type: 'square', f0: f, f1: f, dur: 0.12, vol: 0.12, delay: i * 0.07 })); break;
      case 'jackpot':
        for (let i = 0; i < 16; i++) this.tone({ type: i % 2 ? 'square' : 'triangle', f0: 523 * Math.pow(2, (i % 8) / 12 * 2), f1: 1046, dur: 0.14, vol: 0.12, delay: i * 0.08 });
        for (let i = 0; i < 10; i++) this.tone({ type: 'square', f0: 2000 + Math.random() * 2000, f1: 1500, dur: 0.05, vol: 0.05, delay: 0.2 + i * 0.11 }); break;
      case 'lose':
        [392, 370, 349, 262].forEach((f, i) => this.tone({ type: 'sawtooth', f0: f, f1: i === 3 ? f * 0.8 : f, dur: i === 3 ? 0.6 : 0.22, vol: 0.12, delay: i * 0.24 })); break;
      case 'wheeltick':
        this.tone({ type: 'square', f0: 1200, f1: 900, dur: 0.02, vol: 0.06 }); break;
      case 'heart':
        [659, 784, 988].forEach((f, i) => this.tone({ type: 'triangle', f0: f, f1: f, dur: 0.25, vol: 0.12, delay: i * 0.12 })); break;
      case 'heartbreak':
        this.tone({ type: 'triangle', f0: 600, f1: 200, dur: 0.6, vol: 0.15 }); break;
      case 'neigh':
        this.tone({ type: 'sawtooth', f0: 700, f1: 1100, dur: 0.15, vol: 0.18, pos });
        this.tone({ type: 'sawtooth', f0: 1100, f1: 500, dur: 0.5, vol: 0.16, pos, delay: 0.15 });
        this.noise({ dur: 0.5, vol: 0.12, f0: 2500, f1: 800, type: 'bandpass', q: 3, pos, delay: 0.1 }); break;
      case 'gallop':
        this.noise({ dur: 0.04, vol: 0.18, f0: 700, f1: 200 });
        this.noise({ dur: 0.04, vol: 0.14, f0: 700, f1: 200, delay: 0.07 }); break;
      case 'javelin':
        this.noise({ dur: 0.3, vol: 0.4, f0: 300, f1: 3000, type: 'bandpass', q: 2.5 }); break;
      case 'thunk':
        this.tone({ type: 'square', f0: 160, f1: 70, dur: 0.12, vol: 0.25, pos });
        this.noise({ dur: 0.08, vol: 0.3, f0: 1200, f1: 300, pos }); break;
      case 'item':
        [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone({ type: 'square', f0: f, f1: f, dur: 0.1, vol: 0.1, delay: i * 0.05 })); break;
      case 'wafer':
        this.tone({ type: 'triangle', f0: 1400, f1: 2200, dur: 0.1, vol: 0.12 }); break;
      case 'break':
        this.noise({ dur: 0.5, vol: 0.7, f0: 1800, f1: 120 });
        this.tone({ type: 'square', f0: 220, f1: 60, dur: 0.3, vol: 0.2 }); break;
      case 'deny':
        this.tone({ type: 'square', f0: 160, f1: 150, dur: 0.15, vol: 0.12 });
        this.tone({ type: 'square', f0: 120, f1: 110, dur: 0.2, vol: 0.12, delay: 0.15 }); break;
      case 'active':
        this.tone({ type: 'sawtooth', f0: 110, f1: 880, dur: 0.25, vol: 0.2 });
        this.noise({ dur: 0.4, vol: 0.4, f0: 3000, f1: 200 }); break;
      case 'rewind':
        this.tone({ type: 'sawtooth', f0: 1200, f1: 150, dur: 0.5, vol: 0.15 });
        this.tone({ type: 'sawtooth', f0: 900, f1: 100, dur: 0.5, vol: 0.12, delay: 0.05 }); break;
      case 'rank':
        this.tone({ type: 'square', f0: 880, f1: 1760, dur: 0.15, vol: 0.1 }); break;
    }
  }

  // ===================== STREAMED SONGS =====================
  // Real recorded tracks: the hive theme (from the art team) and the LAST BEE STANDING song.
  // They run through the music volume. While one plays, the synthesized score goes quiet.
  setTrack(name) {
    if (!this.ctx || this.trackName === name) return;
    this.trackName = name;
    const files = { main: 'cryptslop1', last: 'laststand', frozen: 'frozen.mp3' }; // a name with an extension is used as it is
    if (!this.tracks) this.tracks = {};
    for (const [k, t] of Object.entries(this.tracks)) if (k !== name) { try { t.el.pause(); } catch (e) { /* ignore */ } }
    // the synthesized score steps aside for a song, except the throat-singing drone, which keeps going underneath, quietly
    if (this.droneGain) this.droneGain.gain.setTargetAtTime(name ? 0.16 : 0.55, this.ctx.currentTime, 0.4);
    if (!name || !files[name]) return;
    let t = this.tracks[name];
    if (!t) {
      const el = new Audio();
      const ogg = el.canPlayType && el.canPlayType('audio/ogg; codecs=opus');
      el.src = files[name].includes('.') ? `./audio/${files[name]}` : `./audio/${files[name]}.${ogg ? 'ogg' : 'm4a'}`;
      el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
      t = { el, node: null };
      try { t.node = this.ctx.createMediaElementSource(el); t.node.connect(this.music); } catch (e) { el.volume = this.musicVol; }
      this.tracks[name] = t;
    }
    if (name === 'last') { try { t.el.currentTime = 0; } catch (e) { /* ignore */ } }
    const p = t.el.play(); if (p && p.catch) p.catch(() => { this.trackName = null; }); // blocked until a click: try again next time
  }

  // ===================== THE OST =====================
  // An original, fully synthesized score: a Tibetan-style overtone drone (a low voice whose
  // harmonics are sung one by one through narrow formant filters) under breakcore drums,
  // hyperpop supersaw chords and dariacore-style chopped, pitch-bent vocal stabs.
  // intensity 0 = the lounge (drone + pads), 1 = a floor, 2 = boss / high BUZZ RANK (everything).
  startMusic(seed = 1) {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    if (this.intensity === undefined) this.intensity = 1;
    this.setTheme(seed);
    this.buildBus();
    this.startDrone();
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setTheme(seed) {
    const roots = [45, 43, 48, 41]; // A, G, C, F
    this.root = roots[(seed - 1 + 400) % roots.length];
    this.bpm = 182 + (seed % 3) * 6; // breakcore tempo
    if (this.droneOsc) this.tuneDrone();
  }

  setIntensity(i) { this.intensity = Math.max(0, Math.min(2, i | 0)); }

  stopMusic() {
    this.musicOn = false;
    if (this.tracks) for (const t of Object.values(this.tracks)) { try { t.el.pause(); } catch (e) { /* ignore */ } }
    this.trackName = null;
    clearInterval(this.timer);
    if (this.droneOsc) {
      const t = this.ctx.currentTime;
      try { this.droneGain.gain.setTargetAtTime(0, t, 0.2); } catch (e) { /* ignore */ }
      const oscs = this.droneOsc;
      setTimeout(() => { for (const o of oscs) { try { o.stop(); } catch (e) { /* ignore */ } } }, 1200);
      this.droneOsc = null;
    }
  }

  buildBus() {
    if (this.bus) return;
    const c = this.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0.9;
    // a little crunch (hyperpop loves clipping)
    const ws = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8); }
    ws.curve = curve;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
    this.bus.connect(ws); ws.connect(comp); comp.connect(this.music);
  }

  startDrone() {
    const c = this.ctx;
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0;
    this.droneGain.connect(this.bus);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'sawtooth';
    o1.connect(lp); o2.connect(lp);
    // the chest voice (fundamental, kept quiet) + the "OM" vowel formant
    const body = c.createGain(); body.gain.value = 0.05; lp.connect(body); body.connect(this.droneGain);
    const vowel = c.createBiquadFilter(); vowel.type = 'bandpass'; vowel.frequency.value = 520; vowel.Q.value = 5;
    const vg = c.createGain(); vg.gain.value = 0.22; lp.connect(vowel); vowel.connect(vg); vg.connect(this.droneGain);
    // two whistling overtones: very narrow bandpasses parked on single harmonics
    this.ovt = [0, 1].map(() => {
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 38;
      const g = c.createGain(); g.gain.value = 0.9;
      lp.connect(f); f.connect(g); g.connect(this.droneGain);
      return f;
    });
    o1.start(); o2.start();
    this.droneOsc = [o1, o2];
    this.tuneDrone();
    this.droneGain.gain.setTargetAtTime(0.55, c.currentTime, 1.5);
  }

  tuneDrone() {
    const f0 = 440 * Math.pow(2, (this.root - 24 - 69) / 12); // two octaves under the key: monk register
    this.droneF0 = f0;
    const t = this.ctx.currentTime;
    this.droneOsc[0].frequency.setTargetAtTime(f0, t, 0.3);
    this.droneOsc[1].frequency.setTargetAtTime(f0 * 1.004, t, 0.3);
  }

  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const sixteenth = 60 / this.bpm / 4;
    const I = this.intensity;
    const prog = [0, 7, 9, 5]; // I V vi IV, the hyperpop staple
    const overtoneLine = [8, 9, 10, 12, 10, 9, 8, 6, 8, 10, 12, 16, 12, 10, 9, 8];
    const note = (m) => 440 * Math.pow(2, (m - 69) / 12);
    while (this.nextNote < this.ctx.currentTime + 0.2) {
      const t = this.nextNote;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const chordRoot = this.root + prog[bar % 4];
      // --- throat singing: move the whistle to the next harmonic every half bar ---
      if (s % 8 === 0 && this.ovt) {
        const h = overtoneLine[(Math.floor(this.step / 8)) % overtoneLine.length];
        this.ovt[0].frequency.setTargetAtTime(this.droneF0 * h, t, 0.06);
        this.ovt[1].frequency.setTargetAtTime(this.droneF0 * (h + (I >= 2 ? 4 : 2)), t, 0.09);
      }
      // breathing swell
      if (s === 0 && this.droneGain) {
        const g = this.droneGain.gain;
        const k = this.trackName ? 0.35 : 1; // under a recorded song the drone sings quietly
        g.setTargetAtTime((I === 0 ? 0.7 : 0.45) * k, t, 0.05);
        g.setTargetAtTime((I === 0 ? 0.5 : 0.3) * k, t + sixteenth * 12, 0.3);
      }
      if (this.trackName) { this.nextNote += sixteenth; this.step++; continue; } // a song is playing: only the throat-singing drone stays
      // --- hyperpop supersaw pads / stabs ---
      if (I === 0 && s === 0) this.supersaw(chordRoot, t, sixteenth * 16, 0.018, true);
      if (I >= 1 && s % 4 === 2) this.supersaw(chordRoot + 12, t, sixteenth * 2.2, I >= 2 ? 0.03 : 0.022, false);
      // --- arps (pitched way up) ---
      if (I >= 1) {
        const arp = [0, 4, 7, 12, 16, 12, 7, 4];
        if (s % 2 === 0 || I >= 2) this.blip('square', note(chordRoot + 24 + arp[this.step % 8]), t, sixteenth * 0.8, I >= 2 ? 0.02 : 0.015);
      }
      // --- breakcore drums (the lounge gets a lazy half-speed version) ---
      if (I >= 1) this.drums(s, bar, t, sixteenth, I);
      else if (s % 2 === 0) { const h = s / 2; if (h === 0 || h === 5) this.kick(t); else if (h === 2 || h === 6) this.snare(t, 0.12, 0.9); if (h % 2 === 1) this.hatM(t, 0.01); }
      // --- reese bass ---
      if (I >= 1 && s === 0) this.reese(note(chordRoot - 24), t, sixteenth * (bar % 2 ? 8 : 16), I >= 2 ? 0.09 : 0.06);
      // --- 808 glide bass ---
      if (I >= 1 && (s === 0 || s === 10)) this.bass808(note(chordRoot - 12), t, sixteenth * (s === 0 ? 8 : 5), s === 10 && I >= 2);
      // --- dariacore vocal chops ---
      if (I >= 2 && Math.random() < 0.35 && s % 2 === 1) {
        const tones = [0, 4, 7, 12];
        const m = chordRoot + 12 + tones[Math.floor(Math.random() * tones.length)];
        const stutter = Math.random() < 0.3 ? 3 : 1;
        for (let k = 0; k < stutter; k++) this.chop(note(m), t + k * sixteenth / 2, sixteenth * (stutter > 1 ? 0.45 : 0.9), Math.random() < 0.3);
      }
      this.step++;
      this.nextNote += sixteenth;
    }
  }

  blip(type, f, t, dur, vol) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
  }

  supersaw(rootMidi, t, dur, vol, pad) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = pad ? 1800 : 5200;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + (pad ? 0.4 : 0.06)); // the "sidechain" swell after the kick
    g.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.2);
    lp.connect(g); g.connect(this.bus);
    for (const iv of [0, 4, 7]) {
      const f = 440 * Math.pow(2, (rootMidi + iv - 69) / 12);
      for (const det of [-0.012, 0, 0.012]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * (1 + det);
        o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
      }
    }
  }

  drums(s, bar, t, six, I) {
    // BREAKCORE: amen-style breaks (K kick, S snare, g ghost snare, h open hat), sliced and rearranged
    const BREAKS = ['K.K.S.gSgSK.S.gS', 'K.KgS.gK.KK.S.gS', 'K..KS.K..KS.KSSS', 'KgK.S.gSK.gKS.SS', 'K.S.K.S.KKS.gSgS'];
    if (s === 0) { // a new bar: pick a break and decide how to mangle it
      this.brk = BREAKS[(bar * 7 + (Math.random() < 0.3 ? 1 : 0)) % BREAKS.length];
      this.halftime = I >= 1 && bar % 8 === 7 && Math.random() < 0.5; // the drop: a half-time bar
      this.slice = null;
    }
    // rearrange: every beat may jump to a random slice of the break, and repeat it
    if (s % 4 === 0) this.slice = Math.random() < (I >= 2 ? 0.45 : 0.25) ? Math.floor(Math.random() * 4) * 4 : null;
    const src = this.slice === null ? s : this.slice + (s % 4);
    let ch = (this.brk || BREAKS[0])[src];
    if (this.halftime) ch = s % 8 === 0 ? 'K' : s % 8 === 4 && s >= 8 ? 'S' : '.';
    // rolls at the end of a phrase: 16ths -> 32nds -> 64ths, pitching up
    const phraseEnd = bar % 4 === 3 && s >= 12;
    if (phraseEnd && I >= 1 && Math.random() < (I >= 2 ? 0.85 : 0.5)) {
      const n = s >= 14 ? 4 : 2;
      for (let k = 0; k < n; k++) this.snare(t + (k * six) / n, 0.16 + 0.04 * k, 1 + (s - 12) * 0.15 + k * 0.05);
    } else if (ch === 'K') { this.kick(t); if (I >= 2 && Math.random() < 0.25) this.kick(t + six / 2); }
    else if (ch === 'S') this.snare(t, 0.32, Math.random() < 0.15 ? 1.25 : 1);
    else if (ch === 'g') this.snare(t, 0.09, 1.1);
    // hats on every 16th, louder off-beats, a crash at every phrase
    this.hatM(t, s % 4 === 2 ? 0.035 : 0.02);
    if (I >= 2 && Math.random() < 0.3) this.hatM(t + six / 2, 0.012);
    if (s === 0 && bar % 4 === 0) this.crash(t, I >= 2 ? 0.16 : 0.1);
  }

  crash(t, vol) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t); s.stop(t + 1.2);
  }

  // a distorted, detuned reese bass that growls under the breaks
  reese(f, t, dur, vol) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(900, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(260, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setTargetAtTime(0, t + dur * 0.85, dur * 0.1);
    lp.connect(g); g.connect(this.bus);
    for (const det of [-0.018, 0.018]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * (1 + det);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.35);
  }

  snare(t, vol, pitch) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = pitch;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900 * pitch; f.Q.value = 0.9;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + 0.16);
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(200 * pitch, t); o.frequency.exponentialRampToValueAtTime(150 * pitch, t + 0.08);
    const og = c.createGain(); og.gain.setValueAtTime(vol * 0.6, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(og); og.connect(this.bus); o.start(t); o.stop(t + 0.1);
  }

  hatM(t, vol) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + 0.05);
  }

  bass808(f, t, dur, glide) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * 0.6);
    const g = c.createGain(); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05);
  }

  chop(f, t, dur, bend) {
    // a fake vocal: sawtooth through two vowel formants, sometimes bent up an octave
    const c = this.ctx;
    const vowels = [[800, 1150], [270, 2300], [450, 800], [350, 2000]];
    const [f1, f2] = vowels[Math.floor(Math.random() * vowels.length)];
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(f * 2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const ff of [f1, f2]) {
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff * (bend ? 1.25 : 1); b.Q.value = 7;
      o.connect(b); b.connect(g);
    }
    g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
}
