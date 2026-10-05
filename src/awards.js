/* ============================================================================
   AWARDS. Rally Caps and everything that earns them. Pure data and functions,
   so tests can run it in Node.
     ACHIEVEMENTS  earned once each: skill firsts and career totals
     ACCOLADES     earned again and again: showing up, placing, beating yourself
   A `career` is the saved record of everything a player has done (see newCareer).
   ============================================================================ */

function newCareer() {
  return {
    runs: 0,
    hits: 0,
    homers: 0, // includes grand slams
    grands: 0,
    kos: 0,
    koNames: [], // pitchers knocked out at least once
    best: 0, // best streak
    bestHrRun: 0, // most home runs in a row
    backToBack: false, // two grand slams in a row
    bluffHomer: false, // a home run on a pitch he lied about
    types: [], // pitch types hit for a home run
    metMimic: false,
    mimicMaxed: false, // the final boss learned everything
    clean20: false, // 20 in a row without a strike
    downtown: false, // a grand slam that reached downtown
    firstPitchKO: false, // grand slam on a pitcher's first pitch
    dailyDays: 0, // days with a finished Daily Pitch
    duelsWon: 0,
    vs: {}, // lifetime numbers against each pitcher, by name (see newVs)
    swings: 0, // swings with a timing reading
    bias: 0, // sum of signed swing timing in ms: negative = early
    got: [], // ids of achievements earned
    unclaimed: [], // rewards earned and not yet claimed: [{ id, title, caps }]
  };
}
/* Puts a reward in the claim queue. `id` keeps the same award from queueing twice. */
function queueReward(career, id, title, caps) {
  if (career.unclaimed.some((u) => u.id === id)) return false;
  career.unclaimed.push({ id, title, caps });
  return true;
}
/* Takes everything out of the queue. Returns { caps, items }. */
function takeRewards(career) {
  const items = career.unclaimed.splice(0);
  return { caps: items.reduce((a, u) => a + u.caps, 0), items };
}
const unclaimedCaps = (career) => career.unclaimed.reduce((a, u) => a + u.caps, 0);
/* Achievements a run in progress has just completed, given the career so far: for the
   announcement bar. Does not change the career. */
function liveAchievements(career, rec, already) {
  const probe = JSON.parse(JSON.stringify(career));
  recordRun(probe, rec);
  return ACHIEVEMENTS.filter((a) => career.got.indexOf(a.id) < 0 && already.indexOf(a.id) < 0 && achievementDone(a, probe));
}
/* Lifetime record against one pitcher. */
const newVs = () => ({ pa: 0, hits: 0, homers: 0, grands: 0, kos: 0, ks: 0, best: 0, swings: 0, bias: 0 });
function vsOf(c, name) {
  return c.vs[name] || (c.vs[name] = newVs());
}

const koAll = (names) => (c) => names.every((n) => c.koNames.indexOf(n) >= 0);
/* A tiered career total: one achievement per step. */
const tiers = (key, label, unit, steps, caps) =>
  steps.map((n, i) => ({
    id: key + n,
    group: 'Career',
    title: label + ' ' + ['I', 'II', 'III', 'IV'][i],
    text: n.toLocaleString('en-US') + ' ' + unit,
    caps: caps[i],
    progress: (c) => [Math.min(c[key], n), n],
  }));

/* Each has: id, group, title, text, caps, and either done(career) or progress(career) -> [have, need]. */
const ACHIEVEMENTS = [
  // --- the bullpen
  { id: 'ko3', group: 'Pitchers', title: 'Early Showers', text: 'Knock out Rookie, Hooks and Sidewinder', caps: 1, progress: (c) => [['ROOKIE', 'HOOKS', 'SIDEWINDER'].filter((n) => c.koNames.indexOf(n) >= 0).length, 3] },
  { id: 'ko6', group: 'Pitchers', title: 'Empty Bullpen', text: 'Knock out The Professor, Flutter and Phantom', caps: 1, progress: (c) => [['THE PROFESSOR', 'FLUTTER', 'PHANTOM'].filter((n) => c.koNames.indexOf(n) >= 0).length, 3] },
  { id: 'ko7', group: 'Pitchers', title: 'Door Closed', text: 'Knock out The Closer', caps: 1, done: koAll(['THE CLOSER']) },
  { id: 'mimic', group: 'Pitchers', title: 'Who Is That?', text: 'Bring the final pitcher into the game', caps: 1, done: (c) => c.metMimic },
  { id: 'mimicMax', group: 'Pitchers', title: 'Class Dismissed', text: 'Stay in until the final pitcher learns it all', caps: 2, done: (c) => c.mimicMaxed },
  { id: 'fpko', group: 'Pitchers', title: 'Rude Welcome', text: 'Grand slam on a pitcher\'s first pitch', caps: 1, done: (c) => c.firstPitchKO },
  // --- streaks
  ...[[10, 1], [20, 1], [35, 1], [50, 1], [75, 2], [100, 3]].map(([n, caps]) => ({ id: 'streak' + n, group: 'Streaks', title: n + ' In A Row', text: 'Reach a streak of ' + n, caps, progress: (c) => [Math.min(c.best, n), n] })),
  { id: 'clean20', group: 'Streaks', title: 'No Safety Net', text: '20 in a row without a strike', caps: 1, done: (c) => c.clean20 },
  // --- power
  ...[[3, 1, 'Hot Bat'], [5, 1, 'On Fire'], [10, 2, 'Unstoppable'], [25, 3, 'Legendary'], [50, 5, 'Mythic']].map(([n, caps, title]) => ({ id: 'hr' + n, group: 'Power', title, text: n + ' home runs in a row', caps, progress: (c) => [Math.min(c.bestHrRun, n), n] })),
  { id: 'b2b', group: 'Power', title: 'Back To Back', text: 'Two grand slams in a row', caps: 1, done: (c) => c.backToBack },
  { id: 'downtown', group: 'Power', title: 'Going Downtown', text: 'Land a grand slam downtown', caps: 1, done: (c) => c.downtown },
  { id: 'bluff', group: 'Power', title: 'Nice Try', text: 'Home run on a pitch he lied about', caps: 1, done: (c) => c.bluffHomer },
  { id: 'types', group: 'Power', title: 'Seen It All', text: 'Home run off every pitch type', caps: 2, progress: (c) => [c.types.length, Object.keys(TYPES).length] },
  // --- career totals
  ...tiers('homers', 'Slugger', 'home runs', [50, 250, 1000, 5000], [1, 1, 2, 3]),
  ...tiers('grands', 'Grand Tour', 'grand slams', [10, 50, 250, 1000], [1, 1, 2, 3]),
  ...tiers('kos', 'Wrecking Crew', 'knockouts', [25, 100, 500, 2000], [1, 1, 2, 3]),
  ...tiers('dailyDays', 'Regular', 'days of Daily Pitch', [7, 30, 100], [1, 2, 3]),
];

/* Renewable. `caps` is what each one pays; game code decides when it happened. */
const ACCOLADES = {
  daily: { title: 'Daily Pitch played', caps: 1 }, // first finished Daily of the day
  day3: { title: '3 days in a row', caps: 1 },
  day5: { title: '5 days in a row', caps: 1 },
  day7: { title: '7 days in a row', caps: 2 },
  best: { title: 'New personal best', caps: 1 }, // beat a best of 5 or more
  dailyTop: { title: 'Top 10% in Daily Pitch', caps: 1 },
  ninth: { title: 'Took your shot in the 9th', caps: 1 }, // once per weekly event
  ninthTop: { title: 'Top 10% in the 9th', caps: 2 },
  ninthWin: { title: 'Won the 9th', caps: 5 },
};
const BEST_ACCOLADE_MIN = 5; // "new personal best" only pays once the old best was at least this

const achievementDone = (a, c) => (a.done ? !!a.done(c) : a.progress(c)[0] >= a.progress(c)[1]);

/* Marks every newly completed achievement as paid and returns them. */
function claimAchievements(career) {
  const fresh = ACHIEVEMENTS.filter((a) => career.got.indexOf(a.id) < 0 && achievementDone(a, career));
  fresh.forEach((a) => career.got.push(a.id));
  return fresh;
}

/* Folds one finished run into the career. `r` = what happened in the run. */
function recordRun(career, r) {
  career.runs++;
  career.hits += r.hits || 0;
  career.homers += r.homers || 0;
  career.grands += r.grands || 0;
  career.kos += (r.koNames || []).length;
  (r.koNames || []).forEach((n) => {
    if (career.koNames.indexOf(n) < 0) career.koNames.push(n);
  });
  (r.types || []).forEach((t) => {
    if (career.types.indexOf(t) < 0) career.types.push(t);
  });
  career.best = Math.max(career.best, r.streak || 0);
  career.bestHrRun = Math.max(career.bestHrRun, r.bestHrRun || 0);
  career.swings += r.swings || 0;
  career.bias += r.bias || 0;
  for (const name in r.vs || {}) {
    const a = vsOf(career, name),
      b = r.vs[name];
    for (const k of ['pa', 'hits', 'homers', 'grands', 'kos', 'ks', 'swings', 'bias']) a[k] += b[k] || 0;
    a.best = Math.max(a.best, b.best || 0);
  }
  for (const flag of ['backToBack', 'bluffHomer', 'metMimic', 'mimicMaxed', 'clean20', 'downtown', 'firstPitchKO']) career[flag] = career[flag] || !!r[flag];
}

/* The unfinished achievement the player is closest to, for the "next goal" line. */
function nextGoal(career) {
  let bestPick = null,
    bestShare = -1;
  for (const a of ACHIEVEMENTS) {
    if (career.got.indexOf(a.id) >= 0 || !a.progress) continue;
    const [have, need] = a.progress(career),
      share = have / need;
    if (share < 1 && share > bestShare) {
      bestShare = share;
      bestPick = { a, have, need };
    }
  }
  return bestPick;
}

/* Day streak: `last` and `today` are YYYY-MM-DD. Returns the new streak length for a Daily finished today. */
function dayStreakAfter(streakLength, last, today) {
  if (last === today) return streakLength;
  const gap = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse((last || '1970-01-01') + 'T00:00:00Z')) / 864e5);
  return gap === 1 ? streakLength + 1 : 1;
}
/* Which day-streak accolade (if any) a streak of `n` days pays today. Repeats every 7 days. */
function dayStreakAccolade(n) {
  const day = ((n - 1) % 7) + 1;
  return day === 3 ? 'day3' : day === 5 ? 'day5' : day === 7 ? 'day7' : null;
}
