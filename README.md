# Tung Tung Slam (was Moonshot Streak)

New here? Read HANDOFF.md first: what the game is, what was decided, what is pending, how to run it on a phone.

One-tap baseball streak game. Web prototype built with three.js; ships as a single page.

## Layout

```
build.js          joins src/ into index.html (one self-contained page)
src/
  config.js       TUNING. Every number that changes how the game feels: the difficulty curve,
                  pitch types, pitchers, knockouts, distance, prices, crowd lines, bluffs.
  rules.js        Pure rules: difficulty by streak, build a pitch, judge a swing, distance, knockouts,
                  bluffs, coins, chance price in Rally Caps, home run streak tiers, weekly divisions,
                  challenge codes. No drawing or sound, so tests run it in Node.
  awards.js       Rally Caps: the achievement list (earned once) and accolades (renewable), the career
                  record they read, day-streak rules, the next-goal picker. Pure, runs in Node.
  progress.js     Applies awards.js after each run and saves it: caps, career, day streak, division.
  state.js        Every variable the game remembers, with the list of game states.
  game.js         Run flow: start a mode (streak, daily, 9th, practice, challenge, warm-up), throw a pitch,
                  read the tap, pause, strikes, extra chances, knockouts, home run streak, records, results.
  payoff.js       After contact: foul, base hit, home run (camera stays), grand slam (camera follows).
  cutscene.js     The final boss's entrance.
  update.js       One step per frame; one small function per game state.
  render.js       Draws a frame; the timing cue (target circle, closing ring, frozen tap ring).
  feedback.js     Scorebug, the word under the target, announcements, speech bubbles, record confetti.
  audio.js        Synthesised sound: effects with variants, crowd reactions, organ tune and stings,
                  volume sliders, pause ducking.
  world.js        Ballpark, sky, lights, time of day.
  town.js         Outside the park: parking lot cars, downtown, suburbs, landing effects.
  figures.js      Batter and pitchers: bodies, faces, poses.
  fx.js           Ball, trail, particles, camera flashes, swing ribbon.
  lobby.js        Home screen tabs, day strip, awards page, shop placeholders, pitcher cards.
  boards.js       Online leaderboards and account name.
  share.js        Share card and caption.
  settings.js     Pause and settings sheet.
  main.js         Input, buttons, boot, test hooks.
  util.js         Small helpers.
  style.css, body.html
tests/
  sim.js          Rule checks in Node: every pitch type is fair, the curve only tightens, fastballs
                  are always the fastest pitch, distances vary and land in the right zones, prices rise.
  runsim.js       10,000 whole runs per skill level: streak lengths, camping, home run streaks, what caps do.
  awards.js       The achievement list is sound, and how fast each kind of player earns Rally Caps.
  pace.js         Seconds per pitch and share of the run spent waiting.
  player.js       The simulated player the simulations share.
  frame.js        A bot hits 36 balls; every home run, hit and foul must stay on screen for its whole flight.
  play.js         A bot plays every mode in headless Chromium and checks the layout on every frame.
  sweep.js        Taps every control with real pointer events: no errors, no dead ends, every overlay can be left.
                  Parts: flow, boss, modes, sizes.
  layout.js       The layout and symmetry rules play.js applies.
  audio.js        Loudness over time: quiet bed, loud reactions, pause ducking, slider solo.
  harness.js      Opens the built page with the 3D engine and the real fonts inlined.
  out/            Screenshots and logs from the last run.
```

## Commands

```
npm install            # once: three.js, Playwright and the two fonts for the tests
node build.js          # after any edit in src/
node tests/sim.js      # seconds
node tests/runsim.js   # seconds
node tests/frame.js    # about 4 minutes
node tests/audio.js    # about 1 minute
node tests/awards.js   # about 1 minute
node tests/pace.js     # about 2 minutes
node tests/play.js flow    # about 6 minutes each: flow, boss, modes, sizes
node tests/sweep.js        # taps every control with real pointer events
npm run dev                # offline build, served on your LAN for a phone
```

## How the game is put together

- **Difficulty follows the streak number only** (`CFG.CURVE`). Two players on the same streak face the
  same windows and speed whoever is pitching, so the board is comparable. It tightens forever toward
  limits a phone can still register.
- **Pitchers are style**: which pitches, windup tricks, how often they talk and lie.
- **A pitcher leaves** on 3 home runs or 1 grand slam (a knockout, pays coins) or after 10 hits (pulled).
- **The final boss** enters once all seven are gone and the streak is at least 20. He never leaves and
  learns a new trick every 5 hits.
- **Chances**: one free per run, then Rally Caps (1, 2, 3...). Caps are never bought: they come from
  achievements (once each) and accolades (Daily Pitch, day streaks, personal bests, placing in the 9th).
- **Home run streak**: from 3 in a row a tag hangs under the scorebug; tiers at 3, 5, 8, 12 grow the
  celebration and multiply coins. A base hit or a strike ends it.
- **Divisions** reset weekly and come from the best streak that week. "Top X%" shows once 10 real players exist.
- **Challenge codes** carry a run's seed and streak; a friend's run draws the same pitches.
- **Warm-up**: three guided pitches on first launch that also set the tap timing.

## Rules that the tests enforce

- While a pitch is live, only the target and ring may be in the ball's path.
- The camera only chases a grand slam; every other ball stays on screen for its whole flight (the home camera may tilt a little to keep a hit in view).
- Grand slams against the first pitchers stay at the lights and scoreboard; nothing reaches downtown before streak 10; the moon is reachable against the final boss.
- Speech bubbles never sit on a banner, call, scorebug or home run tag, and never run off the screen.
- Every pitch travels at steady speed for the last 28% of its flight and takes at least 480 ms.
- A fastball is always faster than any other pitch the same pitcher throws at that moment.
- A ghost ball is visible for 300 ms after release and for the last 330 ms.
- Home runs land inside the park (385 to 555 ft) and vary by at least 60 ft; grand slams clear it.
- A foul resets the home run streak; a base hit or a strike ends it too.
- Sheets are at most 84% of the screen or 300 px wide, centred, and fit without scrolling.
- Button labels stay on one line and off their edges; side-by-side buttons match; nothing is clipped.

## Common changes

| Want to change | Edit |
| --- | --- |
| How fast the game gets hard | `CFG.CURVE` in config.js (start, floor and TAU for windows and speed) |
| What a pitcher throws and how he talks | `PITCHERS` in config.js (`pool`, `hes`, `quick`, `bluff`, `honest`, lines) |
| A pitch's movement or speed | `TYPES` in config.js (`speed`, `velocity`, `off`) |
| When a pitcher leaves | `CFG.KO` |
| Strikes and the paid second chance | `CFG.STRIKES`, `CFG.CHANCE` (one paid chance per streak run; one more strike after it ends the run) |
| The 9th's story, score and the closer's routine | `CFG.NINTH`, `LINES.ninthTaunt`, `NINTH_CUT` and `DRAMA` in cutscene.js, `ninthScore` / `walkOff` in game.js |
| The short board on the results card | `renderResultBoard` and `mockBoard` in boards.js (mock players fill in until six real ones exist) |
| The final boss | `CFG.MIMIC_MIN_STREAK`, `CFG.MIMIC_LEVEL_HITS`, `MIMIC_LEARNS`, cutscene timing in `CUT` (cutscene.js) |
| Grand slam window | `CFG.GRAND_MS` |
| How far balls go and how much they vary | `CFG.DIST`, `CFG.LAUNCH`, `CFG.BAT_MULT` |
| How far a grand slam goes for a given pitch | `CFG.GRAND` (multiplier grows with speed and trick; `grandMult` in rules.js) |
| Where balls land | `GRAND_ZONES` in config.js (lights, scoreboard, street, cars, city, beyond, moon), effects in `LANDINGS` (payoff.js) |
| How base hits and fouls fly and bounce | `BAT` in payoff.js (gravity, bounce, the five shapes: grounder, liner, gapper, chopper, dribbler) |
| What stays in frame | `FRAME` and `FLY` in payoff.js, the camera micro-pan in `PAN` (update.js) |
| Resolution and shadows on slow phones | `QUALITY` in render.js (`setQuality` levels 0 to 2) |
| Per-frame maths without garbage | `sv()` / `svc()` scratch vectors in util.js: reset with `scrReset()` at the top of a frame-level function, never keep one across frames |
| What earns gum and how it is claimed | `ACHIEVEMENTS`, `ACCOLADES`, `queueReward` / `takeRewards` in awards.js; `payCaps`, `claimRewards`, `liveAwards` in progress.js; `claimNow` in main.js |
| The announcement bar | `toast()` in feedback.js (queued; waits for banners and calls) |
| Career and per-pitcher stats | `newCareer`, `newVs`, `recordRun` in awards.js; `noteVs` in progress.js; `openStats` and `vsStatsHtml` in lobby.js |
| Coins and chance prices | `CFG.COIN_PER_FT`, `CFG.KO.COINS`, `CFG.CHANCE` |
| What earns Rally Caps | `ACHIEVEMENTS` and `ACCOLADES` in awards.js |
| Home run streak tiers | `CFG.HR_STREAK` |
| Pace | `CFG.PACE`, flight times in `FLY` (payoff.js) |
| Divisions | `CFG.DIVISIONS`, `CFG.PERCENTILE_MIN_PLAYERS` |
| Sound levels | `AUDIO` and the `mix` table in audio.js |
| Organ tune or stings | `MELODY`, `CHORDS`, `STINGS` in audio.js |
| Replayable Daily and 9th for testing | `CFG.TEST_REPLAY` (set false before launch) |
