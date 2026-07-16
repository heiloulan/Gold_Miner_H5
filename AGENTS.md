# Gold-Miner Architecture Notes & Development Guide

> Scope: `Gold-Miner/` and all subdirectories.
> Current baseline: the 2026-07-15 "hybrid restoration" build (30 original layouts + calibrated swing/reel/mole/bag semantics + original screens/HUD/claw art at the original 550×400 proportions).
> Any change to architecture, values, assets, or state machines must update this document in the same change; original-SWF evidence is recorded in [`FLASH_PARITY.md`](FLASH_PARITY.md).

## 1. Product Boundary

This is a Canvas 2D H5 re-implementation of the classic Flash "Gold Miner" — not an SWF player.

- `Gold-Miner.swf` is the original evidence for gameplay, timeline, art, and values.
- `game/` is the only runtime artifact, built with zero-build native ES Modules.
- Intentional H5 adaptations kept: endless level goals after level 11, click-to-aim enabled only via the cheat code, the Chinese canvas shop UI, and the simplified ready screen (original title had a slot-machine lever + instruction pages).
- The canvas is `715×520` — the original `550×400` stage at an exact uniform `×1.3` with no margins, so on-screen proportions match the original.
- Original semantics restored: the 30 original prefab layouts, the five-product shop, cumulative level goals, object values/weights, rectangular hitboxes, pull speeds, mystery bags, buff lifecycles, one-sided mole patrol, miner timeline boundaries and asset anchors, early settlement (the original Exit Level button), TNT normal-catch, and left/right-arrow hook abort.
- Original screens & art restored (2026-07-15, evidence in FLASH_PARITY.md §11): the full-screen "Your First/Next Goal is" splash, the "You made it to the next Level!" win cutscene, the "You Did Not Reach Your Goal" game-over screen, the in-level background/HUD art (dirt layers, yellow bar + blue arch, English HUD labels, Exit Level button), the original claw frames (per-object "claw holding item" art, so grabs look right at any angle), the shop owner's yes/no farewell animation, and the 14-frame explosion effect.
- Not restored (documented differences, FLASH_PARITY.md §10): the original title screen, the original shop interior, the score-delivery flying animation (`/:busy`), the flying dynamite projectile, and save games.

Future work continues on this "hybrid restoration" track by default. Only replace infinite mode or click-to-aim with pure-original behavior when explicitly requested.

## 2. Directory & Runtime Boundaries

```text
Gold-Miner/
├── AGENTS.md                 # Architecture & development constraints
├── FLASH_PARITY.md           # SWF cross-reference, values, intentional differences
├── Gold-Miner.swf            # Read-only reference baseline
├── ffdec/                    # JPEXS tool snapshot, not a runtime dependency
├── assets*/                  # SWF export/rasterization intermediates, not runtime deps
└── game/
    ├── index.html            # Page & canvas entry point
    ├── style.css             # Responsive display layer; never changes internal physics size
    ├── package.json          # Declares ESM & node:test only; no third-party deps
    ├── assets/               # 126 PNG + 11 WAV, all in the explicit manifest
    ├── src/
    │   ├── main.js           # Assembly, hash debug flags, rAF main loop
    │   ├── config.js         # Coordinates, goals, types, hitboxes, speeds, shop layout
    │   ├── random.js         # Injectable/reproducible RNG
    │   ├── geometry.js       # Pure geometry: projection, direction, hook tip, rect hit
    │   ├── manifest.js       # The single runtime manifest for images/sounds/animations
    │   ├── assets.js         # Browser preloading, caching, playback, error surfacing
    │   ├── levels.js         # Level assembly, bag weight & rewards, mole patrol init
    │   ├── layouts.js        # The 30 original prefab layouts (raw SWF coords) + level cycling
    │   ├── shop.js           # Shop generation, pricing, stocking, purchase transactions
    │   ├── state.js          # GameState init & explicit scene transitions
    │   ├── update.js         # Time, hook, collisions, settlement, animation state
    │   ├── input.js          # Pointer/keyboard → game-action adapter
    │   └── render.js         # Read-only canvas rendering
    └── test/                 # node:test: geometry, original values, shop, state, assets
```

The browser may only read from `game/`. The root `assets*` directories are original evidence and re-processing sources; runtime code must never reference them across directories. New assets must be copied into `game/assets/` and registered in `manifest.js`.

## 3. Running & Verification

There is no build step. The game must be served over static HTTP; do not rely on `file://` module behavior.

```bash
cd Gold-Miner/game
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/`.

If the module graph fails to load (no server, `file://`, or stale-cached modules after an update), the page shows a red boot-error banner (inline script in `index.html`) instead of failing silently to a blank canvas; a hard refresh (Ctrl+F5) clears mixed-version module caches.

Automated tests:

```bash
cd Gold-Miner/game
npm test
```

`npm test` installs nothing; it runs `node --test`. The asset tests require a strict one-to-one match between the runtime directory and the manifest: 126 PNGs and 11 WAVs — none missing, no undeclared leftovers.

Visual verification without a Linux browser (this WSL2 box has none): Windows Chrome works headlessly against the WSL static server, e.g.

```bash
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --window-size=735,700 --virtual-time-budget=900 \
  --screenshot='C:\\Users\\Public\\shot.png' 'http://localhost:8000/#auto&seed=42&sim=200'
```

Note the virtual-time budget is partly consumed by asset loading (~1 s for 126 PNGs), so time-based scenes land earlier than the budget suggests; `#sim=N` steps are exact.

## 4. Module Responsibilities & Dependency Direction

Dependencies must point from the assembly layer toward the pure business layer:

```text
main
├── assets ← manifest
├── input ──→ state / shop / update / geometry
├── update ─→ state / levels / geometry / config / manifest
└── render ─→ geometry / config / manifest (reads GameState only)

state ─→ levels / shop / config
shop  ─→ random / config
levels ─→ layouts / random / config
geometry ─→ config
```

Constraints:

- `render.js` must not mutate business state.
- All randomness must go through `state.rng` or an explicitly injected `rng`; no stray `Math.random()`.
- Values, dimensions, hitboxes, and asset semantics live in the config/manifest layer — never duplicated in input or draw branches.
- `main.js` only assembles and loops; it carries no gameplay.
- New testable behavior should be written as exported functions with no DOM/Canvas dependency.

## 5. GameState Contract

Top-level state is split by responsibility:

```js
{
  scene,          // loading | ready | play | pause | win | shop | over
  rng,
  run: { level, score, goal, time, bagPower, introTime, winTime, overElapsed },
  world: { items },   // moles carry extra originX / vx / pause patrol fields
  hook: {
    phase,        // swing | extend | retract | dynamite
    swingAngle,
    flightDir,
    extension,
    caught,
    dynamiteElapsed,
    dynamiteDestroyed
  },
  inventory: { dynamite },
  activeBuffs:  { strength, clover, rock, diamond },
  pendingBuffs: { strength, clover, rock, diamond },
  shop,           // + leaving: {kind: 'yes'|'no', elapsed} during the farewell animation

  aim,
  secret: { autoAimEnabled, inputBuffer, noticeTime },
  swingTime,
  miner: { clip, elapsed, celebrationTime },
  effects: { popups, booms }
}
```

### Scene Flow

```text
loading → ready → play ⇄ pause
                    ├→ win → shop → play      (level cleared)
                    └→ over → play (new run)  (goal missed)
```

- A fresh run starts via `startNewRun()`, clearing cumulative score, dynamite, and all buffs.
- Score accumulates across levels; shop purchases deduct from it, but the balance may never go negative.
- Clearing a level enters `win` (`enterWin()`, `run.winTime = 2`): the original's ~36-frame "You made it to the next Level!" zoom screen with sound 63; when the countdown ends, `enterShop()` runs (which is where the previous level's `activeBuffs` expire).
- The four shop buffs are written to `pendingBuffs`; only `startNextLevel()` promotes them to the next level's `activeBuffs`.
- Dynamite purchases write immediately to the persistent `inventory`, carry across levels, cap 5.
- Clicking a product only purchases. The "Next Level" button or Enter/Space calls `beginShopLeave()`: the owner's farewell animation plays (`shop.leaving = {kind: 'yes'|'no', elapsed}`, yes = any purchase made, sound 88/132), input is blocked while it plays, and `update.js` calls `startNextLevel()` when it finishes.
- `pause` is only reachable from `play`; it freezes all simulation state and resumes back into the same `play` state.
- Each level starts with `run.introTime = 1.8` — the original's full-screen "Your First/Next Goal is $x" splash (gold-nugget wall + panel). The level is not shown and the simulation is fully frozen during the splash; swing, moles, and the timer all start when it ends. BGM 59 keeps playing through the splash and stops when mining starts.
- Failing enters `over` (`enterGameOver()`): the panel slides down ("You Did Not Reach Your Goal"), then the verbatim `endText` and a replay hint appear (`run.overElapsed` drives the animation).
- Early settlement can be triggered any time inside a level via the original Exit Level button (`endLevelEarly()`, original button 202): it immediately enters `win` or `over` based on current `score` vs `goal`.
- `secret.autoAimEnabled` defaults to off and is never persisted; once enabled it survives level transitions and restarts within the page, and resets on refresh.

## 6. Coordinates, Hook & Collision Invariants

- Internal coordinates are fixed at `715×520` — the original `550×400` stage times exactly `SWF_SCALE = 1.3` with no margins. All layout/screen/HUD coordinates are原版值 ×1.3.
- `STAGE.groundY = 78.2` (the original miner bottom edge `y≈60.15` ×1.3); the dirt art starts at `y≈87`.
- CSS scales display only; pointer coordinates must be projected back to internal coordinates via `getBoundingClientRect()`.
- The miner composite reference size is `330×299` (a 2× export), scale `0.3891×1.3/2 ≈ 0.2529` (the original places sprite 254 at scale 0.3891), composite bottom edge on the ground.
- The hook pivot is `PIVOT = (275.5×1.3, ≈63.4)` (the original places swing group `C` at `(275.5, 48.6)`); base rope length is `GROUND_Y - pivot.y`.

Hook states:

```text
swing → extend → retract → swing
                    └→ dynamite → retract
```

Invariants that must be protected by tests:

1. `swingAngle` only describes swinging; `flightDir` only describes the fixed unit vector after launch. Never merge them back into a single `theta`.
2. Only when `secret.autoAimEnabled` is true does a click set/replace the target; the hook then waits to swing past the target angle and recomputes `normalize(pivot → projectedAim)` at the instant of launch.
3. `flightDir` must not change during `extend/retract/dynamite`; the hook tip stays collinear with that vector.
4. Clicks beyond `±68°` (`SWING.amplitude`) must first be projected onto the boundary ray; the crosshair and the actual trajectory must agree.
5. Manual launch locks the swing direction at the instant of the keypress.
6. The claw's local downward axis aligns with `flightDir` after a single rotation; do not reintroduce the old double sign flip.
7. Collision uses the AABB from `TYPE_DEFS[type].hitbox`; `layoutRadius` is only for layout fine-tuning and must not substitute for the hitbox.
8. During the early extend segment (`extension ≤ HOOK.abortExtension`) the left/right arrow keys abort the drop (`abortExtend()`, original button 293); the empty hook retracts on the fast path.

The swing has amplitude `±68°`, period `84/18 s`, starting each level from a random phase (`swingTime = rng() × period`). Speeds are continuous values converted from the SWF's 18 FPS semantics: extend (drop) `232 px/s`, empty retract `555 px/s`, mole `69 px/s`. When carrying an object, pull speed is "frames skipped per tick × per-frame displacement" — **the regular path has NO upper clamp**:

```js
// Regular: skip (minerStrength - weight) frames, at least 1
37 * Math.max(1, strength - weight)
// Turbo path (bag power/strength==1, or weight -1 stickBonus): fixed 15 frames
37 * 15
```

Base strength is 10, strength potion gives 12; the mystery-bag power reward makes all subsequent pulls in the current level take the fixed 15-frame turbo path.

## 7. Animation & Miner Anchors

All animations are declared centrally in `manifest.js` as `{ frames, fps, mode, anchor }`; frame selection depends only on that animation's own `elapsed`.

| clip | SWF segment | H5 frames | playback |
| --- | --- | --- | --- |
| idle | `DefineSprite_230` 1–5 | `miner_idle_0..4` | 18 FPS, play once, hold last frame |
| pull | `DefineSprite_248` 1–20 | `miner_pull_0..19` | 18 FPS loop |
| dynamite | `DefineSprite_248` 31–35 | `miner_dynamite_0..4` | 18 FPS once |
| yay | `DefineSprite_253` 1–6 | `miner_yay_0..5` | 18 FPS once, then back to idle |
| mole / mole_d | `281` / `285` 1–7 | 7 frames each | 18 FPS loop |
| explosion | `DefineSprite_263` 1–14 | `explosion_0..13` | 18 FPS once (TNT ×2.2416, dynamite hit ×0.4495) |

Normal pulling must never read `dynamite` frames. Using dynamite freezes the reel; around frame 3 the current object is destroyed without scoring, and after frame 5 the empty hook resumes retracting. The miner plays the `pull` loop during any retraction (including empty hook and abort).

The TNT crate (`tnt`) is a normal catch: hooking it plays a one-shot explosion effect in place and reels back `$1` as usual. The explosion clip itself carries the area damage: original Sprite 263 places an invisible sensor (Sprite 262 → Shape 53) on frames 9–13 that destroys every field item whose box it touches (no money awarded); a TNT crate destroyed this way explodes in turn (its frame 2 *is* the explosion), producing authentic chain reactions. Hooked items are immune (their field body is already hidden). H5: `config.BLAST` + `applyBlastDamage()` in `update.js`; the blast rect scales with `boom.scale × SWF_SCALE`, so dynamite blasts (×0.4495) have a much smaller radius than TNT blasts (×2.2416).

Composite source offsets: idle `(29,43)`, pull/dynamite `(28,10)`, yay `(31,0)`, platform `(0,270)`. Do not bottom-center each frame image individually, or clips will jitter horizontally or float.

## 8. Types, Shop & Single Sources of Truth

- `config.js/TYPE_DEFS` is the single source for object value, weight, draw scale, rectangular hitbox, and layout radius.
- Business asset keys are named by value/purpose, e.g. `gold_100`; the reversed semantics of legacy export files `gold_small.png` / `gold_tiny.png` live only inside `manifest.js`.
- `layouts.js/LAYOUTS` is the single source for the 30 original prefab layouts (raw SWF 550×400 coordinates); `levels.js` handles the `random(3)` variant pick, coordinate conversion, bag weight/reward, and mole patrol init. Original values take precedence.
- `shop.js/SHOP_PRODUCTS` is the single source for the five products' copy and business IDs; stocking rates and prices live in `createShop()`.
- `manifest.js` is the single source for runtime assets. Load errors must be kept in `state.loadErrors`, never silently treated as success.
- Original vector-export art is drawn through `config.js` placement data: `ART_REG`/`CLAW_REG`/`EXPLOSION_REG` hold each PNG's local-bounds registration, `GOLD_SCREEN_BG`/`PLAY_BG`/`SCREEN_PANEL`/`SCREEN_LOGO` hold verbatim PlaceObject2 matrices (SWF stage coords, rendered ×1.3), and `TYPE_DEFS[].claw` maps each type to its original claw-hold frame. `bg_hud_glow.png` has the original placement CXFORM (`addRGBA +255,+171,−42`) baked in — do not re-export it without re-applying that transform.
- Sounds are likewise used only through `SOUND_MANIFEST` semantic keys. `AssetStore` clones short SFX; `bgm` is the single looping instance; `59` only attempts playback in `ready` and `shop`, and stops on entering mining, pause, game over, or loading. The input that starts a level / leaves the shop must stop BGM first, then unlock short SFX, to avoid music bleeding into the first mining frame. Never substitute BGM, explosion, or coin sounds for other events.

Full values, character IDs, shop probabilities, and hitbox sizes are in `FLASH_PARITY.md`.

## 9. Input & Debug Interface

- Left click / touch underground: no game effect by default; only after entering `whosyourdaddy` while paused on this page does a click set or replace the projected crosshair.
- Right click: only suppresses the browser menu; does not cancel the crosshair.
- `ArrowDown` / Space: manual launch along the current swing direction.
- `ArrowLeft` / `ArrowRight`: abort during the early drop segment (`extension ≤ HOOK.abortExtension`); the empty hook retracts fast.
- `ArrowUp` while an object is caught: consumes 1 dynamite.
- `Esc` / `P`: pause or resume inside a level; the pause overlay and a small bottom-left canvas button also toggle it.
- "Exit Level" button (original button 202 art, in the top HUD bar): early settlement inside a level (blocked during the opening splash).
- `M`: mute, including BGM.
- In the shop, Enter/Space or clicking "下一关": plays the owner's yes/no farewell animation, then proceeds to the next level (input is ignored while it plays).

Hash parameters combine with `&`:

- `#auto`: start level 1 immediately after loading.
- `#dbg`: draw hook phase, swing angle, `flightDir`, length, and hitboxes.
- `#aimgold`: only with `#auto&dbg`, a development auto-aim-at-gold entry point.
- `#sim=N`: synchronously advance N `1/60s` update steps after load.
- `#seed=N`: fix the level and shop RNG.
- `#scene=shop`: open the level-2 shop directly with `$5000`.
- `#scene=win` / `#scene=over`: jump straight to the win cutscene / game-over screen.

Common combos: `#auto&seed=42&dbg`, `#scene=shop&seed=42`.

## 10. Current Task Progress (2026-07-14 session handoff)

> This section is a temporary handoff record: delete the whole section once the to-do is done.

**Completed (all verified):**

- The hybrid restoration is fully landed: 30 original layouts (`layouts.js`), swing/reel/pull/mole/bag/TNT/GOAL-banner/early-settlement semantics; `npm test` 42/42 passing; browser and headless smoke tests passing.
- `FLASH_PARITY.md` and this document are both updated per the governance rules.

**The only remaining to-do: independent visual verification of the layouts.**

The user previously found the H5 layouts didn't match the original (caused by the old procedural layouts, since replaced by `layouts.js`); now we want final confirmation. Two steps:

1. **Binary cross-check (already written, one command):** `game/_verify_layouts.mjs` parses the `Gold-Miner.swf` binary directly (zlib inflate + walking main-timeline tags, reading the PlaceObject2 display list at each `L{n}_{v}` frame label) and diffs each entry's type/x/y/mirror against `layouts.js` — an evidence chain independent of both ffdec and GAME_LOGIC.md. Run:

   ```bash
   cd Gold-Miner/game && node _verify_layouts.mjs
   ```

   Expected output: `layouts compared: 30`, `mismatches: 0`; it also writes `_swf_layouts.json` (the parsed SWF dump). If there are mismatches, each is listed as an `L{n}_{v} T{i}` difference — fix `layouts.js` per the report and rerun `npm test`.

2. **Side-by-side visual page (to do):** build a temporary HTML page using `_swf_layouts.json` + the existing `game/assets/` sprites, rendering "parsed SWF coordinates" and "actual `generateLevel()` output" side by side per level for the user to eyeball. Afterwards delete `_verify_layouts.mjs`, `_swf_layouts.json`, and the temp page (they are not runtime artifacts; the asset manifest tests do not cover them).

**Environment note:** in the previous session, the auto permission classifier's calls to `claude-opus-4-8` were unavailable on the AeroLink proxy, intermittently blocking Bash. `permissions.allow` in `~/.claude/settings.json` now includes `"Bash"`, which a new window loads at startup; if blocking persists, use `/permissions` to confirm which allow rules are actually active in the session.

## 11. Change Rules & Minimum Acceptance

1. Protect `Gold-Miner.swf`, `ffdec/`, and the root `assets*`; never bulk-rewrite original evidence unless re-export is explicitly requested.
2. Keep zero-build and zero third-party runtime dependencies. If a dependency truly becomes necessary, add install, build, and deployment docs in the same change.
3. Don't drive different animations off one global clock modulo; don't let render functions trigger scoring/purchases/state transitions.
4. When changing original-calibrated values, cite SWF evidence in `FLASH_PARITY.md` or explicitly mark it as an intentional H5 difference.
5. When changing randomness rules, keep RNG injection and add fixed-seed tests.
6. When changing assets, check all of: manifest declarations, actual files, undeclared leftovers, browser 404s, console errors.

Before committing, at minimum run:

```bash
cd Gold-Miner/game
npm test
```

For visual/input changes, also do a browser smoke test via the static server, covering:

- `loading → ready → play → win → shop → play` and failure reset;
- the full-screen GOAL splash at each level start (gold-nugget wall + "Your First/Next Goal is"): simulation frozen, launching blocked, BGM continues through it and stops when mining starts;
- default manual launch, pause/resume, and (with the cheat enabled) left/center/right direct-aim clicks plus out-of-range projection;
- left/right-arrow abort during the early drop segment, "Exit Level" early settlement;
- the claw shows the original per-object hold art once something is caught (field art hidden), and the empty claw after a dynamite blast;
- normal pull and dynamite clips never cross frames; dynamite destruction doesn't score; TNT explodes in place (original 14-frame starburst) and reels back `$1`;
- moles patrol one-sided from their placement point, pausing and turning at endpoints, never crossing the whole screen;
- five-product purchases, balance protection, inventory cap, next-level buffs, and single-level expiry;
- leaving the shop plays the owner's happy segment after any purchase, the grumpy one otherwise, then the next level starts;
- the win cutscene zooms the panel and enters the shop after ~2 s; the game-over panel slides down and shows the verbatim endText;
- miner/platform grounded, no clip jumps, zero asset 404s;
- single BGM instance, mute, keyboard and pause-button controls.
