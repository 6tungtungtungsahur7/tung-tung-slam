# Tung Tung Slam: handoff

Read this first, then README.md (module map, test rules, "what to edit" table). This file is the context the
code cannot tell you: what the game is, what was decided and why, what is half-done, and how to work on it
without breaking the parts that were measured into shape.

## What it is

A one-tap mobile baseball streak game. A pitch comes in; a ring closes on a circle at the plate; you tap when
they meet. Dead-on is a grand slam, close is a home run, further out is a base hit, then a foul, then a strike.
The streak counts hits and home runs in a row. Difficulty follows the streak number only (`CFG.CURVE`), so good
players are never punished for being good, and the windows shrink toward fixed floors.

Branded as Tung Tung Slam: the batter is Tung Tung Tung Sahur (IP Studios' character, built from the character
sheet in `docs/` if present, otherwise from the measurements in `makeTung()` in figures.js). Pitchers are generic
baseball pitchers. The other Italian brainrot characters are future playable batters, not pitchers, and only the
ones IP Studios controls appear anywhere: Chimpanzini Bananini, Lirilì Larilà, Brr Brr Patapim, Cappuccino
Assassino. Tralalero Tralala and Bombardiro Crocodilo must not appear. Ballerina Cappuccina waits on clearance.

Live prototype: a Claude artifact (https://claude.ai/artifact/LxCRXVYkHQAuhTowAqLTj1). Ranks, the Daily board and
the 9th board use the artifact runtime (`window.claude.use('db' | 'user' | 'downloads')`). Outside claude.ai the
game detects that and runs single-player with local bests; nothing crashes.

## Running it

```
npm install            # three@0.128 (tests only), playwright, the two typefaces
npm run dev            # builds offline and serves on http://localhost:8080 plus your LAN IP for a phone
npm run build          # index.html for the artifact: three.js and fonts from CDNs, no doctype (the artifact host wraps it)
npm run build:offline  # index.html that works from file:// with no network (fonts and three.js inlined, ~1 MB)
npm run test:fast      # rules sim, run sim, awards: seconds
npm test               # everything, about 30 minutes; play.js parts can run alone: node tests/play.js flow|boss|modes|sizes
```

Edit `src/`, never `index.html`; `build.js` concatenates `src/*.js` in a fixed order into one IIFE. Everything is a
plain script-level `const`/`function`, no modules, no bundler. `index.html` is gitignored.

## Rules as they stand (all implemented)

- Windows at streak n: `windowsAt(n)` eases `[30, 90, 135]` ms toward `[11, 22, 34]` with tau 30. Fastball speed eases
  46 to 98 mph with tau 35. Grand slam is within 8 ms. `rules.js` is pure and runs in Node for the sims.
- Three strikes and out. In a streak run the third strike can be bought back once for 1 pizza slice; after that one
  more strike ends the run. Daily and challenge runs have no second chance. Fouls are not strikes. A foul resets the
  home run streak; a base hit or a strike ends it too.
- Pitchers leave on 3 home runs or 1 grand slam (knockout, pays coins) or 10 hits (pulled, pays nothing). The final
  pitcher MIMIC enters only after all seven are beaten and the streak is 20 or more; he learns a trick every 5 hits
  and never leaves.
- Home run streak tiers 3/5/10/25 are built out (tag, embers, trail colour, fireworks, slow motion from 10, gold
  stadium lights from 25); 50/100/200 exist in config only.
- Grand slam distance = home run distance × a multiplier that grows with the pitch's speed and trickery, not with
  the launch roll (`grandMult`). Rookie grand slams hit the light tower or the scoreboard; the final boss reaches
  the moon. Landing zones: lights, board, street, cars, city, beyond, moon.
- Base hits and fouls obey gravity (`BAT` in payoff.js): grounder, liner, gapper, chopper, dribbler. The play ends at
  about 1 s and the ball keeps rolling for show while the next pitch sets up. The home camera tilts a little to
  follow (`PAN` in update.js); it only chases a grand slam.
- Currencies: coins (earned every run, nothing to buy yet) and pizza slices (earned from achievements and the Daily,
  claimed by tapping CLAIM, spent on the second chance). Rewards queue in `career.unclaimed` and are paid only on
  claim; `claimNow()` in main.js is the one path.
- Modes: streak, daily (seeded by date, 5 pitches per pitcher, no second chance), ninth (weekly, 3 swings, home run
  feet, cinematic: opening cut on the scoreboard, closer's pre-pitch routine, heartbeat, walk-off on a grand slam),
  practice (any pitcher, pays nothing), challenge (a code carries a seed and a streak to beat), warmup (3 guided
  pitches on first launch, sets the tap offset).
- Timing: the swing reads `pointerdown` with the event timestamp. `CFG.OFFSET_DEFAULT` (60 ms) plus a learned
  per-player offset; the ring meets the circle `CFG.CUE_LEAD_MS` (16 ms) before the ball reaches the plate to
  cover display lag.
- `CFG.TEST_REPLAY: true` makes the Daily and the 9th replayable, each attempt posting as a new row. Set it false
  before any public build.

## Decisions that are not obvious from the code

- The scratch vector pool (`sv`, `svc`, `scrReset` in util.js) exists because the figure maths allocated about 100
  Vector3 per frame and the GC pauses showed as stutter. Never keep a scratch vector across frames.
- The adaptive quality probe (`QUALITY` in render.js) ignores the first 3 s and steps back up after 10 fast
  seconds. An earlier version stepped down during boot and stayed blurry forever.
- Phones get a 1024 PCF shadow map and no multisampling at 2x+ pixel ratio. The frame clock moves at most 100 ms per
  frame so a stutter never turns into slow motion.
- Sheets are at most 84% of the width or 300 px; pages 340 px with an X in the corner; every tappable control at
  least 44×40. The layout rules in tests/layout.js run inside the page on every test frame.
- Speech bubbles never overlap a banner, call, scorebug or home run tag; the game announces one thing at a time
  (`talkAllowed`, `announcing` in feedback.js).
- The results card shows a short board with mock players until six real ones exist (`mockBoard` in boards.js,
  seeded per day). They are marked `.mock` in the DOM and nowhere in the UI.
- Pace target is under 4.0 s per pitch (tests/pace.js); it was 3.8 before base hits obeyed gravity.

## Performance, unresolved

The owner reports low frame rate and chop on an iPhone 16 Pro inside the claude.ai artifact. Settings → "Show
performance numbers" prints fps, worst frame, update vs render ms, draw calls, pixel ratio and quality level.
Nothing has been measured on real hardware yet; the headless test browser renders in software. Suspects, in order:
the artifact runs inside claude.ai's own page on iOS (same process; a standalone tab or a Netlify deploy is the
test), GPU fill at 2x on a 2532-px-tall screen, and spikes from shader compiles or audio node creation. Known
costs: about 300 draw calls in play (each trail and flash sprite is its own material), a shadow pass over both
figures, instanced crowd updates while hype is up.

## What is pending, in the owner's priority

Build 2, waiting on his answers (gum-for-coins rule, Daily replay price, XP numbers, level rewards, level cap, bat
distance rule, 9th cadence and replay price, timing meter keep or drop):

- XP and levels: simulated formula in the chat history: XP per run = 30 + 14√hits + 12√HR + 25/grand slam + 25/KO
  (max 3), Daily +80, day streak +20/day to 7; level L needs 220×(L−1)^1.75; cap 50. Level ring on the avatar, level
  row in the pause menu, XP bar on the results card, LEVEL UP moment. Levels claim through the same CLAIM path.
- Shop: bats (cosmetic plus a distance multiplier; the 9th board and achievements record base feet), playable batters
  (the four cleared characters, placeholders exist in `SHOP.shopTeams`), emotes and swing styles (`EMOTES` in
  figures.js has one placeholder pose; the batter rig can take pose sets), stadiums, card packs (coins only, odds
  shown), pizza bundles (provisional USD ladder 5/$0.99, 30/$4.99, 70/$9.99, 160/$19.99, 450/$49.99), a streak
  freeze for pizza.
- Daily becomes "the Gauntlet": one plain pitcher, fastballs only, no bluffs, speed on a fixed ramp, one attempt,
  replayable for a price.
- Manager's choice: on a knockout, pick one of two next pitchers; the harder one carries a coin multiplier.
- First-launch flow straight into the warm-up with a ghost finger; "N short of your best" on the results card;
  destructive buttons moved; bottom-anchored sheets (the checklist review in the chat history).
- Native shell, lifecycle (resume a run), save schema, server-side score checks (seeds replay), IAP and ads
  (rewarded video as a second route to the second chance).

Owner's working style: propose and simulate before implementing, ask his questions as a numbered multiple-choice
list, call out when new feedback contradicts an earlier decision, close with a consequence pass. He is not a
developer; explain tooling plainly.

## Dev hooks (only when `window.__DEV = true`, which the tests set)

`window.__ms` exposes state, run, pitch, windows, eta, corridor, ballXY, best, coins, capCount, career, days, cam(),
bat(mult), caps(n), streak(n), pitcher(i), seenAll(), emote(name), pitMood, pitX, pitYaw. `window.__botPlan` drives
the test bot: numbers are timing errors in ms, `null` takes the pitch, `{kind, f, sign}` aims inside a window.
`window.__forceRoll` pins the launch luck, `window.__today` the date, `window.__skipRender` runs the game without
drawing, `window.__moodLock` the lighting.

## Gotchas

- three.js r128 as a global (`THREE`); the build has no module system. Do not upgrade three casually: the toon
  material, sprite and instanced-mesh APIs changed after r150.
- `tests/harness.js` inlines three.js and the fonts into a copy of index.html so Chromium can run with no network;
  it uses `--use-angle=swiftshader`, so frame rates in tests mean nothing and game time runs slowly while rendering
  (`__skipRender` is how tests fast-forward).
- localStorage keys are prefixed `ms_` (best, bomb, caps, career, coins, daily, days, hap, ko, ninth, off, paid, perf,
  seen, warm, week). Changing the career shape needs a migration in `newCareer`/`recordRun`; `Object.assign(newCareer(),
  stored)` covers added fields only.
- The artifact build must have no doctype/html/head/body of its own (the host wraps it); the offline build adds them.
- Sounds are synthesised in audio.js (WebAudio); there are no audio files. Fonts are the only external assets.
