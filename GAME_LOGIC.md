# Gold Miner — Original SWF Game-Logic Reconstruction Manual

**Source:** `Gold-Miner.swf` (FWS, SWF v5, uncompressed), reverse-engineered from raw tags and
AVM1 (ActionScript 1) bytecode. Everything below was read directly from the SWF; nothing is
taken from the H5 reimplementation in `game/`. This document is intended to be sufficient to
recreate the original game's behavior 100%.

**Conventions used below**

- `random(n)` is the Flash 4/5 `RandomNumber` action: a uniform integer in `0 .. n-1`.
- Frame rate is **18 fps**; all timings below are in *frames* unless noted.
- AS1 variable names are **case-insensitive** (the code mixes `goalAddOn` / `goalAddon` —
  they are the same variable).
- `/:x` means a variable on `_root` (`_level0`).
- Character/sprite IDs are the SWF DefineSprite/DefineButton IDs, so you can cross-reference
  the extracted assets.

---

## 1. Global constants

| Constant | Value |
|---|---|
| Stage size | 550 × 400 px |
| Frame rate | 18 fps |
| Timer | 60 seconds per level (one tick = 18 frames) |
| Starting goal | \$375 (+ progression, see §10) |
| Base reel strength `minerStrength` | 10 |
| Total levels `total` | 10 (after level 10, layouts recycle from level 4 — see §10) |
| Max dynamite carried | display supports 8; shop stops selling at 5 |

## 2. Root variables

| Variable | Init (New-Game button) | Meaning |
|---|---|---|
| `minerStrength` | 10 | reel-up speed base; +2 with strength drink; reset to 10 after every level |
| `total` | 10 | number of distinct level layouts |
| `time` | 60 | seconds remaining (owned by the timer clip) |
| `goalAddOn` | 0 | cumulative goal increment |
| `goal` | 375 | money target for current level |
| `level` | 0 → 1 at first level | current level (also selects layout `L{level}_{1..3}`) |
| `levelDis` | 0 → 1 | displayed level number (keeps counting past 10) |
| `stick` | 0 | dynamite sticks carried |
| `score` | 0 | money |
| `things` | set per level frame | number of grabbable objects `T1..T{things}` in the level |
| `strength` | 0 | 1 while a "power" grab-bag buff is active (fast reel); reset on layout entry and after each level |
| `cloverBonus`, `rockBonus`, `diamondBonus` | 0 | shop buffs, 1 = active for the next level only |
| `busy` | 0 | 1 while the delivery/score popup is animating; blocks the time-out level end |

## 3. Scene graph (per level)

Placed by each `L{n}_{v}` frame of the main timeline:

| Instance | Sprite ID | Position (root coords) | Role |
|---|---|---|---|
| `T1..T{things}` | object sprites (§7) | per layout (§16) | grabbable objects |
| `miner` | 254 | (285.85, 34.75), scale 0.3891 | miner character (poses `1`/idle, `down`, `up`, `strength`) |
| `C` | 299 | (275.5, 48.6) | pendulum swing; contains `cl` |
| `C.cl` | 298 | — | the hook/rope assembly (extend/retract state machine) |
| `C.cl.claw` | 291 (drop) / 292 (reel) | — | claw graphic; frame = caught object id; frame 20 = empty |
| `C.cl.box` | 266 / 54 | — | hit-test box at the claw tip |
| `C.cl.d` | 265 | — | flying-dynamite clip (chases the claw when thrown) |
| `dynMov` | 300 | (351.3, 46.0) | dynamite inventory display; frame = `stick + 1` |
| `bonus` | 307 | (213.7, −11.5) | delivery/score-popup controller |
| timer | 197 | (527.95, 16.5) | countdown clip |
| end-level button | 202 | (429.2, 27.0) | HUD button; on release `gotoAndPlay(90)` = ends the level immediately |

Each object placement `T{x}` is one of the wrapper sprites in §7; every wrapper contains a
child named **`ob`** which carries `object`, `price`, `weight` and a hit box named **`box`**.

## 4. Main timeline state machine (302 frames)

| Frame(s) | Label | Behavior |
|---|---|---|
| 2–6 | preloader | `loaded = int(getBytesLoaded()/7000)`; small clip `gotoAndStop(loaded)`. Frame 6: if `_framesloaded < 180` jump back 3 frames, else fall through. |
| 10 | `main` | Title screen, `stop()`. Start button (id 35), instructions buttons (43 → page 2, 50 → page 1), flowgo.com link button (156). |
| — | Start button 35 | on release: init all root vars (see §2 init column) and `gotoAndPlay(15)`. |
| 15 | `start` | `goal = 375; goalAddOn += 275; goal += goalAddOn;` → **first-level goal = 650**. `goalDis = "$"+goal; levelDis = 1; level = 1;` `StartSound 59` (level jingle). Frames 15–23: "GOAL" banner color-fades in; plays through to 48. |
| 48 | — | `gotoAndStop("L" + level + "_" + (random(3)+1))` — picks one of 3 random layouts; then `strength = 0`. |
| 52 | `next` | Level-complete loop entry: `if (levelDis <= 9) goalAddOn += 270;` `goal += goalAddOn; goalDis = "$"+goal; levelDis++; level++;` `if (total < level) level = 4;` `StartSound 59`; banner fade; plays to 86. |
| 86 | — | `gotoAndStop("L" + level + "_" + (random(3)+1))`. |
| 90 | `end` | `if (score >= goal) gotoAndPlay(94) else gotoAndPlay(140)`. |
| 94 | `yes` | Win: `StartSound 63`, "MADE IT" zoom animation (frames 94–108), continues to 130. |
| 130 | — | `stop()`. Resets: `strength=0; minerStrength=10; diamondBonus=0; rockBonus=0; cloverBonus=0`. Places **shop** (sprite 133) at (363.55, 216.65). Shop later calls `_root.play()`. |
| 132 | — | `gotoAndPlay(52)` → next level. |
| 140 | `no` | Lose: "GAME OVER" banner (id 134) slides down from above (frames 140–160). |
| 169 | — | `stop()`. Places `upsell2` (sprite 180): shows `endText`, a replay button (165: `_root.gotoAndPlay(1)`), and a gamerival.com submit button (161: copies `_level0.score`/`_level0.gcode`, `if(score==0) score=5`, then GETs `../../www.gamerival.com/game.cfm` in `_self`). |
| 173–302 | `L1_1` … `L10_3` | 30 layout frames, one every 3 frames. Each does `things = N; stop();` and places the scene graph of §3 + layout objects of §16. |

**Goal progression.** The increment itself grows: `goal += goalAddOn` and `goalAddOn`
gains +270 at every `next` while `levelDis <= 9`, so goals accelerate quadratically:

| Level | goalAddOn | goal |
|---|---|---|
| 1 | 275 | \$650 |
| 2 | 545 | \$1,195 |
| 3 | 815 | \$2,010 |
| 4 | 1,085 | \$3,095 |
| 5 | 1,355 | \$4,450 |
| 6 | 1,625 | \$6,075 |
| 7 | 1,895 | \$7,970 |
| 8 | 2,165 | \$10,135 |
| 9 | 2,435 | \$12,570 |
| 10 | 2,705 | \$15,275 |
| 11+ | 2,705 (frozen) | +\$2,705 per level |

The game never ends by winning — after level 10 it loops layouts of levels 4–10 forever
with rising goals; the only exit is failing a goal.

## 5. Controls

Keyboard is handled with invisible `keyPress` buttons; mouse-click on the same buttons also
works (they have hit-area records).

| Input | Button ID | Where active | Effect |
|---|---|---|---|
| **Down arrow** | 258 | while claw idle/swinging (hook frame 1+) | `_root.miner.gotoAndStop('down'); _parent.stop()` (freezes the swing at its current angle) `; play()` → hook starts extending |
| **Left / Right arrow** | 293 | while extending (hook frames 3–10) | `_root.miner.gotoAndStop('up'); gotoAndPlay('up' + up)` — aborts the drop and reels back in empty from the current depth |
| **Up arrow** | 294 | only while reeling in **with a catch** (hook frame 44+) | if `stick >= 1`: `stick--; dynMov.prevFrame(); miner.m.gotoAndPlay('throw')`; the button removes itself (one throw per catch) |
| Mouse click | 202 | HUD (top area) | ends the level immediately (`gotoAndPlay(90)`) |

## 6. Pendulum swing (sprite 299, instance `C`, 87 frames)

- Frame 2: `gotoAndPlay(_currentframe + random(82) + 1)` → the swing starts at a **random
  phase** each level.
- Frames 3–86 (label `swing` at f3) are a tweened rotation loop; frame 86 → `gotoAndPlay(3)`.
- One full period = 84 frames ≈ **4.67 s**. The rotation matrix runs 0 → +0.9254 rad-matrix
  peak → 0 → −0.9284 → 0; decoded amplitude ≈ **±68°** from vertical, with a sinusoidal
  ease (values in the extracted dump `sprites/sprite_299.txt` give the exact per-frame
  matrix if pixel-perfect motion is wanted).
- `Down` calls `stop()` on this clip; after delivery the bonus clip calls
  `_root.C.gotoAndPlay(1)` which re-enters the random-phase pick and resumes swinging.

## 7. Objects

Every level object is a 2-frame wrapper sprite: frame 1 shows child `ob` (with an
`onClipEvent(load)` that sets `object`, `price`, `weight`, and containing hit box `box`);
frame 2 = "caught" state (art removed). When caught, the main game does
`_root.T{x}.gotoAndStop(2)`.

| Wrapper ID(s) | object | price | weight | Item |
|---|---|---|---|---|
| 204, 311 | 2 | 50 | 3 | small gold nugget |
| 216, 313 | 3 | 100 | 7 | medium gold |
| 315 | 4 | 250 | 8 | large gold |
| 206, 310 | 5 | 500 | 9 | huge gold boulder |
| 318 | 6 | **2** | 3 | **mole** (walking) |
| 323 | 7 | 7 | 3 | skull |
| 209 | 8 | 20 (**60** if `rockBonus`) | 9 | small rock |
| 331 | 9 | 1 | 2 | **TNT crate** — its frame 2 plays an explosion (id 263) + sound 264 at its map position when grabbed |
| 320 | 10 | 602 (**902** if `diamondBonus`) | 5 | **mole wearing a diamond** (walking) |
| 289 | 11 | 600 (**900** if `diamondBonus`) | 2 | diamond |
| 214 | 12 | random (§8) | random (§8) | **mystery grab bag** |
| 325 | 13 | 20 | 2 | bone |
| 219, 312 | 14 | 11 (**33** if `rockBonus`) | 8 | large rock |

Notes:

- The bonus-price check happens in `onClipEvent(load)` — i.e. **when the level starts** —
  so rock/diamond buffs apply to every such object in the level.
- Grabbing the TNT crate (object 9) is essentially a \$1 booby prize with a bang; the claw
  reveal (claw frame 10) shows an explosion with spark particles.
- The explosion clip (sprite 263) does area damage on its own: frame 9 places an invisible
  sensor (sprite 262 → shape 53, bounds `[-6.2,6.2]²`, matrix a=6.9598 d=6.2580 tx=0.3
  ty=-1.75; removed at frame 14) whose `enterFrame` loops `x = 1../:things` and calls
  `eval("_root.T"+x).gotoAndStop(2)` on any `T{x}.ob.box` it hitTests — items vanish with
  no payout. A TNT crate hit this way chains (its frame 2 *is* the explosion). The sensor
  inherits the explosion instance scale: TNT crate ×2.2416, dynamite blast ×0.4495.

### Walking moles (sprites 317 / 319, inside wrappers 318 / 320)

Objects 6 and 10 move; their `box` moves with them, so they must be caught on the fly.
213-frame loop, in wrapper-local coordinates:

- Frames 1–78: walk **left** ~4.95 px/frame, total ≈ 381 px.
- Frame 79–102: idle/turn animation; frame 80 does
  `gotoAndPlay(_currentframe + random(20) + 1)` → the pause length is randomized.
- Frames 103–187: walk **right** back to the start (mirrored art, `scaleX = −1`).
- Frame 188+: idle; frame 189 randomizes again; loops.
- Sprite 319 is identical but the mole carries a diamond (extra child id 284).
- Wrapper placements with `scale = −1` in the layouts (§16) mirror the whole path.

## 8. Mystery grab bag (sprite 214, child 213 `onClipEvent(load)`)

`object = 12`, then:

**Reward (`price`)** — with lucky clover (`/:cloverBonus == 1`):
```
w2 = random(6) + 1            // 1..6
if (w2 < 2)            price = "power"                       // 1/6
else if (w2 < 4)
    if (stick < 3)     price = "dynamite"                    // 2/6 (cash if already ≥3 sticks)
    else               price = random(300) + 300             // $300..599
else                   price = 700                           // 3/6
```

**Reward** — without clover:
```
w2 = random(6) + 1
if (w2 < 3)            price = random(600) + 1               // 2/6, $1..600
else if (w2 == 4)      price = "power"                       // 1/6
else if (w2 == 5)
    if (stick < 3)     price = "dynamite"                    // 1/6
    else               price = random(100) + 100             // $100..199
else if (w2 == 6)      price = 800                           // 1/6
// w2 == 3 leaves price at the wrapper default 0 → empty bag (1/6)
```

**Weight:**
```
w = random(4) + 1     // 1..4
w == 1 → weight = random(9) + 1        // 1..9
w == 2 → weight = -(random(5) + 1)     // -1..-5  (reels up faster than empty!)
w == 3 → weight = 9
w == 4 → weight = -1
```

String rewards flow through the delivery pipeline (§11): `"power"` sets `/:strength = 1`
(fast reel for the rest of the level), `"dynamite"` gives `stick++`.

## 9. The hook (sprite 298, instance `C.cl`, 327 frames)

### 9.1 Idle (frame 1)

`stop()`; `weight = -1; object = 0; price = 0; busy = 0; stickBonus = 0`. The keyPress-Down
button is alive. (`busy` here is a **local** variable on the hook, distinct from `/:busy`.)

### 9.2 Extend (frames 2–42)

- Triggered by Down (§5). Every frame sets `up = _currentframe` — this records the depth so
  the retract can start from the matching label.
- Rope tip moves ~9.9 px/frame straight down in hook-local space (from y≈12 at f2 to y≈407
  at f42; the rope graphic at depth 3 scales in y). Because the whole hook lives inside the
  rotated `C`, the drop follows the frozen swing angle.
- Frame 42 is the maximum depth; frame 43 does `_root.miner.gotoAndStop('up')` and falls
  into the retract section (auto-retract when nothing was caught).
- Frames 3–10 carry the Left/Right abort button (§5).

### 9.3 Catch detection (enterFrame on `box`, active frames 2–42)

Attached to the claw-tip box (and duplicated on the claw clip):

```
x = 1
while (x <= /:things) {
    if (_root["T"+x].ob.box.hitTest(this) && _parent.busy == 0) {
        _parent.busy   = 1
        _parent.price  = _root["T"+x].ob.price
        _parent.object = _root["T"+x].ob.object
        _parent.weight = _root["T"+x].ob.weight
        _parent.claw.gotoAndStop(_parent.object)   // claw shows the item
        _root.miner.gotoAndStop("up")
        _root["T"+x].gotoAndStop(2)                // remove item from field
        _parent.gotoAndPlay("up" + _parent.up)     // retract from recorded depth
    }
    x++
}
```

`hitTest(movieclip)` is the AABB (bounding-box) test — recreate with rectangle overlap.

### 9.4 Retract (labels `up42` f44 → `up2` f288, then delivery f293+)

- Labels `up42`, `up41`, … `up2` are spaced ~6 frames apart; between labels the rope
  shortens ~1.6 px/frame (natural playback speed is much slower than the drop).
- At f44 a controller clip (id 297) is placed with:

  **onClipEvent(load):**
  ```
  if (_parent.weight > 1)          _parent.stop()       // heavy: motion driven only by the skip below
  else if (_parent.weight == -1) { _parent.stickBonus = 1; _parent.weight = 0 }  // empty claw or -1 bag
  // other weights <= 1 (0, negatives) just fall through
  ```

  **onClipEvent(enterFrame):** — the reel-speed formula:
  ```
  if (_parent.stickBonus == 1 || /:strength == 1)
      _parent.gotoAndPlay(_parent._currentframe + 15)                      // turbo (empty claw, dynamited catch, power buff)
  else
      _parent.gotoAndStop(_parent._currentframe + (/:minerStrength - _parent.weight))
  ```

  So the retract advances `minerStrength − weight` frames per tick (base 10): weight 9 →
  1 frame/tick (agonizingly slow), weight 2 → 8/tick, negative bag weights are even faster,
  and the turbo path ~15–16/tick. Strength drink (`minerStrength = 12`) adds a flat +2.

- Frames 293–327 **all** carry the identical delivery action (so any frame-skip overshoot
  past f293 still lands on it):
  ```
  stop()
  _root.bonus.bscore = price
  _root.bonus.gotoAndPlay(2)
  ```

### 9.5 Claw graphic (sprites 291 open / 292 closed, 20 frames)

Frame 1: `if (_parent.object >= 1) gotoAndStop(_parent.object) else stop()`. Frames 2–14
are the per-object "held item" art (with reveal sounds on some: bag 267/271, junk 132,
TNT 271 + spark particles, etc. — see the dump for the exact per-frame sounds). Frame 20 =
empty claw (used after a dynamite blast).

## 10. Dynamite throw

1. Up arrow (button 294, only alive while retracting a catch): `stick--`,
   `_root.dynMov.prevFrame()` (inventory display), `miner.m.gotoAndPlay('throw')`.
2. Miner throw animation (sprite 248 label `throw`, f31–35): tosses a stick; at f34 it calls
   `_root.C.cl.d.gotoAndStop(2)`.
3. `d` (sprite 265) frame 2 places a homing dynamite (id 260) with enterFrame:
   ```
   _x += (_parent.claw._x - _x) * 0.5
   _y += (_parent.claw._y - _y) * 0.5
   if (_parent.claw.box.hitTest(this)) {
       _parent.price = 0            // catch destroyed, no money
       _parent.stickBonus = 1       // reel up at turbo speed
       _parent.claw.gotoAndStop(20) // empty claw art
       nextFrame()                  // -> frame 3: explosion id 263 + StartSound 264
   }
   ```
   (Exponential chase, 50% of the remaining distance per frame.)

Use case: ditch a heavy rock instead of wasting 5+ seconds reeling it.

## 11. Delivery / score popup (sprite 307, instance `bonus`, 79 frames)

- Frame 1: `stop(); bscore = 0; /:busy = 0`.
- Frame 2 (entered from the hook): `_root.miner.gotoAndStop(1)` (idle pose).
- Frame 3 branches on `bscore`:
  - `bscore == 0` (empty claw / dynamited): `_root.C.gotoAndPlay(1)` (swing resumes) and back to frame 1.
  - `bscore == "power"` → frame 36.
  - `bscore == "dynamite"` → frame 61.
  - otherwise (a number) → falls into frame 4.
- **Cash path (f4–34):** `bscoreDis = "$" + bscore; /:busy = 1`; a "$N" popup scales up
  (StartSound **304** at f5) and flies to the score display (StartSound **88** at f31);
  frame 32: `/:score += bscore; _root.C.gotoAndPlay(1)`; frame 34 returns to 1
  (`/:busy` clears there).
- **Power path (f36–56, label `power`):** `/:strength = 1`,
  `miner.gotoAndStop('strength')` (flexing pose), StartSound **271**, muscle animation;
  f56: swing resumes, miner back to idle.
- **Dynamite path (f61–79, label `dynamite`):** StartSound **271**, a stick (id 86) flies
  to the inventory; f78: `/:stick++; _root.dynMov.nextFrame()`; f79: swing resumes.

`/:busy == 1` makes an expired timer wait (§12), so the level can't end mid-payout. Note the
original does **not** set `/:busy` during the reel itself — if time hits 0 while reeling,
the level ends and the catch is lost. That is authentic behavior.

## 12. Timer (sprite 197, 22 frames)

- Frame 1: `time = /:time` (60).
- Frames 2–19 = exactly 18 frames = 1 second of clock animation.
- Frame 19:
  ```
  time--
  if (time < 0) {
      time = 0
      if (/:busy == 1)  gotoAndPlay(2)                 // wait for payout to finish
      else              _root.gotoAndPlay("end")
  }
  else if (time < 10)   gotoAndPlay(20)                // 'beep' warning (clip 196), then loops to 2
  else                  gotoAndPlay(2)
  ```

## 13. Shop (sprite 133, shown after every won level)

Appears on main-timeline frame 130. Frame 1 of the shop:
`price = 20 * /:level + 100; priceDis = "$" + price; discription = ""; bought = 0`
(this shop-level `price` is only used for the display text next to the door; the five items
each compute their own price). Frames 2–17: clerk intro animation with click sounds (114 at
f2, f6, f10, f14); frame 18 `stop()` — shop is interactive.

Each item is a slot sprite that on load decides **stock** and **price**; sold-out slots jump
to their `off` frame (empty). Hovering an item sets `_parent.discription` (a text field) to
the verbatim string below; clicking buys it: sets `bought = 1`, applies the effect,
`score -= price`, and the slot jumps to its "sold" frame (f11). There is **no money check**
— the original lets score go negative.

| Slot sprite | Button | Item | In stock when | Price | Effect on buy |
|---|---|---|---|---|---|
| 90 | 89 | **Dynamite** | `stick < 5` | `random(300) + 1 + level*2` | `/:stick++` |
| 96 | 95 | **Strength drink** | `random(10)+1 < 5` (40%) | `random(300) + 100` | `/:minerStrength += 2` |
| 102 | 101 | **Lucky clover** | `random(10)+1 < 5` (40%) | `random(level*50) + 1 + level*2` | `/:cloverBonus = 1` |
| 107 | 106 | **Rock collectors book** | `random(10)+1 < 7` (60%) | `random(150) + 1` | `/:rockBonus = 1` |
| 111 | 110 | **Diamond polish** | `random(10)+1 < 6` (50%) | `random(level*100) + 1 + 200` | `/:diamondBonus = 1` |

(`level` here is the level just completed, since the shop shows before `level++`.)

Hover descriptions (verbatim, including original typos):

- Dynamite: *"After you have grabbed onto something with your claw, press the up arrow to throw a piece of dynamite at it and blow it up."*
- Strength drink: *"Strength drink. The Miner will reel up objects a little faster on the next level. The drink only lasts for one level."*
- Lucky clover: *"Lucky Clover. This will increase the chances of getting something good out of the grab bags on the next level. This is only good for one level."*
- Rock book: *"Rock Collectors book. Rocks will be worth three times as much money on the next level. This is only good for one level."*
- Diamond polish: *"Diamond Polish. Durring the next level diamonds will be worth more money. Only good for one level."*

**Leaving the shop** — the door button (81): if `bought != 0` → frame 19 `yes` (clerk happy,
StartSound **88**) else frame 26 `no` (clerk grumbles, StartSound **132**). Both paths end
with `_root.play()` → main timeline frame 132 → next level. All one-level buffs
(`minerStrength`, `strength`, clover/rock/diamond) are cleared at the **next** frame-130
visit, i.e. they last exactly one level.

## 14. Miner character (sprite 254, instance `miner`)

`gotoAndStop` targets: frame 1 = idle (full body with lever), label `down` f3 = pushes the
lever (child 230: click sound **114** at f2, crank sound **229** at f4, 5 frames, stops),
label `up` f7 = cranks the reel (child 248: loops f1–20 with reel-crank sound **246** at f2
and f9; also contains labels `turn` f22 and `throw` f31 for the dynamite toss), label
`strength` f11 = flexed fast-crank pose (child 253).

## 15. Audio map (all sounds: 22050 Hz, 16-bit, mono, uncompressed)

| ID | Trigger |
|---|---|
| 59 | level-start jingle (frames 15 and 52) |
| 63 | level won ("made it" fanfare, frame 94) |
| 88 | purchase success / cash-count finish (shop `yes`, bonus f31) |
| 114 | UI click / lever press (shop intro, miner `down`) |
| 132 | grumble / worthless item reveal (shop `no`, claw junk frames) |
| 229 | lever crank (miner `down` f4) |
| 246 | reel crank loop (miner `up` f2/f9) |
| 264 | explosion (TNT crate frame 2, dynamite hit, hook blast) |
| 267 | grab-bag rustle / item reveal (claw frames 2–3, 12) |
| 271 | power-up fizz / fuse (bonus `power`/`dynamite`, bag reveal f4–5, TNT reveal) |
| 304 | score popup "ka-ching" (bonus f5) |

## 16. Text fields (DefineEditText variables)

| Variable | Content |
|---|---|
| `goalDis` | `"$" + goal` |
| `score` | bound directly to `/:score` |
| `time` | bound to the timer clip's `time` |
| `levelDis` | displayed level number |
| `priceDis` | `"$" + price` (shop slots) |
| `discription` | shop hover text |
| `bscoreDis` | `"$" + bscore` delivery popup |
| `endText` | `"You scored " + score + " Points at Gold Miner!"` (game-over screen) |

External links in the original (title/end screens): flowgo.com promo (button 156) and
gamerival.com score submit (button 161, sends `score` and `gcode`).

## 17. Level layouts (complete data)

`things` per level: L1 = 15, L2 = 20, L3 = 17, L4 = 18, L5 = 22, L6 = 22, L7 = 20,
L8 = 18/18/27 (variant 3 differs), L9 = 26/26/16, L10 = 26.
Coordinates are root-stage px (placement of the wrapper sprite's origin); `scale` ≠ 1 scales
the object (and its hit box); negative scale mirrors it (used for mole walk direction).
Wrapper-ID → item mapping is in §7.

```
L1_1 (15): T1 204(127.75,182.6) T2 219(426.15,136.75,s0.7294) T3 204(420.2,159.5) T4 219(106.8,134.1,s0.7294)
  T5 204(174.75,240.15) T6 216(325.15,190.9) T7 204(374.85,177.7) T8 206(109.9,263.95) T9 209(361.0,264.95)
  T10 206(322.2,317.6) T11 216(93.5,378.85) T12 216(522.4,332.45) T13 209(260.55,352.05) T14 214(65.4,143.65)
  T15 214(406.35,194.65)
L1_2 (15): T1 204(106.75,121.6) T2 219(460.15,128.75,s0.7294) T3 204(450.2,149.5) T4 219(67.8,170.1,s0.7294)
  T5 204(177.75,181.15) T6 216(325.15,190.9) T7 204(424.85,183.7) T8 206(70.9,231.95) T9 209(398.0,252.95)
  T10 206(537.15,263.6) T11 216(127.5,318.85) T12 216(236.45,288.45) T13 209(182.55,353.05) T14 214(362.35,355.65)
  T15 204(426.1,212.85)
L1_3 (15): T1 204(106.75,121.6) T2 219(451.15,153.75,s0.7294) T3 204(425.2,119.5) T4 219(106.8,215.1,s0.7294)
  T5 204(177.75,181.15) T6 216(318.2,235.9) T7 204(349.85,171.7) T8 206(40.9,226.95) T9 209(398.0,252.95)
  T10 206(490.15,242.6) T11 216(289.5,284.85) T12 216(181.45,253.45) T13 209(228.55,340.05) T14 214(184.4,356.65)
  T15 204(256.15,188.85)
L2_1 (20): T1 313(43.55,176.0) T2 311(112.2,284.35) T3 209(83.25,190.25) T4 311(268.2,186.35) T5 312(411.1,228.95,s0.759)
  T6 311(436.15,127.35) T7 209(437.1,359.65) T8 312(473.1,157.95,s0.7108) T9 209(164.6,255.6) T10 311(191.2,234.35)
  T11 312(232.1,292.95,s0.7592) T12 209(310.3,280.25) T13 311(338.15,216.35) T14 289(402.7,261.0) T15 311(480.15,214.35)
  T16 310(35.5,311.35) T17 310(373.1,353.95) T18 214(181.65,336.65) T19 311(373.15,306.35) T20 313(492.5,342.0)
L2_2 (20): T1 313(490.5,262.0) T2 311(429.15,359.35) T3 209(59.25,129.25) T4 311(354.15,138.35) T5 312(179.15,191.95,s0.759)
  T6 311(436.15,127.35) T7 209(33.15,275.65) T8 312(116.15,298.95,s0.7108) T9 209(164.6,255.6) T10 311(321.2,241.35)
  T11 312(103.1,383.95,s0.7592) T12 209(23.35,208.25) T13 311(374.15,195.35) T14 216(399.15,256.45) T15 311(480.15,214.35)
  T16 310(497.45,359.35) T17 310(50.15,349.95) T18 214(60.65,169.65) T19 311(373.15,306.35) T20 313(342.5,294.0)
L2_3 (20): T1 313(32.55,168.0) T2 311(66.2,163.35) T3 209(83.25,190.25) T4 311(354.15,138.35) T5 312(397.1,155.95,s0.759)
  T6 311(436.15,127.35) T7 209(33.15,275.65) T8 312(116.15,298.95,s0.7108) T9 209(164.6,255.6) T10 311(191.2,234.35)
  T11 312(232.1,292.95,s0.7592) T12 209(319.3,278.25) T13 311(374.15,195.35) T14 216(399.15,256.45) T15 311(480.15,214.35)
  T16 310(63.5,348.35) T17 310(175.15,373.95) T18 214(247.65,323.65) T19 311(373.15,306.35) T20 313(492.5,342.0)
L3_1 (17): T1 214(80.3,181.95) T2 204(99.05,121.2) T3 204(134.05,123.7) T4 204(99.35,152.8) T5 219(257.75,196.1,s0.7294)
  T6 204(378.75,200.3) T7 219(410.4,230.7,s0.7294) T8 209(476.05,188.95) T9 216(508.5,207.15) T10 216(131.75,310.85)
  T11 209(102.5,277.0) T12 209(345.3,248.95) T13 289(428.7,299.0) T14 209(478.65,293.9) T15 219(349.9,312.8,s0.7294)
  T16 206(300.7,365.0) T17 216(72.6,248.45)
L3_2 (17): T1 214(62.3,140.95) T2 204(99.05,121.2) T3 204(134.05,123.7) T4 204(99.35,152.8) T5 219(279.75,196.1,s0.7294)
  T6 204(378.75,200.3) T7 219(410.4,230.7,s0.7294) T8 209(462.05,228.95) T9 216(508.5,207.15) T10 216(75.75,222.85)
  T11 209(102.5,277.0) T12 209(387.3,256.95) T13 289(428.7,261.0) T14 209(468.65,276.9) T15 219(411.9,300.8,s0.7294)
  T16 206(167.7,393.0) T17 216(371.55,353.45)
L3_3 (17): T1 214(333.25,252.95) T2 204(99.05,121.2) T3 204(134.05,123.7) T4 204(99.35,152.8) T5 219(249.75,196.1,s0.7294)
  T6 204(378.75,200.3) T7 219(296.45,234.7,s0.7294) T8 209(474.05,227.95) T9 216(508.5,207.15) T10 216(75.75,222.85)
  T11 209(114.5,283.0) T12 209(372.3,258.95) T13 289(438.7,298.0) T14 209(475.65,276.9) T15 219(403.9,308.8,s0.7294)
  T16 206(6.7,305.0) T17 216(422.55,243.45)
L4_1 (18): T1 204(367.65,164.5) T2 204(381.7,178.9) T3 318(564.95,269.8) T4 209(143.25,161.6) T5 214(429.0,202.3)
  T6 209(466.05,182.25) T7 214(383.0,257.3) T8 318(-15.8,204.75,s-1) T9 204(113.4,139.05) T10 219(336.7,259.1,s0.7294)
  T11 216(325.85,207.1) T12 204(389.75,203.3) T13 214(150.7,242.0) T14 214(251.7,322.0) T15 318(182.6,279.8,s-1)
  T16 315(170.0,318.2) T17 209(112.8,344.7) T18 315(327.4,328.85)
L4_2 (18): T1 204(96.7,131.5) T2 204(173.75,135.9) T3 318(382.95,140.8) T4 209(143.25,159.6) T5 214(417.0,170.3)
  T6 209(466.05,182.25) T7 216(517.85,177.8) T8 318(68.2,203.75,s-1) T9 204(203.4,185.05) T10 219(279.75,196.1,s0.7294)
  T11 216(344.85,216.1) T12 204(378.75,200.3) T13 216(67.75,237.55) T14 214(219.7,241.0) T15 318(265.6,272.8,s-1)
  T16 315(120.0,332.2) T17 209(171.8,359.7) T18 315(329.4,310.85)
L4_3 (18): T1 204(33.7,180.5) T2 204(189.75,278.9) T3 318(437.95,152.8) T4 209(77.25,282.6) T5 214(430.0,275.3)
  T6 209(482.05,276.25) T7 216(509.85,245.8) T8 318(108.2,185.75,s-1) T9 204(163.4,288.05) T10 219(277.75,291.1,s0.7294)
  T11 216(352.85,266.1) T12 204(379.75,249.3) T13 216(35.75,287.55) T14 214(237.7,312.0) T15 318(149.6,128.8,s-1)
  T16 315(120.0,332.2) T17 209(171.8,359.7) T18 315(329.4,310.85)
L5_1 (22): T1 204(99.35,126.15) T2 204(143.1,137.2) T3 209(310.2,194.3) T4 209(424.7,199.6) T5 216(457.8,175.15)
  T6 216(67.75,237.55) T7 318(72.85,197.75,s-1) T8 216(206.15,229.45) T9 219(512.05,343.1,s0.7294) T10 204(346.75,253.65)
  T11 318(-71.9,286.4,s-1) T12 206(-0.35,334.3) T13 289(69.9,327.7) T14 204(118.15,306.45) T15 315(185.35,357.5)
  T16 289(486.7,355.0) T17 214(390.4,338.35) T18 289(444.7,349.0) T19 289(498.05,306.35) T20 206(562.5,296.3)
  T21 318(504.2,281.1) T22 209(470.1,391.0)
L5_2 (22): T1 204(99.35,126.15) T2 204(143.1,137.2) T3 209(115.2,158.3) T4 209(424.7,199.6) T5 216(457.8,175.15)
  T6 216(67.75,237.55) T7 318(134.85,199.75,s-1) T8 216(206.15,229.45) T9 219(309.1,256.1,s0.7294) T10 204(346.75,253.65)
  T11 318(-71.9,286.4,s-1) T12 206(-0.35,334.3) T13 289(69.9,327.7) T14 204(118.15,306.45) T15 315(185.35,357.5)
  T16 315(326.75,332.2) T17 214(390.4,338.35) T18 289(444.7,349.0) T19 289(498.05,306.35) T20 206(566.5,310.3)
  T21 318(452.2,282.1) T22 209(177.15,269.0)
L5_3 (22): T1 204(78.35,124.15) T2 204(236.1,277.2) T3 209(115.2,158.3) T4 209(424.7,199.6) T5 216(457.8,175.15)
  T6 216(67.75,237.55) T7 318(134.85,199.75,s-1) T8 216(206.15,229.45) T9 219(309.1,256.1,s0.7294) T10 204(346.75,253.65)
  T11 318(-62.9,289.4,s-1) T12 206(-0.35,334.3) T13 289(255.9,298.7) T14 204(118.15,306.45) T15 315(220.35,382.5)
  T16 315(326.75,332.2) T17 214(384.4,183.35) T18 289(22.75,273.0) T19 289(511.05,247.35) T20 206(436.5,389.3)
  T21 318(434.2,276.1) T22 209(167.15,268.0)
L6_1 (22): T1 209(30.25,288.9) T2 219(442.1,344.05,s0.7294) T3 219(518.1,309.05,s0.7294) T4 320(-118.4,156.75,s-1)
  T5 204(96.7,227.5) T6 209(229.55,331.25) T7 320(713.35,183.4) T8 214(286.4,248.3) T9 219(122.7,328.4,s0.7294)
  T10 204(169.75,283.85) T11 216(219.6,170.75) T12 204(473.1,229.85) T13 204(415.4,275.55) T14 204(357.4,168.65)
  T15 204(423.75,126.55) T16 320(79.6,196.8,s-1) T17 216(21.4,214.25) T18 204(70.4,140.3) T19 209(335.5,333.4)
  T20 216(468.5,317.8) T21 206(284.35,309.6) T22 320(401.7,377.05)
L6_2 (22): T1 209(107.25,148.9) T2 219(357.1,168.05,s0.7294) T3 219(441.1,132.05,s0.7294) T4 320(49.6,185.75,s-1)
  T5 204(96.7,227.5) T6 209(224.55,254.25) T7 320(444.35,200.4) T8 214(478.35,202.3) T9 219(111.7,273.4,s0.7294)
  T10 204(169.75,283.85) T11 216(387.55,254.75) T12 204(422.1,252.85) T13 204(415.4,275.55) T14 204(437.4,265.65)
  T15 204(464.75,271.55) T16 320(153.6,297.8,s-1) T17 216(82.4,360.25) T18 204(195.4,349.3) T19 209(322.5,370.4)
  T20 216(372.5,377.8) T21 206(552.3,346.6) T22 320(413.7,323.05)
L6_3 (22): T1 209(53.25,164.9) T2 219(210.15,174.05,s0.7294) T3 219(411.1,168.05,s0.7294) T4 320(42.6,199.75,s-1)
  T5 204(123.7,289.5) T6 209(304.55,267.25) T7 320(532.35,199.4) T8 214(451.35,320.3) T9 219(94.7,275.4,s0.7294)
  T10 204(437.7,352.85) T11 216(22.6,319.75) T12 204(342.1,282.85) T13 204(426.4,297.55) T14 204(446.4,284.65)
  T15 204(490.75,314.55) T16 320(211.6,233.8,s-1) T17 216(82.4,360.25) T18 204(195.4,349.3) T19 209(526.5,270.4)
  T20 216(376.5,377.8) T21 206(246.3,370.6) T22 320(412.7,314.05)
L7_1 (20): T1 318(329.6,121.9,s-1) T2 204(108.0,174.95) T3 204(294.05,174.2) T4 331(442.4,169.7) T5 331(135.65,277.65)
  T6 325(394.9,201.05) T7 323(408.25,189.2) T8 318(532.3,142.1) T9 315(525.45,174.7) T10 318(22.9,239.4,s-1)
  T11 323(69.55,253.6) T12 325(168.2,229.05) T13 318(269.55,260.9) T14 214(417.0,250.4) T15 318(493.85,220.9)
  T16 206(22.85,355.95) T17 318(88.25,324.8,s-1) T18 315(186.7,310.85) T19 206(208.2,390.6) T20 206(444.25,333.25)
L7_2 (20): T1 318(19.65,144.9,s-1) T2 204(13.0,236.95) T3 204(295.05,271.2) T4 331(364.4,219.7) T5 331(160.65,221.65)
  T6 325(422.9,184.05) T7 323(64.3,176.2) T8 318(529.3,137.1) T9 315(500.45,192.7) T10 318(66.9,272.4,s-1)
  T11 323(213.55,234.6) T12 325(66.2,319.05) T13 318(472.55,266.9) T14 214(121.05,202.4) T15 318(365.85,159.9)
  T16 206(22.85,355.95) T17 318(126.2,340.8,s-1) T18 315(183.7,303.85) T19 206(257.15,385.6) T20 206(339.25,310.25)
L7_3 (20): T1 318(175.65,142.9,s-1) T2 204(74.0,186.95) T3 204(294.05,174.2) T4 331(350.4,302.7) T5 331(230.6,303.65)
  T6 325(394.9,201.05) T7 323(408.25,189.2) T8 318(574.3,136.1) T9 315(525.45,174.7) T10 318(122.9,207.4,s-1)
  T11 323(435.5,277.6) T12 325(130.2,238.05) T13 318(633.55,282.9) T14 214(439.0,200.4) T15 318(476.85,225.9)
  T16 206(164.85,336.95) T17 318(26.25,272.8,s-1) T18 315(54.7,144.85) T19 206(293.15,368.6) T20 206(416.25,342.25)
L8_1 (18): T1 331(59.6,210.95) T2 331(152.95,263.05) T3 331(451.7,171.05) T4 331(365.0,273.7) T5 331(479.7,357.8)
  T6 289(106.85,144.95) T7 289(500.5,123.4) T8 320(22.6,203.3,s-1) T9 289(208.55,172.7) T10 289(324.4,207.45)
  T11 320(560.9,160.35) T12 289(71.05,283.45) T13 320(101.3,260.65,s-1) T14 289(201.75,298.15) T15 289(407.1,243.45)
  T16 214(49.45,363.65) T17 289(331.1,342.15) T18 214(521.55,313.0)
L8_2 (18): T1 331(274.55,162.95) T2 331(345.9,232.05) T3 331(135.75,306.05) T4 331(199.05,233.7) T5 331(404.7,317.8)
  T6 289(317.8,370.95) T7 289(221.15,373.4) T8 320(162.6,222.3,s-1) T9 289(242.5,144.7) T10 289(329.4,197.45)
  T11 320(390.9,166.35) T12 289(271.0,372.45) T13 320(106.3,291.65,s-1) T14 289(293.7,133.15) T15 289(422.1,284.45)
  T16 214(21.45,307.65) T17 289(95.15,265.15) T18 214(523.55,300.0)
L8_3 (27): T1 331(58.2,200.4) T2 331(489.0,197.75) T3 219(35.75,140.25,s0.7294) T4 209(118.05,155.6) T5 289(141.4,177.4)
  T6 219(306.45,164.2,s0.7294) T7 209(420.55,156.95) T8 209(510.25,130.3) T9 219(30.4,248.25,s0.7294)
  T10 219(137.1,202.95,s0.7294) T11 209(141.9,230.4) T12 209(105.7,259.8) T13 209(219.3,215.65) T14 219(241.1,277.55,s0.7294)
  T15 209(329.95,287.6) T16 209(401.95,238.25) T17 219(429.15,205.55,s0.7294) T18 219(470.5,256.25,s0.7294)
  T19 209(541.9,235.65) T20 289(532.2,296.05) T21 206(34.85,313.25) T22 289(54.75,362.75) T23 289(78.75,350.75)
  T24 206(138.85,375.95) T25 206(269.55,334.6) T26 206(409.6,315.9) T27 206(526.95,374.6)
L9_1 (26): T1 331(7.5,156.4) T2 331(36.85,304.4) T3 331(162.2,381.75) T4 331(315.55,380.45) T5 331(464.95,365.75)
  T6 331(550.3,257.75) T7 331(547.65,124.35) T8 214(20.95,206.4) T9 320(70.95,224.35,s-1) T10 289(65.25,255.0)
  T11 289(69.25,377.7) T12 289(110.6,372.35) T13 206(117.25,321.95) T14 320(141.65,277.65,s-1) T15 214(207.05,353.1)
  T16 204(253.55,152.6) T17 325(285.6,309.1) T18 320(377.65,245.75) T19 206(401.3,331.25) T20 289(432.0,261.65)
  T21 320(480.35,172.4) T22 289(494.75,203.15) T23 289(544.05,185.75) T24 214(518.1,277.3) T25 323(487.0,330.9)
  T26 289(526.7,332.35)
L9_2 (26): T1 331(122.5,153.4) T2 331(25.85,360.4) T3 331(266.2,264.75) T4 331(327.55,264.45) T5 331(516.95,361.75)
  T6 331(208.35,263.75) T7 331(412.65,146.35) T8 214(16.95,206.4) T9 320(56.95,199.35,s-1) T10 289(65.25,255.0)
  T11 289(313.0,384.7) T12 289(221.2,384.35) T13 206(117.25,321.95) T14 320(143.65,267.65,s-1) T15 214(269.0,384.1)
  T16 204(108.6,116.6) T17 325(294.6,328.1) T18 320(388.65,253.75) T19 206(401.3,331.25) T20 289(236.0,228.65)
  T21 320(469.35,191.4) T22 289(383.75,167.15) T23 289(297.05,228.75) T24 214(518.1,277.3) T25 323(487.0,330.9)
  T26 289(510.7,317.35)
L9_3 (16): T1 331(267.7,243.35) T2 318(-18.4,151.9,s-1) T3 320(53.95,196.35,s-1) T4 204(117.55,177.6)
  T5 318(200.6,128.9,s-1) T6 318(372.3,197.1) T7 318(565.3,142.1) T8 320(595.35,183.4) T9 320(-62.35,316.65,s-1)
  T10 320(44.95,345.35,s-1) T11 318(101.6,274.9,s-1) T12 318(205.35,235.1) T13 214(268.05,374.1) T14 320(381.65,302.75)
  T15 320(338.9,252.35,s-1) T16 320(503.65,337.75)
L10_1 (26): T1 204(46.8,182.65) T2 209(126.25,161.25) T3 209(267.25,204.25) T4 204(322.8,229.65) T5 209(395.2,153.25)
  T6 204(382.75,225.65) T7 204(433.75,168.65) T8 315(472.35,202.85) T9 315(38.4,245.85) T10 204(116.8,224.65)
  T11 216(94.55,268.15) T12 204(125.8,278.65) T13 206(67.35,322.25) T14 209(124.25,305.25) T15 315(142.4,384.85)
  T16 216(167.55,339.15) T17 216(227.55,289.15) T18 206(247.35,358.25) T19 315(307.4,275.85) T20 209(325.2,316.25)
  T21 216(361.5,341.15) T22 206(412.3,282.25) T23 315(425.35,371.85) T24 206(526.3,379.25) T25 216(511.5,307.15)
  T26 206(543.3,271.25)
L10_2 (26): T1 331(45.5,155.4) T2 331(221.85,264.4) T3 331(36.2,318.75) T4 331(464.5,240.45) T5 331(331.95,353.75)
  T6 331(172.35,155.75) T7 331(376.65,166.35) T8 214(79.95,174.4) T9 320(70.95,226.35,s-1) T10 289(190.25,201.0)
  T11 289(69.25,377.7) T12 289(117.6,371.35) T13 206(117.25,321.95) T14 320(141.65,272.65,s-1) T15 214(226.05,328.1)
  T16 204(253.55,152.6) T17 325(376.55,273.1) T18 320(377.65,245.75) T19 206(401.3,331.25) T20 289(432.0,261.65)
  T21 320(480.35,169.4) T22 289(494.75,203.15) T23 289(298.1,345.75) T24 214(451.1,368.3) T25 323(464.0,315.9)
  T26 289(55.75,275.35)
L10_3 (26): T1 331(180.65,180.85) T2 331(55.7,291.2) T3 331(162.2,381.75) T4 331(264.7,344.7) T5 331(464.95,365.75)
  T6 331(352.7,310.45) T7 331(547.65,284.35) T8 214(24.75,174.4) T9 320(70.95,224.35,s-1) T10 289(93.45,264.4)
  T11 289(225.45,213.95) T12 289(157.65,346.0) T13 206(117.25,321.95) T14 320(141.65,277.65,s-1) T15 214(207.05,353.1)
  T16 204(253.55,152.6) T17 325(285.6,309.1) T18 320(377.65,245.75) T19 206(416.35,400.9) T20 289(432.0,261.65)
  T21 320(480.35,172.4) T22 289(494.75,203.15) T23 289(532.75,204.6) T24 214(497.4,284.85) T25 323(487.0,330.9)
  T26 289(522.9,343.65)
```

## 18. Implementation gotchas (things a faithful port must respect)

1. **Frame-skip retract.** The reel-up is not a velocity — it is "advance N timeline frames
   per tick" over a fixed-geometry rope animation. Emulate as
   `ropeProgress += (minerStrength - weight)` per tick against the per-label rope lengths
   (~1.6 px/frame between labels), or turbo `+15` when `stickBonus || strength`.
2. **Delivery overshoot.** Because the retract skips frames, it can land anywhere in
   293–327; every one of those frames triggers delivery identically.
3. **Random layout AND random swing phase** every level (`random(3)+1`, `random(82)`).
4. **`level` resets to 4** (not 1) once it exceeds `total` (10) — endless late game recycles
   layouts 4–10, while `levelDis` and the goal keep climbing (+\$2720/level after levelDis 9).
5. **Buffs are cleared at the shop screen** (main frame 130), so anything bought lasts
   exactly one level; `strength=0` is also re-cleared on layout entry (frame 48).
6. **No funds check in the shop** — score may go negative.
7. **Empty claw = weight −1 → converted to `stickBonus` turbo** on retract; bag weight −1
   behaves identically, and other negative bag weights just make `minerStrength − weight`
   larger.
8. **Time-out mid-reel loses the catch** (only the payout animation sets `/:busy`).
9. **hitTest is AABB** on the claw-tip box versus the object's `ob.box` rectangle
   (scaled with the wrapper's placement scale).
10. **Moles keep walking while caught?** No — catching does `T{x}.gotoAndStop(2)`, freezing
    the wrapper on its empty frame; the claw then displays claw-frame 6/10 art.
11. Original screen text worth reproducing verbatim: shop descriptions (§13) and
    `endText = "You scored " + score + " Points at Gold Miner!"`.
