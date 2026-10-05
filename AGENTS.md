# Agent instructions — Tung Tung Slam

Plain JS + three.js one-tap baseball streak game. Edit `src/` only; `index.html` is generated. No modules, no bundler, no TypeScript.

## Commands (verified)

```
npm install          # install
npm run dev          # start: offline build + static server on http://localhost:8080
npm run test:fast    # tests: build + rules sim + run sim + awards
```

No format, lint, or typecheck scripts exist in this repo.

After editing `src/`, rebuild with `node build.js` (artifact) or rely on `npm run dev` (rebuilds offline then serves). Full browser suite is `npm test` (~30 min); it needs Chromium at `/opt/pw-browsers/chromium` (see `tests/harness.js`).

## Where things live

| Area | Directory | Copy this file |
| --- | --- | --- |
| Tuning (difficulty, pitchers, distances, prices) | `src/` | `src/config.js` |
| Pure game rules (Node-testable) | `src/` | `src/rules.js` |
| Rally Caps / achievements | `src/` | `src/awards.js` |
| Run flow and modes | `src/` | `src/game.js` |
| After-contact flight and landings | `src/` | `src/payoff.js` |
| Lobby, sheets, shop UI | `src/` | `src/lobby.js` |
| Ballpark / 3D world | `src/` | `src/world.js` |
| Figures (batter, pitchers) | `src/` | `src/figures.js` |
| Sound | `src/` | `src/audio.js` |
| Node rule / award checks | `tests/` | `tests/sim.js` |
| Headless Chromium play / layout | `tests/` | `tests/play.js` |

Read `HANDOFF.md` and `README.md` before non-trivial work.

## Match the repo

Read the surrounding code and match it before writing anything new. If a file, type, or API is not in the repo, say it is missing instead of creating a stand-in.
