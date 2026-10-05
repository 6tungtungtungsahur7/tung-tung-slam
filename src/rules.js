/* ============================================================================
   RULES. Pure functions with no drawing, sound or page access, so the tests can
   run them in Node. Anything that decides an outcome belongs here.
   ============================================================================ */

/* ---------- difficulty: one number in (the streak), speed and windows out ---------- */
const easeToward = (start, limit, n, tau) => limit + (start - limit) * Math.exp(-n / tau);

/* [home run, hit, foul] windows in ± ms at difficulty n. */
function windowsAt(n) {
  const C = CFG.CURVE;
  return C.WIN_START.map((w, i) => easeToward(w, C.WIN_FLOOR[i], Math.max(0, n), C.WIN_TAU));
}
/* [slowest, fastest] fastball in mph at difficulty n. */
function fastballAt(n) {
  const C = CFG.CURVE,
    lo = Math.min(C.MPH_MAX - C.MPH_BAND, easeToward(C.MPH_START, C.MPH_START + C.MPH_GAIN, Math.max(0, n), C.MPH_TAU));
  return [lo, lo + C.MPH_BAND];
}

/* ---------- the final boss learns as he goes ---------- */
/* A pitcher's pitches and habits. For the final boss, `level` is how many things he has learned. */
function styleOf(P, level) {
  const style = { pool: Object.assign({}, P.pool), hes: P.hes || 0, quick: P.quick || 0, combo: P.combo || 0, side: !!P.side };
  if (!P.final) return style;
  MIMIC_LEARNS.slice(0, level || 0).forEach((step) => {
    for (const type in step.add) style.pool[type] = (style.pool[type] || 0) + step.add[type];
    if (step.hes) style.hes = step.hes;
    if (step.quick) style.quick = step.quick;
    if (step.combo) style.combo = step.combo;
  });
  return style;
}

/* ---------- pitches ---------- */
/* Turns a pitch type's velocity shape into "fraction of the distance covered at time u".
   The result always starts at 0, ends at 1 and never moves backwards. */
function buildProgress(type, r) {
  const vel = TYPES[type].velocity;
  if (!vel) return (u) => u;
  const N = 200,
    table = new Float32Array(N + 1);
  let sum = 0;
  for (let i = 1; i <= N; i++) {
    sum += Math.max(0.05, vel((i - 0.5) / N, r));
    table[i] = sum;
  }
  for (let i = 1; i <= N; i++) table[i] /= sum;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const x = u * N,
      i = Math.floor(x);
    return lerp(table[i], table[i + 1], x - i);
  };
}

/* Opacity of a ghost ball at time u of a flight lasting T ms. */
function ghostAlpha(u, T) {
  if (u >= 1) return 1;
  const sinceRelease = u * T,
    untilPlate = (1 - u) * T;
  const early =
    sinceRelease < GHOST.SHOW_START ? 1 : clamp(1 - (sinceRelease - GHOST.SHOW_START) / GHOST.FADE, 0, 1);
  const late = untilPlate < GHOST.SHOW_END ? clamp((GHOST.SHOW_END - untilPlate) / GHOST.FADE_IN, 0, 1) : 0;
  return Math.max(early, late);
}

/* Builds one pitch.
   P     the pitcher (style only)
   r     eleven random numbers in [0,1)
   n     difficulty: the streak number in a streak run
   opts  { hes, quick } override his habits (Bottom of the 9th); { level } is the final boss's level */
function makePitch(P, r, n, opts) {
  opts = opts || {};
  const style = styleOf(P, opts.level);
  let total = 0;
  for (const k in style.pool) total += style.pool[k];
  let q = r[0] * total,
    type = 'fast';
  for (const k in style.pool) {
    q -= style.pool[k];
    if (q <= 0) {
      type = k;
      break;
    }
  }
  const ty = TYPES[type],
    band = fastballAt(n),
    fastball = lerp(band[0], band[1], r[1]);
  // every other pitch is a fraction of his fastball
  let mph = fastball * (ty.speed || 1);
  if (ty.maxMph) mph = Math.min(mph, ty.maxMph);
  if (ty.minMph) mph = Math.max(mph, ty.minMph);

  const hesChance = opts.hes != null ? opts.hes : style.hes,
    quickChance = opts.quick != null ? opts.quick : style.quick;
  const hes = r[2] < hesChance ? lerp(250, 800, r[3]) : 0,
    quick = !hes && r[4] < quickChance,
    combo = type !== 'ghost' && r[5] < style.combo,
    T = CFG.MPH_TO_MS / mph,
    rand = { a: r[6] * 6.28, b: r[7] * 6.28 },
    L = CFG.LAUNCH,
    roll = r[10] == null ? 0.5 : r[10];

  return {
    type,
    ty,
    T, // flight time in ms
    mph: Math.round(mph),
    win: windowsAt(n), // [home run, hit, foul] in ± ms
    hes, // pause at the top of the windup, ms
    wind: P.wind * (quick ? 0.75 : 1) * ((CFG.PACE && CFG.PACE.WINDUP) || 1),
    side: P.lefty ? -1 : 1,
    sidearm: style.side && (!P.final || r[6] < 0.5), // the final boss switches arm slots
    r: rand,
    ghost: type === 'ghost' || combo,
    label: (combo ? 'GHOST ' : '') + ty.label,
    // how much harder than a plain fastball: feeds home run distance
    trick: ty.bonus + (hes ? 0.5 : 0) + (combo ? 1.5 : 0) + (quick ? 0.4 : 0),
    // luck of the launch angle: most swings land mid-range, a few get all of it
    launch: lerp(L.MIN, L.MAX, roll) * (roll > 1 - L.JACKPOT_ODDS ? L.JACKPOT : 1),
    arc: clamp(((T - 400) / 1000) * 2.2, 0.15, 1.6),
    end: { x: (r[8] - 0.5) * 0.5, y: ZONE_Y + (r[9] - 0.5) * 0.5 },
    progress: buildProgress(type, rand),
    rel: null, // release point, filled in when the ball leaves the hand
  };
}

/* What a pitcher says before the pitch, or null. He lies when r[1] is above his honesty. */
function bluffFor(P, pitch, r) {
  if (r[0] >= (P.bluff || 0)) return null;
  const truth = BLUFF_TRUTH[pitch.type] || 'trick',
    honest = r[1] < (P.honest == null ? 1 : P.honest);
  let claim = truth;
  if (!honest) {
    const others = Object.keys(BLUFFS).filter((k) => k !== truth);
    claim = others[Math.floor(r[2] * others.length)];
  }
  const lines = BLUFFS[claim];
  return { claim, honest, line: lines[Math.floor(r[3] * lines.length)] };
}

/* ---------- swings ---------- */
/* What a swing `delta` ms from dead-on does, given the windows [home run, hit, foul].
   grand  = within CFG.GRAND_MS: a home run that leaves the park
   homer  = inside the home run window
   hit    = base hit, counts for the streak, no distance
   foul   = stays alive, no streak
   miss   = strike */
function judgeSwing(delta, win) {
  const a = Math.abs(delta);
  if (a <= Math.min(CFG.GRAND_MS, win[0])) return 'grand';
  if (a <= win[0]) return 'homer';
  if (a <= win[1]) return 'hit';
  if (a <= win[2]) return 'foul';
  return 'miss';
}

/* Home run distance in feet. Faster and nastier pitches go farther, so does a swing closer to
   dead-on, and the launch roll spreads them out. */
function homerFeet(pitch, absDelta, perfectWindow, grand, batMult) {
  const D = CFG.DIST,
    precision = 1 - clamp(absDelta / perfectWindow, 0, 1);
  const raw = D.BASE + pitch.mph * D.PER_MPH + pitch.trick * D.PER_TRICK + precision * D.PRECISION,
    feet = raw * (pitch.launch || 1) * (batMult || CFG.BAT_MULT);
  if (grand) return Math.round(Math.max(CFG.HOMER_MAX + 10, feet * grandMult(pitch))); // always past the longest home run
  return Math.round(clamp(feet, CFG.HOMER_MIN, CFG.HOMER_MAX));
}
/* How much farther a grand slam goes than the home run it would have been. Grows with the pitch
   (speed and trickery) and not with the launch roll, so a rookie's grand slam rattles the light
   tower and only the final boss at full speed can be sent to the moon. */
function grandMult(pitch) {
  const G = CFG.GRAND,
    strength = clamp((pitch.mph - G.MPH0) / G.MPH_SPAN + pitch.trick * G.PER_TRICK, 0, 1);
  return G.MULT_LO + (G.MULT_HI - G.MULT_LO) * Math.pow(strength, G.CURVE);
}

/* The landing zone for a distance. */
function zoneOf(feet, grand) {
  const zones = grand ? GRAND_ZONES : HOMER_ZONES;
  let z = zones[0];
  for (const c of zones) if (feet >= c.from) z = c;
  return z;
}
const zoneLabel = (feet) => (feet > CFG.HOMER_MAX ? zoneOf(feet, true) : zoneOf(feet, false)).label;

/* ---------- knockouts ---------- */
/* Does the pitcher leave? `tally` = { homers, hits } against him, `kind` = what just happened. */
function pitcherLeaves(tally, kind) {
  if (kind === 'grand' || tally.homers >= CFG.KO.HOMERS) return 'knockout';
  if (tally.hits >= CFG.KO.PULL_HITS) return 'pulled';
  return null;
}

/* ---------- coins ---------- */
function coinsFor(kind, feet) {
  if (kind === 'grand' || kind === 'homer') return Math.max(1, Math.round(feet * CFG.COIN_PER_FT));
  return kind === 'hit' ? CFG.COIN_PER_HIT : 0;
}
const knockoutCoins = (pitcherIndex) => CFG.KO.COINS * (pitcherIndex + 1);

/* Rally Caps for the next extra chance, after `bought` already paid for in this run. */
function chanceCaps(bought) {
  const steps = CFG.CHANCE.CAPS;
  return bought < steps.length ? steps[bought] : steps[steps.length - 1] + (bought - steps.length + 1);
}

/* ---------- home run streak ---------- */
/* The tier a streak of `n` home runs in a row has reached, or null below the first tier. */
function hrTier(n) {
  let tier = null;
  for (const t of CFG.HR_STREAK) if (n >= t.at) tier = t;
  return tier;
}
const hrCoinMult = (n) => (hrTier(n) ? hrTier(n).coins : 1);

/* ---------- weekly divisions ---------- */
function divisionOf(weekBest) {
  let index = 0;
  CFG.DIVISIONS.forEach((d, i) => {
    if (weekBest >= d.from) index = i;
  });
  const next = CFG.DIVISIONS[index + 1] || null;
  return { index, name: CFG.DIVISIONS[index].name, next, toNext: next ? next.from - weekBest : 0 };
}
/* "Top X%" for a score among a list of scores (includes the player). Null if too few players. */
function percentileOf(score, scores) {
  if (scores.length < CFG.PERCENTILE_MIN_PLAYERS) return null;
  const better = scores.filter((s) => s > score).length;
  return Math.max(1, Math.ceil(((better + 1) / scores.length) * 100));
}

/* ---------- challenge codes ---------- */
/* A code carries the seed of a run and the streak to beat, so a friend faces the same pitch draws. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I, L, O, U: nothing that reads as another character
function makeCode(seed, streak) {
  let n = seed >>> 0,
    out = '';
  for (let i = 0; i < 7; i++) {
    out = CODE_ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out + '-' + Math.max(0, Math.min(999, streak | 0));
}
function readCode(text) {
  const m = /^([0-9A-Z]{7})-?(\d{1,3})$/.exec(String(text || '').toUpperCase().replace(/\s+/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V'));
  if (!m) return null;
  let seed = 0;
  for (const ch of m[1]) {
    const v = CODE_ALPHABET.indexOf(ch);
    if (v < 0) return null;
    seed = seed * 32 + v;
  }
  if (seed > 0xffffffff) return null;
  return { seed: seed >>> 0, target: +m[2] };
}
