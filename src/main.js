// Entry point: boot, Wavedash SDK hookup, main loop.
import { Game } from './game.js';
import { loadAssets } from './assets.js';
import { ensureStorage } from './save.js';
import { drawText, textWidth } from './font.js';
import { bfs, lineOfSight } from './mapgen.js';
import {
  makeGrunt, makeSpitter, makeBrute, makeWarden, makeIdol, makePlayerModel, makeOrb, makeProjectile, makeViewmodel,
  makeHorse, makeJavelin, makeSpinBall, makeHoneyDrop, makeWafer, makeKeyModel, makeItemPickup, makeSlots, makeWheel, makeDerby, makeBooth,
} from './models.js';

const WD = typeof window !== 'undefined' && window.Wavedash ? window.Wavedash : null;
const progress = (v) => { if (WD) { try { WD.updateLoadProgressZeroToOne(v); } catch (e) { /* ignore */ } } };

function warmShaders(game) {
  // compile every material variant during the loading screen, so the first fight doesn't hitch
  const props = [
    makeGrunt(), makeSpitter(), makeBrute(), makeWarden(), makeIdol(), makePlayerModel('#ffffff', 'WARM'), makeOrb(), makeProjectile(false), makeProjectile(true, true),
    makeViewmodel('#ffffff'), makeHorse(), makeJavelin(), makeSpinBall(true), makeHoneyDrop(), makeWafer(), makeKeyModel(), makeItemPickup('#ffffff'),
    makeSlots(), makeWheel(), makeDerby(), makeBooth(),
  ];
  for (const p of props) { p.position.set(game.map.spawn.x, 0, game.map.spawn.z); game.scene.add(p); }
  game.particles.burst(game.map.spawn.x, 1, game.map.spawn.z, 4, [1, 1, 1], 1);
  game.particles.tracer(0, 0, 0, 1, 1, 1);
  game.particles.update(0.016);
  game.rr.renderer.compile(game.scene, game.camera);
  game.updateCamera(0.016);
  game.updateLights();
  game.rr.render(game.scene, game.camera, game.viewScene, game.viewCam);
  for (const p of props) game.scene.remove(p);
}

async function boot() {
  progress(0.05);
  const storage = ensureStorage(); // a sandboxed frame may block localStorage: the cloud save then carries everything
  if (storage !== 'local') console.warn('[cryptslop] localStorage unavailable: progress lives in the cloud save');
  // the art team's models (bees, moth, hive, player, the hornet gun, the STOMPER): load first so every
  // enemy built afterwards uses them. Anything that fails falls back to the procedural model.
  try { await loadAssets('./models/', (f) => progress(0.05 + f * 0.4)); } catch (e) { console.warn('[cryptslop] assets', e); }
  const canvas = document.getElementById('game');
  const game = new Game(canvas, WD);
  window.__crypthop = game; // handy for debugging in the console
  window.__crypthopDev = { drawText, textWidth, bfs, lineOfSight };
  progress(0.6);
  warmShaders(game);
  progress(0.9);

  if (WD) {
    // the SDK is ready; reveal the game and open the event queue
    WD.init({ debug: false, deferEvents: true, p2p: { messageSize: 16384, maxIncomingMessages: 1024 } });
    // the Wavedash net layer registers its handlers here, before we flush deferred events
    game.makeOnlineNet();
    WD.readyForEvents();
    // CLOUD SAVES: pull the profile down and merge it in (a new build can start with empty storage)
    if (game.cloud) game.cloud.pull().then((changed) => { if (changed) game.reloadProfile(); game.persist(true); }).catch(() => {}).finally(() => game.checkWishNews());
    else game.checkWishNews();
    // followed an invite link? jump straight into that lobby
    try {
      const params = WD.getLaunchParams() || {};
      if (params.lobby) game.joinCoop(params.lobby);
    } catch (e) { /* ignore */ }
  }

  if (!WD) game.checkWishNews(); // the local build: the local Petition Bee server

  window.addEventListener('beforeunload', () => {
    try { game.stats.commit(); game.persist(true); } catch (e) { /* ignore */ }
    if (game.net && game.net.mode === 'local') game.net.leave();
  });

  let last = performance.now();
  const frame = (now) => {
    now = now || performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const t0 = performance.now();
    try {
      game.update(dt);
    } catch (e) {
      console.error('[crypthop] frame error', e);
      if (game.xr && game.xr.session) game.xr.note(`frame error: ${(e && e.message) || e}`);
    }
    if (game.xr && game.xr.session) game.xr.profile(performance.now() - t0, now); // VR: how long each headset frame takes
  };
  // the renderer drives the loop (requestAnimationFrame on a screen, the headset's own loop in VR)
  game.rr.renderer.setAnimationLoop(frame);
}

boot();
