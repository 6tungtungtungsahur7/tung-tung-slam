/* ============================================================================
   PROGRESS. Everything that carries over between runs: Rally Caps, the career
   record, achievements and accolades, the Daily day streak, the weekly division.
   The rules live in awards.js; this file applies them and saves the result.
   ============================================================================ */

/* A fresh record of what one run did. Filled in as the run goes. */
const newRunRecord = () => ({
  streak: 0, hits: 0, homers: 0, grands: 0, koNames: [], types: [], bestHrRun: 0, swings: 0, bias: 0, vs: {},
  backToBack: false, bluffHomer: false, metMimic: false, mimicMaxed: false, clean20: false, downtown: false, firstPitchKO: false,
});
/* This run's numbers against the pitcher on the mound. */
const vsNow = () => vsOf(run.rec, PITCHERS[pIdx].name);
/* Notes one outcome against the current pitcher: pa (a pitch faced), hit, homer, grand, ko, k (strike). */
function noteVs(what, delta) {
  if (!run.rec) return;
  const v = vsNow();
  if (what === 'pa') v.pa++;
  else if (what === 'k') {
    v.ks++;
    v.row = 0;
  } else if (what === 'ko') v.kos++;
  else if (what === 'foul') v.row = v.row || 0; // a foul changes nothing
  else {
    v.hits++;
    if (what !== 'hit') v.homers++;
    if (what === 'grand') v.grands++;
    v.row = (v.row || 0) + 1;
    v.best = Math.max(v.best, v.row);
  }
  if (typeof delta === 'number') {
    v.swings++;
    v.bias += delta;
    run.rec.swings++;
    run.rec.bias += delta;
  }
}

/* Modes whose swings count toward the career record. */
const countsForCareer = () => run.mode === 'streak' || run.mode === 'daily' || run.mode === 'ninth';
/* Modes that play by streak-run rules: knockouts, pulls, the final boss. */
const streakRules = () => run.mode === 'streak' || run.mode === 'challenge';

const saveProgress = () => {
  store.set('caps', caps);
  store.set('career', JSON.stringify(career));
  store.set('days', JSON.stringify(dayRec));
  store.set('week', JSON.stringify(weekRec));
  store.set('paid', JSON.stringify(paid));
};

/* Earns gum: it waits in the claim queue until the player taps CLAIM (results card, Awards, pause
   menu). The results card lists what this run earned. */
function payCaps(title, amount, id) {
  if (!queueReward(career, id || title, title, amount)) return;
  run.gains.push({ title, caps: amount });
}
/* Pays out everything waiting. Returns the gum paid. */
function claimRewards() {
  const got = takeRewards(career);
  if (!got.caps) return 0;
  caps += got.caps;
  saveProgress();
  store.set('caps', caps);
  return got.caps;
}
/* Mid-run: achievements this run has just finished get announced; they are queued when the run settles. */
function liveAwards() {
  if (!countsForCareer() || !run.rec) return;
  run.rec.streak = run.mode === 'streak' ? run.streak : 0;
  liveAchievements(career, run.rec, run.liveGot).forEach((a) => {
    run.liveGot.push(a.id);
    toast('ACHIEVEMENT', a.title, '+' + a.caps + (a.caps === 1 ? ' slice' : ' slices'));
    floatGain('pizza', a.caps);
  });
}
/* Pays an accolade once per `key` (a date or a weekly event id). */
function payAccolade(name, key) {
  const slot = name + ':' + key;
  if (paid[slot]) return false;
  paid[slot] = 1;
  // keep the list short: only the latest 40 entries matter
  const keys = Object.keys(paid);
  if (keys.length > 40) keys.slice(0, keys.length - 40).forEach((k) => delete paid[k]);
  payCaps(ACCOLADES[name].title, ACCOLADES[name].caps, slot);
  return true;
}

/* Called once when a run ends. Updates the career, pays what was earned, and returns the
   facts the results card shows. */
function settleRun() {
  const out = { promoted: false, division: null, percentile: null, goal: null };
  if (!countsForCareer()) return out;
  const mode = run.mode,
    rec = run.rec,
    oldBest = career.best;
  rec.streak = mode === 'streak' ? run.streak : 0;
  recordRun(career, rec);
  claimAchievements(career).forEach((a) => payCaps(a.title, a.caps, a.id));

  if (mode === 'streak') {
    if (run.streak > oldBest && oldBest >= BEST_ACCOLADE_MIN) payCaps(ACCOLADES.best.title, ACCOLADES.best.caps, 'best:' + run.streak);
    // weekly division
    if (weekRec.event !== eventId()) weekRec = { event: eventId(), best: 0 };
    const before = divisionOf(weekRec.best);
    weekRec.best = Math.max(weekRec.best, run.streak);
    out.division = divisionOf(weekRec.best);
    out.promoted = out.division.index > before.index;
    out.percentile = percentileOf(weekRec.best, boards.week.map((r) => r.wkBest));
  }
  if (mode === 'daily') {
    const t = today();
    if (dayRec.last !== t) {
      dayRec = { last: t, streak: dayStreakAfter(dayRec.streak, dayRec.last, t) };
      career.dailyDays++;
      claimAchievements(career).forEach((a) => payCaps(a.title, a.caps, a.id));
      payAccolade('daily', t);
      const bonus = dayStreakAccolade(dayRec.streak);
      if (bonus) payAccolade(bonus, t);
    }
  }
  if (mode === 'ninth') payAccolade('ninth', run.event);
  out.goal = nextGoal(career);
  saveProgress();
  return out;
}

/* Placings need other players, so they are checked whenever the boards update. */
function checkPlacings() {
  if (!uid) return;
  const before = unclaimedCaps(career),
    need = CFG.PERCENTILE_MIN_PLAYERS;
  const uniq = (rows) => {
    const bestBy = {};
    rows.forEach((r) => (bestBy[r.id] = Math.max(bestBy[r.id] || 0, r.streak != null ? r.streak : r.feet)));
    return bestBy;
  };
  // Daily Pitch: top 10% today
  const daily = uniq(boards.daily);
  if (daily[uid] && Object.keys(daily).length >= need && percentileOf(daily[uid], Object.values(daily)) <= 10) payAccolade('dailyTop', today());
  // last week's 9th: winner, or top 10%
  if (boards.ninthPrev && boards.ninthPrev.length) {
    const mine = boards.ninthPrev.find((r) => r.id === uid),
      scores = boards.ninthPrev.map((r) => r.feet);
    if (mine && boards.ninthPrev.length >= 2 && boards.ninthPrev[0].id === uid) payAccolade('ninthWin', lastEventId());
    else if (mine && scores.length >= need && percentileOf(mine.feet, scores) <= 10) payAccolade('ninthTop', lastEventId());
  }
  if (unclaimedCaps(career) !== before) {
    saveProgress();
    lobbySync();
  }
}

/* How many of the last seven Daily days are alive in the current streak, 0..7. */
function dayStreakDots() {
  const t = today(),
    gap = Math.round((Date.parse(t + 'T00:00:00Z') - Date.parse((dayRec.last || '1970-01-01') + 'T00:00:00Z')) / 864e5);
  if (gap > 1) return { filled: 0, playedToday: false, streak: 0 };
  return { filled: ((dayRec.streak - 1) % 7) + 1, playedToday: gap === 0, streak: dayRec.streak };
}

/* The challenge code for the run just played. */
const runCode = () => makeCode(run.seed, run.streak);
