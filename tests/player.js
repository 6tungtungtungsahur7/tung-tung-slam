// A simulated player, shared by the simulations. A player is a timing error with a bell curve;
// trick pitches and speed widen it a little. Uses the real rules from src/.
const R = require('./load-rules');
const { CFG, PITCHERS, MIMIC_LEARNS, makePitch, bluffFor, judgeSwing, homerFeet, zoneOf, pitcherLeaves, coinsFor, knockoutCoins, chanceCaps, hrCoinMult, gauss } = R;

const TRICK_TAX = 0.2, // each point of trick widens the error by this fraction
  SPEED_TAX = 0.003; // and each mph over 60 by this fraction
const PLAYERS = [['elite', 18], ['sharp', 25], ['good', 35], ['average', 45], ['casual', 70]];

/* Plays one streak run. o: { caps: Rally Caps to spend on extra chances, aim: true = swing off-centre on purpose }
   Returns everything the awards need to know about the run. */
function playRun(sigma, o) {
  o = o || {};
  let p = 0, streak = 0, strikes = 0, freeChance = true, bought = 0, caps = o.caps || 0, level = 0, mimicHits = 0, hrRun = 0, lastGrand = false, tally = { homers: 0, hits: 0 }, faced = 0;
  const r = { streak: 0, hits: 0, homers: 0, grands: 0, koNames: [], types: [], bestHrRun: 0, hrStreaks: 0, backToBack: false, bluffHomer: false, metMimic: false, mimicAt: null, mimicMaxed: false,
    clean20: false, downtown: false, firstPitchKO: false, coins: 0, bought: 0, capsSpent: 0, pitcher: 0, swings: 0 };
  for (;;) {
    const P = PITCHERS[p],
      pitch = makePitch(P, Array.from({ length: 11 }, Math.random), streak, { level }),
      bluff = bluffFor(P, pitch, [Math.random(), Math.random(), Math.random(), Math.random()]),
      aim = o.aim ? (pitch.win[0] + pitch.win[1]) / 2 : 0,
      delta = aim + gauss() * sigma * (1 + TRICK_TAX * pitch.trick) * (1 + SPEED_TAX * Math.max(0, pitch.mph - 60)),
      kind = judgeSwing(delta, pitch.win);
    r.swings++;
    faced++;
    if (kind === 'miss') {
      hrRun = 0;
      lastGrand = false;
      strikes++;
      if (strikes < CFG.STRIKES) continue; // three strikes and you're out
      if (strikes === CFG.STRIKES && !bought && caps >= chanceCaps(0)) {
        // one paid second chance; after it, one more strike ends the run
        caps -= chanceCaps(0); bought = 1; r.capsSpent += chanceCaps(0);
        continue;
      }
      r.streak = streak; r.bought = bought; r.pitcher = p;
      return r;
    }
    if (kind === 'foul') continue;
    streak++;
    r.hits++;
    tally.hits++;
    if (streak >= 20 && strikes === 0) r.clean20 = true;
    if (kind === 'homer' || kind === 'grand') {
      const feet = homerFeet(pitch, Math.abs(delta), pitch.win[0], kind === 'grand');
      r.homers++;
      hrRun++;
      if (hrRun === CFG.HR_STREAK[0].at) r.hrStreaks++;
      r.bestHrRun = Math.max(r.bestHrRun, hrRun);
      if (r.types.indexOf(pitch.type) < 0) r.types.push(pitch.type);
      if (bluff && !bluff.honest) r.bluffHomer = true;
      r.coins += coinsFor(kind, feet) * hrCoinMult(hrRun);
      if (kind === 'grand') {
        r.grands++;
        if (lastGrand) r.backToBack = true;
        if (zoneOf(feet, true).kind === 'city') r.downtown = true;
        if (faced === 1 && !P.final) r.firstPitchKO = true;
        lastGrand = true;
      } else {
        lastGrand = false;
        tally.homers++;
      }
    } else {
      hrRun = 0;
      lastGrand = false;
      r.coins += coinsFor('hit', 0);
    }
    if (P.final) {
      if (++mimicHits % CFG.MIMIC_LEVEL_HITS === 0 && level < MIMIC_LEARNS.length) level++;
      if (level >= MIMIC_LEARNS.length) r.mimicMaxed = true;
      continue;
    }
    const leaves = pitcherLeaves(tally, kind);
    if (!leaves || (p === 6 && streak < CFG.MIMIC_MIN_STREAK)) continue;
    if (leaves === 'knockout') { r.koNames.push(P.name); r.coins += knockoutCoins(p); }
    p++;
    tally = { homers: 0, hits: 0 };
    faced = 0;
    if (PITCHERS[p].final) { r.metMimic = true; r.mimicAt = streak; }
  }
}
module.exports = { playRun, PLAYERS };
