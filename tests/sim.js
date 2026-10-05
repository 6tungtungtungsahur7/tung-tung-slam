// Rule checks. Plain Node, no browser: `node tests/sim.js`
// Fairness of every pitch, the difficulty curve, speeds, distances and prices.
const R = require('./load-rules');
const { CFG, TYPES, PITCHERS, GHOST, MIMIC_LEARNS, windowsAt, fastballAt, styleOf, buildProgress, ghostAlpha, makePitch, bluffFor, judgeSwing, homerFeet, zoneOf, hrTier, quantile } = R;

let failures = 0;
const check = (ok, msg) => {
  if (!ok) {
    failures++;
    console.log('  FAIL  ' + msg);
  }
};
const draws = () => Array.from({ length: 11 }, Math.random);
const STREAKS = [0, 5, 10, 20, 30, 50, 75, 100, 150, 300];

console.log('1. Pitch flight shapes');
for (const type in TYPES) {
  check((TYPES[type].speed || 1) <= 1 && (type === 'fast' || (TYPES[type].speed || 1) < 1), `${type}: must be slower than the fastball`);
  for (let k = 0; k < 5; k++) {
    const p = buildProgress(type, { a: k * 1.3, b: k * 0.7 });
    let prev = 0,
      monotone = true;
    for (let i = 1; i <= 400; i++) {
      const v = p(i / 400);
      if (v < prev - 1e-6) monotone = false;
      prev = v;
    }
    check(monotone, `${type}: ball moves backwards`);
    check(Math.abs(p(0)) < 1e-6 && Math.abs(p(1) - 1) < 1e-6, `${type}: does not run from 0 to 1`);
    const from = CFG.STEADY_FROM,
      speeds = [];
    for (let i = 0; i < 6; i++) {
      const a = from + ((1 - from) * i) / 6,
        b = from + ((1 - from) * (i + 1)) / 6;
      speeds.push((p(b) - p(a)) / (b - a));
    }
    check((Math.max(...speeds) - Math.min(...speeds)) / Math.max(...speeds) < 0.03, `${type}: final stretch is not steady`);
    // the fastball must be the fastest thing at the plate: no trick pitch may arrive faster than a fastball would
    const plateSpeed = speeds[5] * (TYPES[type].speed || 1);
    check(type === 'fast' || plateSpeed <= 1.06, `${type}: arrives ${plateSpeed.toFixed(2)}x as fast as a fastball`);
  }
}

console.log('2. The difficulty curve (same for every player on the same streak)');
let prevWin = null,
  prevMph = null;
const curve = STREAKS.map((n) => {
  const w = windowsAt(n),
    m = fastballAt(n);
  if (prevWin) {
    check(w.every((x, i) => x < prevWin[i]), `windows at streak ${n} are not tighter than before`);
    check(m[0] >= prevMph[0], `fastball at streak ${n} is slower than before`);
  }
  check(w[0] < w[1] && w[1] < w[2], `windows out of order at streak ${n}`);
  check(w[0] >= CFG.GRAND_MS, `home run window at streak ${n} is tighter than the grand slam window`);
  check(CFG.MPH_TO_MS / m[1] >= 480, `fastball at streak ${n} arrives in under 480 ms`);
  prevWin = w;
  prevMph = m;
  return { streak: n, 'home run ±ms': w[0].toFixed(0), 'hit ±ms': w[1].toFixed(0), 'foul ±ms': w[2].toFixed(0), 'fastball mph': m.map((x) => x.toFixed(0)).join('-') };
});
console.table(curve);
check(CFG.GRAND_MS * 2 >= 16, 'grand slam window is narrower than one 60 Hz frame');

console.log('3. Every pitcher at every streak: speed order, flight time, ghost visibility');
const everyone = PITCHERS.map((P) => [P, 0]).concat(MIMIC_LEARNS.map((_, i) => [PITCHERS[PITCHERS.length - 1], i + 1]));
for (const [P, level] of everyone)
  for (const n of STREAKS) {
    const fast = [],
      other = [];
    for (let k = 0; k < 600; k++) {
      const pitch = makePitch(P, draws(), n, { level });
      (pitch.type === 'fast' ? fast : other).push(pitch.mph);
      check(pitch.T >= 478, `${P.name} at ${n}: ${pitch.label} arrives in ${pitch.T.toFixed(0)} ms`);
      check(pitch.T <= 1700, `${P.name} at ${n}: ${pitch.label} takes ${pitch.T.toFixed(0)} ms, too slow to stay tense`);
      if (pitch.ghost) {
        const seenStart = ghostAlpha((GHOST.SHOW_START - 20) / pitch.T, pitch.T) > 0.99,
          seenEnd = ghostAlpha(1 - (GHOST.SHOW_END - GHOST.FADE_IN - 10) / pitch.T, pitch.T) > 0.99;
        check(seenStart && seenEnd, `${P.name} at ${n}: ghost ball hidden too close to release or plate`);
      }
    }
    if (fast.length && other.length) check(Math.max(...other) <= Math.min(...fast), `${P.name} at ${n}: a fastball (${Math.min(...fast)}) is slower than another pitch (${Math.max(...other)})`);
  }
check(Object.keys(styleOf(PITCHERS[7], 5).pool).length === Object.keys(TYPES).length, 'the final boss never learns every pitch');

console.log('4. Distances: what a player sees at each streak (2,000 home runs and grand slams against The Closer\'s mix)');
const rows = [];
for (const n of [0, 3, 10, 20, 40, 80, 120]) {
  const hr = [],
    gs = [],
    P = PITCHERS[n >= 100 ? 7 : Math.min(6, Math.floor(n / 5))];
  for (let k = 0; k < 2000; k++) {
    const pitch = makePitch(P, draws(), n, { level: P.final ? 5 : 0 }),
      w = pitch.win[0];
    hr.push(homerFeet(pitch, CFG.GRAND_MS + Math.random() * (w - CFG.GRAND_MS), w, false));
    gs.push(homerFeet(pitch, Math.random() * CFG.GRAND_MS, w, true));
  }
  check(Math.min(...hr) >= 380 && Math.max(...hr) <= 555, `streak ${n}: a home run lands outside the park seats (${Math.min(...hr)}-${Math.max(...hr)})`);
  check(Math.min(...gs) > CFG.HOMER_MAX, `streak ${n}: a grand slam of ${Math.min(...gs)} ft does not beat the longest home run`);
  const kinds = gs.map((f) => zoneOf(f, true).kind),
    share = (list) => kinds.filter((k) => list.indexOf(k) >= 0).length / kinds.length;
  if (n <= 3) check(share(['lights', 'board']) >= 0.8, `streak ${n}: early grand slams should stay at the lights and scoreboard (${Math.round(share(['lights', 'board']) * 100)}%)`);
  if (n <= 10) check(share(['city', 'beyond', 'moon']) <= 0.01, `streak ${n}: a grand slam reached downtown this early`);
  if (n >= 100) check(share(['moon']) >= 0.08, `streak ${n}: the moon should be reachable against the final boss (${Math.round(share(['moon']) * 100)}%)`);
  check(quantile(hr, 0.9) - quantile(hr, 0.1) >= 60, `streak ${n}: home runs all look the same (middle 80% spans ${quantile(hr, 0.9) - quantile(hr, 0.1)} ft)`);
  check(quantile(gs, 0.9) - quantile(gs, 0.1) >= 120, `streak ${n}: grand slams all look the same`);
  const land = {};
  gs.forEach((f) => (land[zoneOf(f, true).label] = (land[zoneOf(f, true).label] || 0) + 1));
  rows.push({ streak: n, pitcher: P.name, 'home runs (middle 80%)': `${quantile(hr, 0.1)}-${quantile(hr, 0.9)} ft`, 'grand slams (middle 80%)': `${quantile(gs, 0.1)}-${quantile(gs, 0.9)} ft`, longest: Math.max(...gs) + ' ft',
    'grand slams land': Object.keys(land).map((k) => `${k} ${Math.round((land[k] / gs.length) * 100)}%`).join(', ') });
}
console.table(rows);

console.log('5. Bluffs');
PITCHERS.forEach((P) => {
  let said = 0,
    lies = 0;
  const N = 4000;
  for (let k = 0; k < N; k++) {
    const b = bluffFor(P, makePitch(P, draws(), 20, { level: 5 }), draws());
    if (b) {
      said++;
      if (!b.honest) lies++;
    }
  }
  if (P.name === 'ROOKIE') check(lies === 0, 'Rookie must never lie');
  console.log(`   ${P.name.padEnd(14)} talks before ${Math.round((said / N) * 100)}% of pitches, lies in ${said ? Math.round((lies / said) * 100) : 0}% of those`);
});

console.log('6. Home run streak tiers');
let lastAt = 0, lastCoins = 1;
CFG.HR_STREAK.forEach((t) => {
  check(t.at > lastAt && t.coins > lastCoins, `tier ${t.name} must come later and pay more than the one before`);
  lastAt = t.at;
  lastCoins = t.coins;
});
check(hrTier(2) === null && hrTier(3).name === CFG.HR_STREAK[0].name && hrTier(999) === CFG.HR_STREAK[CFG.HR_STREAK.length - 1], 'tier lookup');
console.log('   ' + CFG.HR_STREAK.map((t) => `${t.at} in a row: ${t.name}, coins x${t.coins}`).join(' | '));

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll rule checks passed');
process.exit(failures ? 1 : 0);
