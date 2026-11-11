# CRYPTSLOP

A low-poly, retro co-op roguelite FPS with Source-engine movement, set in a hive. Bunnyhop and air-strafe through procedurally generated crypts, clear each floor with a pump shotgun, take a boon, and descend. Every 5th floor a Warden waits.

Built for [Wavedash](https://wavedash.com): a static web build, with co-op over Wavedash lobbies and peer-to-peer networking.

## Play locally

```bash
npm install
npm run build      # bundles src/ into web/main.bundle.js
npm run serve      # http://localhost:8080 (sends the same cross-origin isolation headers as Wavedash)
```

Without the Wavedash SDK, the HOST/JOIN CO-OP buttons use a BroadcastChannel transport, so you can test co-op between two tabs of the same browser.

```bash
node tests/logic.test.mjs     # map gen, movement physics, simulation, host migration
node tests/features.test.mjs  # vaults, gates, horse, dash/slide/wall-kick, parry, gambling math, content
```

## Controls

| Key | Action |
|---|---|
| WASD / Mouse | Move / look |
| Left click | Fire the honey shotgun (throw a javelin while riding the horse) |
| Space or mouse wheel | Jump; in the air next to a wall, wall-kick (auto-bhop on by default) |
| Shift / C | Crouch; at speed, slide (crouch-jump for higher ledges). Ctrl is not bound because Ctrl+W closes the browser tab |
| Q / mouse 4-5 | Dash (2 charges). Dashing into a wax wall breaks it |
| Right click / V | Parry + sting. Reflects hornet spit, stuns wasps mid-swing |
| G | Throw a spin ball (curves with your turn, ricochets, spins foes). Thrown right after a perfect hop or at a gallop it becomes a Golden Spiral |
| F | Use your presidential active |
| E | Use a Honey Lounge machine, unlock a royal seal, dismount |
| 1 2 3 / 4 / 5 | Pick a boon / double-or-nothing / reroll for honey |
| I / M | Inventory (items, wafer upgrades, stats, map, hearts) / map |
| R | Reload |
| T / Enter | Chat (co-op). Messages made only of W's stack a party buff |
| Tab | Scoreboard |

## What's in a run

- **The hive:** the crypt is overrun by wasps, hornets, beetles and the Wasp Queen (every 5th floor). Every 10th floor the boss is VOX POPULI, an original idol hornet who attacks on the beat.
- **Movement:** Source bhop + air strafe, plus dashes, slides, wall kicks, and a style meter (BUZZ RANK, D to SSS) that multiplies honey.
- **Honey Lounge (spawn room):** Honey Slots (86% return), the Buzz Wheel, the Bee-Derby horse races, and the HIVE HEARTS dating booth (five original characters, one date per floor, blessings for your run).
- **Metroidvania vaults:** wax walls (dash), high nests (wall-kick), royal seals (find the floor's key), hardened wax (needs the Wax Drill). Vaults hold relics and wafers.
- **Presidential relics:** passives and actives based on objects US presidents famously owned or ran into (Taft's bathtub, Nixon's tape recorder, T. Roosevelt's big stick...).
- **Wafers:** a permanent currency spent on upgrades between runs.
- **The horse:** one floor in ten has a horse. Touch it to ride; riders throw javelins.
- **Solo pause:** pausing, or opening any machine or the inventory, freezes the whole simulation in solo. Co-op keeps running.
- **Soundtrack:** fully synthesized: an overtone-singing drone with breakcore drums, hyperpop supersaws and chopped vocal stabs; intensity follows your rank and boss floors.

## How it works

| File | What it does |
|---|---|
| `src/movement.js` | Source/Quake player physics at a fixed 100 Hz: `sv_accelerate`, `sv_airaccelerate`, the 30 u/s air wishspeed cap, friction, jump-before-friction bhop, crouch-jump, step-up |
| `src/mapgen.js` | Deterministic rooms-and-corridors generator. Every peer builds the identical floor from a shared seed |
| `src/sim.js` | Authoritative simulation run by the lobby host: flow-field enemy AI, projectiles, damage, boons, portal, runs |
| `src/net.js` | Transport layer: Wavedash lobbies + P2P (production), BroadcastChannel (local tabs), solo |
| `src/game.js` | Client: local player, shotgun hitscan, interpolation, host migration |
| `src/retro.js` | Low-res render target, PS1 vertex snapping, banded lighting, fog, 5-bit dithered color, scanlines |
| `src/ui.js`, `src/font.js` | Menus and HUD drawn with a hand-made 5x7 bitmap font |
| `src/audio.js` | Fully synthesized WebAudio sound effects and music |

**Multiplayer:** the lobby host simulates the world and broadcasts 20 Hz snapshots on the unreliable channel. Events, hits, and boons go over the reliable channel. Every player broadcasts their own movement at 30 Hz, so movement stays client-side and responsive. If the host leaves, Wavedash promotes another member, who rebuilds the simulation from their last snapshot and the run continues.

## Publishing to Wavedash

1. Install the CLI (PowerShell): `irm https://wavedash.com/cli/install.ps1 | iex`
2. `wavedash auth login`
3. In this folder: `wavedash init` (pick your team and create the game; this fills in `game_id` in `wavedash.toml`)
4. `npm run build`, then optionally `wavedash dev` to test against the real SDK sandbox (try co-op with a second account)
5. `wavedash build push -m "v1.0"`, which prints a build ID
6. Fill in the store page in the Developer Portal (below), then `wavedash publish <BUILD_ID>`

### Store page assets (in `store/`)

- **Wavedash hero banner:** `store/wavedash_banner.png` (1920x1080, "CRYPTSLOP / CO-OP ROGUELITE / BUNNY HOP - DESCEND" top center). `store/banner_bg.png` is the same shot without text.
- **Cover art:** `store/cover.png` (1920x1080)
- **Gameplay clip:** `store/gameplay_30s.mp4` (exactly 30 s, 1080p, no audio)
- **Preview video:** `store/preview.mp4` (21.7 s, 1080p, gameplay in the first 10 s). `store/trailer.mp4` is the longer cut, which opens on the title screen.
- **Marketing kit:** https://claude.ai/artifact/TsA5SYmHbzNWrG7QCoT9Ld (banners, social posts, story, capsule, press sheet)
- **Tags:** Action, FPS, Roguelike, Co-op, Multiplayer, Retro, Procedural
- **Input:** Keyboard & mouse
- **Language:** English

**Description:**

> Bunnyhop through a crumbling crypt with a pump shotgun and up to three friends. CRYPTSLOP is a low-poly co-op roguelike FPS with real Source-engine movement: air-strafe to build speed, chain perfect hops, and crouch-jump onto ledges while hordes of grunts, spitters, and brutes close in.
>
> Every floor is procedurally generated. Clear it to open the portal, pick one of three boons (more pellets, air control, double jumps, exploding kills, and more), and descend deeper. Every fifth floor, a Warden guards the way down.
>
> Wobbly vertices, dithered color, chunky pixels, and synthesized sound, straight out of a late-90s LAN party. Drop-in co-op for up to 4 players. Die, and you spectate until your team reaches the next floor. If everyone falls, the run is over.
