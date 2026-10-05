// Rally Cap supply: `node tests/awards.js`
// Caps come only from achievements (once each) and accolades (renewable). This checks the list is sound
// and simulates how fast each kind of player earns caps, so chances stay scarce.
const R = require('./load-rules');
const { CFG, ACHIEVEMENTS, ACCOLADES, BEST_ACCOLADE_MIN, newCareer, recordRun, claimAchievements, nextGoal, dayStreakAccolade, chanceCaps, makeCode, readCode, divisionOf, percentileOf, quantile } = R;
const { playRun, PLAYERS } = require('./player');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL  ' + msg); } };

console.log(`1. The list: ${ACHIEVEMENTS.length} achievements worth ${ACHIEVEMENTS.reduce((a, x) => a + x.caps, 0)} caps`);
check(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, 'achievement ids must be unique');
const fresh = newCareer();
ACHIEVEMENTS.forEach((a) => {
  check(a.title && a.text && a.caps >= 1 && (a.done || a.progress), `${a.id}: needs a title, text, caps and a test`);
  check(a.title.length <= 20 && a.text.length <= 52, `${a.id}: title or text too long for its row ("${a.title}" / "${a.text}")`);
  check(!R.achievementDone(a, fresh), `${a.id}: a brand new player already has it`);
});
const groups = {};
ACHIEVEMENTS.forEach((a) => (groups[a.group] = (groups[a.group] || 0) + a.caps));
console.log('   by group:', groups);
check(claimAchievements(newCareer()).length === 0, 'nothing is paid to a new career');

console.log('\n2. Caps from achievements, by run number (median of 150 simulated careers)');
const marks = [1, 5, 20, 50, 100, 300], rows = [];
const careers = {};
for (const [name, sigma] of PLAYERS) {
  const at = marks.map(() => []), perBest = [];
  for (let k = 0; k < 150; k++) {
    const c = newCareer();
    let caps = 0, bests = 0;
    for (let n = 1; n <= 300; n++) {
      const r = playRun(sigma);
      if (r.streak > c.best && c.best >= BEST_ACCOLADE_MIN) bests++;
      recordRun(c, r);
      caps += claimAchievements(c).reduce((a, x) => a + x.caps, 0);
      const i = marks.indexOf(n);
      if (i >= 0) at[i].push(caps);
    }
    perBest.push(bests);
    if (k === 0) careers[name] = c;
  }
  const row = { player: name };
  marks.forEach((m, i) => (row['after ' + m] = quantile(at[i], 0.5)));
  row['personal bests in 300 runs'] = quantile(perBest, 0.5);
  rows.push(row);
}
console.table(rows);
const get = (name, mark) => rows.find((r) => r.player === name)['after ' + mark];
check(get('average', 20) <= 24, `an average player holds ${get('average', 20)} gum after 20 runs (limit 24: the early flood must stay small)`);
check(get('elite', 1) <= 22, `an elite player earns ${get('elite', 1)} caps in the first run (limit 22)`);
check(get('casual', 20) >= 3, 'a casual player must earn something in their first 20 runs');
check(get('casual', 300) < get('elite', 300), 'skill must earn more over a career');

console.log('\n3. A regular: 8 runs a day including Daily Pitch, for 28 days. Caps earned per day after the first week.');
const daily = [];
for (const [name, sigma] of PLAYERS) {
  const perDay = [];
  for (let k = 0; k < 60; k++) {
    const c = newCareer();
    let late = 0;
    for (let day = 1; day <= 28; day++) {
      let caps = ACCOLADES.daily.caps;
      c.dailyDays++;
      const streakPay = dayStreakAccolade(day);
      if (streakPay) caps += ACCOLADES[streakPay].caps;
      for (let n = 0; n < 8; n++) {
        const r = playRun(sigma);
        if (r.streak > c.best && c.best >= BEST_ACCOLADE_MIN) caps += ACCOLADES.best.caps;
        recordRun(c, r);
        caps += claimAchievements(c).reduce((a, x) => a + x.caps, 0);
      }
      if (day > 7) late += caps;
    }
    perDay.push(late / 21);
  }
  daily.push({ player: name, 'caps per day': quantile(perDay, 0.5).toFixed(1), 'chances per week that buys (1 per run)': Math.round(quantile(perDay, 0.5) * 7) });
}
console.table(daily);
daily.forEach((d) => check(+d['caps per day'] >= 1 && +d['caps per day'] <= 2.5, `${d.player}: ${d['caps per day']} caps a day (target 1 to 2.5)`));

console.log('\n4. Prices, goals, codes, divisions');
check([0, 1, 2, 3].map(chanceCaps).join() === '1,2,3,4', 'chance price must be 1, 2, 3, then one more each time');
const goal = nextGoal(careers.average);
console.log('   next goal for the simulated average player:', goal ? `${goal.a.title}: ${goal.a.text} (${goal.have}/${goal.need})` : 'none left');
check(nextGoal(newCareer()) !== null, 'a new player must have a next goal');
for (let i = 0; i < 2000; i++) {
  const seed = (Math.random() * 4294967296) >>> 0, streak = (Math.random() * 200) | 0, back = readCode(makeCode(seed, streak));
  if (!back || back.seed !== seed || back.target !== streak) { check(false, 'challenge code does not survive a round trip: ' + makeCode(seed, streak)); break; }
}
check(readCode('nonsense') === null && readCode('') === null, 'bad codes must be rejected');
check(readCode(makeCode(12345, 22).toLowerCase().replace('-', ' ')) !== null, 'codes should survive lower case and a missing dash');
check(divisionOf(0).index === 0 && divisionOf(9).toNext === 1 && divisionOf(500).next === null, 'division ladder');
check(percentileOf(50, [1, 2, 3]) === null && percentileOf(50, Array.from({ length: 20 }, (_, i) => i)) === 5, 'percentile needs enough players and puts the best at the top');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll award checks passed');
process.exit(failures ? 1 : 0);
