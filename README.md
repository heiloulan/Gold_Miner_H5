# Gold Miner (H5)

A faithful HTML5 Canvas remake of the classic Flash game *Gold Miner*, rebuilt
1:1 against the original SWF (715×520 stage, original art, sounds, timings and
scene flow). Zero build step, zero dependencies — plain ES modules.

**Play:** open [`game/`](game/) (the repository root redirects there).

## Run locally

ES modules require an HTTP server (opening `index.html` via `file://` will not work):

```bash
cd game && python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000/>.

## Tests

```bash
cd game && node --test
```

## Repository layout

| Path | Purpose |
|---|---|
| `game/` | The playable game (this is what GitHub Pages serves) |
| `game/src/` | Game source (ES modules) |
| `game/assets/` | Art (PNG) and sound (WAV) extracted from the original |
| `game/test/` | `node:test` suite |
| `AGENTS.md` | Project governance / contributor guide |
| `FLASH_PARITY.md` | Evidence log mapping the remake back to the original SWF |
| `GAME_LOGIC.md` | Original game logic notes |

The original SWF and raw extraction dumps are kept locally only (see
`.gitignore`) and are not part of the published repository.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Repository **Settings → Pages → Source**: *Deploy from a branch*,
   branch `main`, folder `/ (root)`.
3. The game will be at `https://<user>.github.io/<repo>/` (redirects to `game/`).

## Credits

Remake of the Flash game *Gold Miner*. Original art and sounds belong to the
original game's rights holders; this project is a non-commercial preservation
remake.
