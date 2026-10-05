/* ============================================================================
   GAME. The run from first pitch to results: starting a mode, throwing a pitch,
   reading the tap, strikes, extra chances, pitching changes and the end of the run.
   What happens after bat meets ball lives in payoff.js.
   ============================================================================ */

const OVERLAYS = ['over', 'chance', 'dist', 'banner', 'sheet', 'share'];
const hideOverlays = (list) => (list || OVERLAYS).forEach((id) => ($(id).hidden = true));

/* Things that must happen later in game time (stops with pause and hit-stop). */
let timers = [];
const later = (ms, fn) => timers.push({ at: gt + ms, fn });
function runTimers() {
  if (!timers.length) return;
  const due = timers.filter((t) => gt >= t.at);
  if (!due.length) return;
  timers = timers.filter((t) => gt < t.at);
  due.forEach((t) => t.fn());
}

function resetPitchState() {
  timers = [];
  pay = homer = hit = lead = pitch = cut = null;
  lastSwing = null;
  ball.on = false;
  bt.q = [];
  pitMood = 'idle';
  paused = false;
  pitchVoided = false;
  clearBubs();
  hideSay();
  hideVerdict();
}

/* ---------- difficulty ---------- */
/* The one number that sets speed and timing windows. In a streak run it is the streak itself,
   so every player on the same streak faces the same game. */
function difficulty() {
  if (run.mode === 'daily') return run.idx; // same pitch number, same difficulty, for everyone
  if (run.mode === 'ninth') return CFG.NINTH_LEVELS[Math.min(run.idx, CFG.NINTH_LEVELS.length - 1)];
  if (run.mode === 'practice') return Math.max(run.streak, run.practiceIdx * 4); // later pitchers start warmer
  if (run.mode === 'warmup') return 0;
  return run.streak; // streak runs and challenges
}

/* ---------- starting ---------- */
/* First launch: three guided pitches before the first real run. Tests skip it unless they ask for it. */
const needsWarmup = () => !store.get('warm', '') && best === 0 && (!window.__DEV || window.__warmup); // returning players skip it

/* mode: streak | daily | ninth | practice | challenge | warmup
   idx: pitcher number for practice.  duel: { seed, target } for a challenge code. */
function startRun(mode, idx, duel) {
  audioInit();
  if (mode === 'ninth' && ninthPlayed()) {
    goTab('Ranks');
    setBoard('ninth');
    return;
  }
  if (mode === 'streak' && needsWarmup()) mode = 'warmup';
  const event = eventId();
  const seed =
    mode === 'daily'
      ? hashStr('moonshot-' + today())
      : mode === 'ninth'
        ? hashStr('ninth-' + event)
        : mode === 'challenge'
          ? duel.seed
          : (Math.random() * 4294967296) >>> 0;
  run = {
    mode,
    streak: 0,
    bomb: 0,
    revived: false,
    strikes: 0, // strikes so far; CFG.STRIKES ends the run (one more after the paid chance)
    idx: 0,
    kos: [],
    seed, // a friend who enters this run's code gets the same draws
    duel: duel || null,
    rng: mulberry(seed),
    redrawRng: mulberry(seed ^ 0x9e3779b9), // replacement pitches after a mid-pitch pause; keeps the main sequence intact
    talkRng: mulberry(seed ^ 0x51ed270b), // what the pitcher says, so a challenge hears the same bluffs
    snap: null,
    snapD: 0,
    practiceIdx: idx || 0,
    feet: 0,
    shots: [],
    coins: 0,
    plan: null, // Bottom of the 9th: which pitcher throws each pitch
    event,
    grands: 0,
    tally: { homers: 0, hits: 0 },
    bought: 0,
    mimicLevel: 0,
    mimicHits: 0,
    bestBefore: mode === 'daily' ? dailyBest() : best, // the record to beat, fixed at the start
    bombBefore: bestBomb,
    recordShown: false,
    hrRun: 0,
    lastGrand: false,
    faced: 0,
    rec: newRunRecord(),
    liveGot: [], // achievements announced mid-run
    gains: [],
    warm: [], // warm-up: raw tap errors, used to set the timing offset
  };
  if (mode === 'ninth') {
    const pool = [2, 3, 4, 5, 6, 7];
    run.plan = [];
    for (let i = 0; i < CFG.NINTH_PITCHES; i++) run.plan.push(pool.splice((run.rng() * pool.length) | 0, 1)[0]);
    ninthRec = { event, feet: 0, shots: [], done: false };
    store.set('ninth', JSON.stringify(ninthRec));
  }
  setPitcher(mode === 'practice' ? run.practiceIdx : mode === 'ninth' ? run.plan[0] : 0);
  if (PITCHERS[pIdx].final) run.mimicLevel = MIMIC_LEARNS.length; // outside a streak run he knows everything

  camIntro = state === 'menu' ? gt : -1e9;
  if (batter) batter.g.rotation.y = PI / 2; // undo any lobby spin
  if (camIntro < 0) {
    camPos.copy(HOME);
    camLook.copy(HLOOK);
  }
  hideOverlays();
  resetPitchState();
  music.stopTune();

  state = 'ready';
  nextAt = gt + (mode === 'ninth' ? 2400 : CFG.PACE.FIRST_PITCH);
  hud();
  hideHrTag();
  const P = PITCHERS[pIdx];
  if (mode === 'warmup') {
    say('WARM-UP', CFG.WARMUP_PITCHES + ' easy pitches. Nothing counts.', '');
    sbDraw('BATTING PRACTICE', 'WARM-UP', 'TAP TO SWING');
  } else if (mode === 'challenge') {
    say('CHALLENGE', 'Beat ' + duel.target + ' in a row', '');
    music.sting('play');
    sbDraw('SAME PITCHES', 'BEAT ' + duel.target, 'vs ' + P.name);
  } else if (mode === 'ninth') {
    sbDraw('GAME SEVEN', '3 SWINGS', 'HOME RUN FEET WIN');
    startNinthIntro();
  } else {
    say('PLAY BALL', 'vs ' + P.name, '');
    music.sting('play');
    sbDraw('NOW PITCHING', P.name, P.tag);
  }
}

function showMenu() {
  state = 'menu';
  hideOverlays();
  resetPitchState();
  camIntro = -1e9;
  camPos.copy(MENU_POS);
  camLook.copy(MENU_LOOK);
  if (batter) batter.g.rotation.y = PI / 2;
  run.mode = 'streak';
  setPitcher(0);
  goTab('Home');
  hud();
  renderBoards();
  renderCards();
  renderShop();
  lobbySync();
  sbDraw('WELCOME TO', 'TUNG TUNG SLAM', 'SIX SEVEN');
  music.startTune();
}

/* ---------- between pitches ---------- */
/* Waits `ms`, then throws. `talk` may put up one bubble; the wait stretches so it can be read. */
let recordCall = null; // a "new best" announcement waiting for the next gap in play
function nextPitchIn(ms, talk) {
  state = 'ready';
  nextAt = gt + ms;
  hud();
  if (recordCall) {
    say(recordCall.main, recordCall.sub, 'perfect');
    recordCall = null;
    nextAt = Math.max(nextAt, gt + 1400);
  } else if (talk && talk()) nextAt = Math.max(nextAt, gt + CFG.PACE.TALK);
}

/* Who should be on the mound for the next pitch in the scheduled modes. */
function scheduledPitcher() {
  if (run.mode === 'daily') return Math.min(PITCHERS.length - 1, Math.floor(run.idx / CFG.DAILY_PER_PITCHER));
  if (run.mode === 'ninth') return run.plan[run.idx];
  return pIdx;
}

function beginPitch() {
  const due = scheduledPitcher();
  if (due !== pIdx) return changePitcher(due);

  // eleven random numbers decide the pitch; a pitch replaced after a pause draws from its own stream
  const rng = pitchVoided ? run.redrawRng : run.rng,
    draws = [];
  for (let i = 0; i < 11; i++) draws.push(rng());
  if (window.__DEV && typeof window.__forceRoll === 'number') draws[10] = window.__forceRoll; // tests pin the launch luck
  pitchVoided = false;
  const P = PITCHERS[pIdx],
    opts = { level: run.mimicLevel },
    warmup = run.mode === 'warmup';
  if (run.mode === 'ninth') Object.assign(opts, { hes: 0.6, quick: 0.5 });
  pitch = makePitch(P, draws, difficulty(), opts);
  run.idx++;
  run.faced++;
  noteVs('pa');
  pitchCount++;
  swung = false;
  ball.on = false;
  pitMood = 'idle';

  // one hit from a personal best: say so, and let the moment breathe
  if (oneAway() && !run.oneAwaySaid) {
    run.oneAwaySaid = true;
    say('ONE AWAY', 'Your best is ' + run.bestBefore, 'perfect');
    crowd.hush();
    state = 'taunt';
    tauntUntil = gt + 950;
    return;
  }
  // first time a trick pitch shows up, name it and say what to watch for
  if (!seen[pitch.type] && pitch.ty.tell) {
    seen[pitch.type] = 1;
    store.set('seen', JSON.stringify(seen));
    state = 'intro';
    introUntil = gt + CFG.PACE.NEW_PITCH;
    showBanner('New pitch', pitch.ty.label, pitch.ty.tell);
    music.sting('newPitch');
    hud();
    return;
  }
  // the 9th: he works at his own pace before every pitch
  if (run.mode === 'ninth' && startDrama()) return;
  // back from the paid chance: he takes his time, and the heart does its thing
  if (run.slowSetup) {
    run.slowSetup = false;
    state = 'taunt';
    tauntUntil = gt + 2600;
    pitMood = 'stare';
    moodUntil = tauntUntil;
    crowd.hush();
    hud();
    return;
  }
  // sometimes he tells you what is coming. Sometimes that is a lie.
  const talk = run.talkRng,
    bluff = warmup ? null : bluffFor(P, pitch, [talk(), talk(), talk(), talk()]);
  if (bluff && pitcherSay(bluff.line, true)) {
    pitch.bluff = bluff;
    state = 'taunt';
    tauntUntil = gt + CFG.PACE.BLUFF;
    return;
  }
  startWindup();
}

/* True when the next hit would beat the player's best. */
const oneAway = () =>
  (run.mode === 'streak' || run.mode === 'daily') && !run.recordShown && run.bestBefore >= 3 && run.streak === run.bestBefore;

function startWindup() {
  state = 'windup';
  wStart = gt;
  cueFlash = false;
  // the pitch is live: clear every word off the field
  clearBubs(true);
  hideSay();
  hideVerdict();
  hud();
  if (!seen.hint || run.mode === 'warmup') showVerdict('TAP AS THE RING CLOSES', 'hint', 1e9);
}

/* 0..1 through the windup, holding at the top for a hesitation. */
function windPhase() {
  const e = gt - wStart,
    wd = pitch.wind,
    h = pitch.hes;
  if (e < 0.45 * wd) return e / wd;
  if (e < 0.45 * wd + h) return 0.45;
  return (e - h) / wd;
}

function release() {
  applyPitcher(pit, pkAt(1, pitch.sidearm));
  pit.g.updateMatrixWorld(true);
  const hand = V(0, 0, 0);
  pit.ha[0].getWorldPosition(hand);
  pitch.rel = hand;
  state = 'flight';
  tRel = gt;
  tA = gt + pitch.T;
  ball.on = true;
  sfx.release();
  batGo([[B1, 220]]);
}

/* Ball position at fraction u of the flight (u > 1 = past the plate). Returns its opacity. */
function ballAt(u, out) {
  const ty = pitch.ty,
    rel = pitch.rel,
    L = Math.abs(rel.z);
  let p;
  if (u <= 1) p = pitch.progress(u);
  else {
    // past the plate: drift through the foul window, then speed into the mitt
    const ms = (u - 1) * pitch.T,
      foulMs = pitch.win[2];
    p = 1 + (ms <= foulMs ? (2.2 * ms) / foulMs : 2.2 + 3.4 * Math.min(1, (ms - foulMs) / 70)) / L;
  }
  const pc = Math.min(p, 1);
  let x = lerp(rel.x, pitch.end.x, p),
    y = lerp(rel.y, pitch.end.y, p) + pitch.arc * Math.sin(PI * pc);
  if (ty.off && p < 1) {
    const o = ty.off(p, pitch.side, pitch.r);
    x += o.x;
    y += o.y;
  }
  out.set(x, Math.max(BALL_R, y), rel.z * (1 - p));
  return pitch.ghost ? ghostAlpha(u, pitch.T) : 1;
}

/* ---------- the tap ---------- */
/* Quietly centres the timing offset on where this player actually taps. Plain pitches only. */
function learnOffset(raw) {
  const plain = ['fast', 'change', 'curve', 'slider'].indexOf(pitch.type) >= 0 && !pitch.ghost && !pitch.hes;
  if (!plain || Math.abs(raw - tapOff) > 170) return;
  offSamples.push(raw);
  if (offSamples.length > 9) offSamples.shift();
  if (offSamples.length < 4) return;
  const median = offSamples.slice().sort((a, b) => a - b)[offSamples.length >> 1];
  tapOff = clamp(tapOff + (median - tapOff) * 0.35, CFG.OFFSET_MIN, CFG.OFFSET_MAX);
  store.set('off', Math.round(tapOff));
}

function swing(timeStamp) {
  if (state !== 'flight' || swung || paused) return;
  swung = true;
  const forced = window.__DEV && typeof window.__forceDelta === 'number' ? window.__forceDelta : null;
  const at = typeof timeStamp === 'number' && timeStamp > 0 ? timeStamp : performance.now(),
    tap = gt + (freeze > 0 ? 0 : clamp(at - lastP, -40, 60)),
    raw = tap - tA;
  if (run.mode === 'warmup') run.warm.push(forced !== null ? forced + tapOff : raw);
  else if (forced === null) learnOffset(raw);
  const delta = forced !== null ? forced : raw - tapOff,
    kind = judgeSwing(delta, pitch.win);
  ribOn = gt;
  ribPts = [];
  if (!seen.hint) {
    seen.hint = 1;
    store.set('seen', JSON.stringify(seen));
  }
  showSwing(delta, kind);
  noteVs(kind === 'miss' ? 'k' : kind === 'foul' ? 'foul' : kind, delta);

  if (kind === 'miss') {
    sfx.whiff();
    ghostM.position.copy(ball.pos);
    ghostT = gt;
    ghostM.visible = ball.a > 0.05;
    batGo([[B2, 80, (t) => t * t], [B3, 50], [B4, 45], [B5, 125], [B5, 330], [B0, 300]]);
    state = 'miss';
    overInfo = { how: delta < 0 ? 'early' : 'late', ms: Math.round(Math.abs(delta)) };
    return;
  }
  // contact: the bat takes LEAD_MS to come through, the ball is steered to the barrel
  const b0 = ball.pos.clone(),
    c = V(0.15 + b0.x * 0.4, clamp(b0.y, 1.7, 4.1), clamp(b0.z, -1.6, 1.2));
  lead = { t0: gt, b0, c, kind, delta };
  const b3 = B3.slice(),
    b4 = B4.slice(),
    shift = clamp(-(c.z + 0.39), -0.8, 0.8);
  b3[9] = invY(c.y + 0.2);
  b4[9] = invY(c.y + 0.5);
  b3[8] += shift;
  b4[8] += shift * 0.5;
  batGo([[b3, CFG.LEAD_MS, (t) => t * t], [b4, 50], [B5, 130], [B5, 330], [B0, 300]]);
  state = 'lead';
}

/* The pitch just thrown goes up on the scoreboard. A lie gets called out there too. */
function announcePitch() {
  const lied = pitch.bluff && !pitch.bluff.honest;
  sbDraw(lied ? 'HE LIED!' : PITCHERS[pIdx].name, pitch.mph + ' MPH', pitch.label);
}

function contact() {
  const L = lead;
  lead = null;
  ball.pos.copy(L.c);
  ball.on = true;
  ball.a = 1;
  announcePitch();
  // the swing that beats your best gets a beat of slow motion
  if (oneAway() && L.kind !== 'foul' && !RM) {
    slowUntil = performance.now() + 520;
    zoom = 1;
    crowd.hush();
  } else if ((L.kind === 'homer' || L.kind === 'grand') && hrTier(run.hrRun) && hrTier(run.hrRun).slow && !RM) {
    // the top home run streak tiers get a beat of slow motion on every ball that leaves
    slowUntil = performance.now() + hrTier(run.hrRun).slow;
    zoom = Math.max(zoom, 0.7);
  }
  if (L.kind === 'grand') startGrand(L);
  else if (L.kind === 'homer') startHomer(L);
  else if (L.kind === 'hit') startHit(L);
  else startFoul(L);
}

/* ---------- pausing ---------- */
/* Works at any moment. A pitch that is still on its way is thrown out, so pausing can never be
   used to study a pitch: he throws a different one when play resumes. */
function pauseNow() {
  if (paused || state === 'menu' || state === 'over') return;
  if (state === 'taunt' || state === 'windup' || state === 'flight') {
    pitchVoided = true;
    pitch = null;
    ball.on = false;
    bt.q = [];
    batGo([[B0, 200]]);
    clearBubs();
    hideVerdict();
    run.idx--;
    state = 'ready';
    nextAt = gt + 900;
    hud();
  }
  openSheet('pause');
}

/* ---------- strikes and extra chances ---------- */
/* Modes with a strike count. The 9th, practice and the warm-up play by their own rules. */
const strikesCount = () => run.mode === 'streak' || run.mode === 'daily' || run.mode === 'challenge';
const STRIKE_WORD = ['STRIKE ONE', 'STRIKE TWO', 'STRIKE THREE'];
/* What to call this strike, counting the one about to be recorded. */
function strikeWord() {
  if (!strikesCount()) return 'STRIKE';
  if (run.revived) return "YOU'RE OUT";
  return STRIKE_WORD[Math.min(run.strikes, CFG.STRIKES - 1)];
}
function takenPitch() {
  overInfo = { how: 'looking' };
  noteVs('k');
  lastSwing = null;
  showVerdict(strikeWord(), 'bad', 900);
  cuePulse('bad');
  batGo([[B0, 300]]);
  state = 'miss';
}

function strikeCall() {
  sfx.pop();
  shake = RM ? 0 : 0.15;
  announcePitch();
  crowd.groan();
  endHrStreak();
  if (strikesCount()) run.strikes++;
  const out = strikesCount() && (run.revived || run.strikes >= CFG.STRIKES);
  pitMood = out ? 'pump' : 'idle';
  moodUntil = gt + 2500;
  if (strikesCount() && !out) say(STRIKE_WORD[run.strikes - 1], run.strikes === CFG.STRIKES - 1 ? 'One more and you are out' : '', 'bad');
  nextAt = gt + (out ? CFG.PACE.AFTER_STRIKE : CFG.PACE.AFTER_STRIKE + 350);
  hud();
}

const chanceModes = () => CFG.CHANCE.MODES.indexOf(run.mode) >= 0;

function afterStrike() {
  if (run.mode === 'ninth') {
    ninthShot(0);
    return nextNinth();
  }
  if (run.mode === 'warmup') return warmupNext();
  if (run.mode === 'practice') return endRun();
  if (run.strikes < CFG.STRIKES && !run.revived) return nextPitchIn(200); // still batting
  // third strike: the one paid chance, in modes that allow it; after it, any strike is the end
  if (run.revived || !chanceModes()) return endRun();
  state = 'chance';
  fillChanceSheet();
  $('chance').hidden = false;
  hud();
}

/* The strike-three sheet: one paid second chance per run. It says what it costs and what you have. */
function fillChanceSheet() {
  const P = PITCHERS[pIdx],
    price = chanceCaps(0),
    short = price - caps,
    label = pitch.label.charAt(0) + pitch.label.slice(1).toLowerCase();
  $('chanceFace').src = faceAvatar(lookOf(P, pIdx));
  $('chancePitcher').textContent = P.name;
  $('chanceHow').textContent = label + ' · ' + pitch.mph + ' mph · ' + (overInfo && overInfo.how === 'looking' ? 'no swing' : overInfo.ms + ' ms ' + overInfo.how);
  $('chanceStreak').textContent = run.streak;
  $('reviveMain').textContent = 'SECOND CHANCE';
  $('reviveSub').textContent = (short > 0 ? 'NEEDS ' : '') + price + (price === 1 ? ' SLICE' : ' SLICES');
  $('reviveBtn').disabled = short > 0;
  $('reviveBtn').classList.toggle('gray', short > 0);
  $('chanceHave').textContent = caps;
  $('chanceNoteT').textContent = (short > 0 ? 'in the jar. Slices come from awards and the Daily. ' : 'in the jar. ') + 'One more strike after this ends the run.';
}

function takeChance() {
  if (state !== 'chance') return;
  const price = chanceCaps(0);
  if (caps < price) return;
  caps -= price;
  store.set('caps', caps);
  run.bought = 1;
  run.revived = true;
  $('chance').hidden = true;
  pitMood = 'idle';
  say('SECOND CHANCE', 'One more strike and you are out', 'perfect');
  music.sting('play');
  crowd.hush();
  run.slowSetup = true; // the first pitch back takes its time, with the heartbeat
  nextPitchIn(1400);
  hud();
}

/* ---------- warm-up (first launch) ---------- */
/* After each warm-up swing: another pitch, or set the tap timing from the swings and start for real. */
function warmupNext() {
  hit = homer = pay = null;
  $('dist').hidden = true;
  ball.on = false;
  camPos.copy(HOME);
  camLook.copy(HLOOK);
  if (run.warm.length < CFG.WARMUP_PITCHES) return nextPitchIn(500);
  // centre the timing on how this player taps: the middle swing, ignoring wild ones
  const usable = run.warm.filter((raw) => Math.abs(raw - CFG.OFFSET_DEFAULT) < 170).sort((a, b) => a - b);
  if (usable.length >= 2) {
    tapOff = clamp(usable[usable.length >> 1], CFG.OFFSET_MIN, CFG.OFFSET_MAX);
    store.set('off', Math.round(tapOff));
  }
  store.set('warm', '1');
  seen.hint = 1;
  store.set('seen', JSON.stringify(seen));
  state = 'ready';
  nextAt = gt + 1e9;
  showBanner('Warm-up done', 'YOU ARE READY', 'One strike ends a run. You get one second chance.');
  later(1700, () => startRun('streak'));
}

/* ---------- Bottom of the 9th bookkeeping ---------- */
function ninthShot(feet) {
  if (run.mode !== 'ninth') return;
  run.shots.push(feet);
  run.feet += feet;
}
/* The line score on the board during the 9th, or null outside it. */
function ninthScore() {
  if (!run || run.mode !== 'ninth' || state === 'menu') return null;
  const N = CFG.NINTH;
  if (run.walkoff) return { vis: N.VIS, home: N.VIS + 1, line: 'WALK-OFF GRAND SLAM', walkoff: true };
  return { vis: N.VIS, home: N.HOME, line: 'BOT 9 · ' + N.OUTS + ' OUT · BASES LOADED' };
}
/* A grand slam in the 9th wins the game: the board flips and the place comes apart. */
function walkOff() {
  if (run.mode !== 'ninth' || run.walkoff) return;
  run.walkoff = true;
  sbDraw('THEY WIN', 'WALK-OFF', 'STORM THE FIELD');
  toast('WALK-OFF', 'Grand slam wins it', '');
  crowd.cheer(1, 6);
  crowd.claps();
  hype = 1;
  later(600, () => fireworks(V(0, 60, -470), 10));
  later(900, () => crowdSay(line('wo', LINES.walkoff)));
  later(2400, () => crowdSay(line('wo', LINES.walkoff)));
}
function nextNinth() {
  if (run.shots.length >= CFG.NINTH_PITCHES) return endRun();
  nextPitchIn(700);
}

/* ---------- knockouts and pitching changes ---------- */
/* Called after a ball in play. Returns true if the pitcher is leaving. */
function pitcherCheck(kind) {
  if (!streakRules()) return false;
  const P = PITCHERS[pIdx];
  if (P.final) {
    mimicProgress(kind);
    return false;
  }
  const leaves = pitcherLeaves(run.tally, kind);
  if (!leaves) return false;
  // the final boss waits for a real streak: until then the last regular pitcher stays in
  if (PITCHERS[pIdx + 1].final && run.streak < CFG.MIMIC_MIN_STREAK) return false;
  if (leaves === 'knockout') startKO();
  else startPull();
  return true;
}

function startKO() {
  const P = PITCHERS[pIdx],
    bonus = knockoutCoins(pIdx);
  state = 'ko';
  koUntil = gt + CFG.PACE.KNOCKOUT;
  pitMood = 'melt';
  run.kos.push(P.name);
  noteVs('ko');
  later(900, liveAwards);
  if (run.mode === 'streak') {
    run.rec.koNames.push(P.name);
    koMap[P.name] = (koMap[P.name] || 0) + 1;
    store.set('ko', JSON.stringify(koMap));
  }
  earnCoins(bonus);
  showBanner('Knocked out', P.name, run.mode === 'streak' ? '+' + bonus + ' coins. Card added to your collection.' : 'Next one up.');
  pitcherSay(P.melt);
  crowdSay(line('ko', LINES.ko), 400);
  music.sting('ko');
  crowd.cheer(0.9, 2.5);
  crowd.claps();
  hype = 1;
  hud();
}

/* Ten hits without a knockout: his manager has seen enough. */
function startPull() {
  state = 'ko';
  koUntil = gt + CFG.PACE.PULLED;
  pitMood = 'dej';
  moodUntil = gt + 3000;
  showBanner('Pitching change', PITCHERS[pIdx].name, 'Pulled after ' + CFG.KO.PULL_HITS + ' hits.');
  crowdSay(line('pull', LINES.pulled), 300);
  music.sting('newPitcher');
  hud();
}

/* Brings in pitcher `next`. The final boss gets his own entrance. */
function changePitcher(next) {
  run.tally = { homers: 0, hits: 0 };
  run.faced = 0;
  if (PITCHERS[next].final && run.mode !== 'ninth') return startCutscene(next);
  startSwap(next);
}

function startSwap(next) {
  state = 'swap';
  swapT0 = gt;
  disposeFig(pitOld);
  pitOld = pit;
  oldP = PITCHERS[pIdx];
  pitMood = 'idle';
  if (pBub) {
    pBub.remove();
    pBub = null;
  }
  const P = PITCHERS[next];
  pIdx = next;
  if (P.final && !streakRules()) run.mimicLevel = MIMIC_LEARNS.length;
  pit = makePitcherFigure(next);
  scene.add(pit.g);
  placePitcher(pit, P, -40);
  pit.g.rotation.y = PI / 2;
  pitCur = PK[0][1].slice();
  showBanner('Now pitching', P.name, P.tag);
  music.sting('newPitcher');
  hud();
  sbDraw('NOW PITCHING', P.name, P.tag);
}

/* The final boss never leaves. Every few hits, or whenever you would have knocked him out, he learns something. */
function mimicProgress(kind) {
  run.mimicHits++;
  const rocked = pitcherLeaves(run.tally, kind) === 'knockout';
  if (rocked) {
    run.tally = { homers: 0, hits: 0 };
    earnCoins(knockoutCoins(pIdx));
  }
  if (!rocked && run.mimicHits % CFG.MIMIC_LEVEL_HITS) return;
  const step = MIMIC_LEARNS[run.mimicLevel];
  if (!step) return;
  run.mimicLevel++;
  if (run.mimicLevel >= MIMIC_LEARNS.length) run.rec.mimicMaxed = true;
  later(300, () => {
    if (pitcherSay(step.say)) nextAt = Math.max(nextAt, gt + CFG.PACE.TALK);
    music.sting('newPitch');
  });
}

/* ---------- coins and records ---------- */
function earnCoins(n) {
  if (!countsForCareer() || !n) return; // practice, warm-up and challenges pay nothing
  run.coins += n;
  coins += n;
  store.set('coins', coins);
  floatGain('coin', n);
}

/* One more for the streak. Passing your own best gets its moment. */
function addStreak() {
  if (run.mode === 'warmup') return;
  run.streak++;
  bumpStreak();
  if (run.streak >= 20 && !run.strikes) run.rec.clean20 = true;
  const counts = run.mode === 'streak' || run.mode === 'daily';
  if (counts && !run.recordShown && run.bestBefore >= 3 && run.streak > run.bestBefore) recordMoment();
}

function recordMoment() {
  run.recordShown = true;
  $('bug').classList.add('gold');
  hype = 1;
  crowd.cheer(1, 3);
  later(500, () => music.sting('record'));
  fireworks(V(0, 60, -470), 5);
  later(200, () => crowdSay(line('rec', LINES.record)));
  recordCall = { main: 'NEW BEST', sub: 'You passed ' + run.bestBefore + ' in a row' };
}

/* ---------- home runs in a row ---------- */
/* Called for every ball put in play. Updates the run record and the home run streak.
   Returns the tier just reached (for a bigger celebration), or null. */
function noteContact(kind, feet) {
  const rec = run.rec;
  rec.hits++;
  if (kind === 'hit') {
    endHrStreak();
    return null;
  }
  rec.homers++;
  if (rec.types.indexOf(pitch.type) < 0) rec.types.push(pitch.type);
  if (pitch.bluff && !pitch.bluff.honest) rec.bluffHomer = true;
  if (kind === 'grand') {
    rec.grands++;
    if (run.lastGrand) rec.backToBack = true;
    if (zoneOf(feet, true).kind === 'city') rec.downtown = true;
    if (run.faced === 1 && !PITCHERS[pIdx].final) rec.firstPitchKO = true;
  }
  run.lastGrand = kind === 'grand';
  if (run.mode === 'warmup') return null;
  const before = hrTier(run.hrRun);
  run.hrRun++;
  rec.bestHrRun = Math.max(rec.bestHrRun, run.hrRun);
  const tier = hrTier(run.hrRun);
  if (tier) showHrTag(run.hrRun, tier, tier !== before);
  return tier !== before ? tier : null;
}
/* A base hit or a strike ends it. A foul does not. */
function endHrStreak() {
  if (hrTier(run.hrRun)) {
    dropHrTag(run.hrRun);
    crowd.ooh();
  }
  run.hrRun = 0;
  run.lastGrand = false;
}

/* ---------- the end ---------- */
function endRun() {
  state = 'over';
  timers = [];
  ball.on = false;
  paused = false;
  hideOverlays(['chance', 'banner', 'dist', 'sheet']);
  clearBubs();
  hideSay();
  hideVerdict();
  hideHrTag();
  vib([40, 60, 40]);
  const P = PITCHERS[pIdx],
    how = overInfo || { how: 'looking' },
    mode = run.mode,
    ninth = mode === 'ninth',
    duel = mode === 'challenge',
    unpaid = mode === 'practice' || duel; // nothing is earned or posted

  // --- personal records
  let head = 'STRUCK OUT',
    record = false;
  if (mode === 'streak' && run.streak > best) {
    record = best > 0;
    best = run.streak;
    store.set('best', best);
    head = 'NEW BEST!';
  }
  if (mode === 'daily') {
    const t = today();
    if (dailyRec.day !== t) dailyRec = { day: t, streak: 0, bomb: 0 };
    if (run.streak > dailyRec.streak) {
      record = dailyRec.streak > 0;
      dailyRec.streak = run.streak;
      head = 'NEW DAILY BEST!';
    }
    dailyRec.bomb = Math.max(dailyRec.bomb || 0, run.bomb);
    store.set('daily', JSON.stringify(dailyRec));
  }
  const bombRecord = !unpaid && run.bomb > bestBomb && bestBomb > 0;
  if (!unpaid && run.bomb > bestBomb) {
    bestBomb = run.bomb;
    store.set('bomb', bestBomb);
  }
  if (mode === 'practice') head = 'PRACTICE OVER';
  if (duel) head = run.streak > run.duel.target ? 'YOU WIN!' : run.streak === run.duel.target ? 'TIED' : 'NOT THIS TIME';
  if (ninth) {
    while (run.shots.length < CFG.NINTH_PITCHES) run.shots.push(0);
    ninthRec = { event: run.event, feet: run.feet, shots: run.shots.slice(), done: true };
    store.set('ninth', JSON.stringify(ninthRec));
    head = 'FINAL';
    music.sting('ko');
  } else if (!record && !(duel && run.streak > run.duel.target)) sfx.out();

  // --- career, Rally Caps, division
  const meta = settleRun(),
    capsEarned = run.gains.reduce((a, g) => a + g.caps, 0);

  // --- the card
  const won = duel && run.streak > run.duel.target;
  $('overHead').textContent = head;
  $('overHead').className = 'rib' + (ninth || won || head.indexOf('NEW') === 0 ? ' gold' : '');
  countUp($('oStreak'), ninth ? run.feet : run.streak, ninth);
  $('oUnit').textContent = ninth ? 'HOME RUN FEET' : mode === 'daily' ? 'IN A ROW TODAY' : 'IN A ROW';
  const fact = (i, label, value) => {
    $('f' + i + 'L').textContent = label;
    $('f' + i).textContent = value;
  };
  if (ninth) run.shots.forEach((s, i) => fact(i + 1, 'Pitch ' + (i + 1), s ? fmt(s) + ' ft' : '0 ft'));
  else {
    fact(1, bombRecord ? 'Record' : 'Longest', run.bomb ? fmt(run.bomb) + ' ft' : 'None');
    fact(2, 'HR streak', run.rec.bestHrRun);
    fact(3, 'KOs', run.kos.length);
  }
  $('earnRow').hidden = unpaid;
  $('oCoins').textContent = '+' + fmt(run.coins);
  $('oCapsBox').hidden = !capsEarned;
  $('oCapsBox').className = 'chip caps claim';
  $('oCaps').textContent = '+' + capsEarned;
  $('oCapsT').textContent = 'CLAIM';
  $('rankMsg').textContent = '';
  $('postMsg').textContent = '';
  // the awards this run unlocked sit behind one chip; tapping it lists them
  const nGains = run.gains.length;
  $('oAwardsBtn').hidden = !nGains;
  $('oAwardsN').textContent = nGains;
  $('oAwardsBtn').setAttribute('aria-expanded', 'false');
  $('gains').hidden = true;
  $('gains').textContent = run.gains.map((g) => g.title).join(' · ');

  run.got = ninth || !pitch ? '' : P.name + ' got you with a ' + pitch.label.toLowerCase() + ' at ' + pitch.mph + ' mph.';
  const swingNote = how.how === 'looking' ? 'No swing' : how.ms + ' ms ' + how.how,
    boughtNote = run.bought ? ' Second chance bought.' : '';
  // one line for the special endings; otherwise the last pitch gets a tile with the pitcher's face
  const causeText = duel
    ? won
      ? 'The code said ' + run.duel.target + '. You hit ' + run.streak + ' on the same pitches.'
      : run.duel.target - run.streak === 0
        ? 'Dead level at ' + run.streak + '. One more would have done it.'
        : run.duel.target - run.streak + ' short of ' + run.duel.target + '. Same pitches every time: try again.'
    : ninth
      ? CFG.TEST_REPLAY
        ? 'Test build: play it again and it posts as a new player.'
        : 'That was your one shot this week. Next showdown in ' + nextEventIn() + '.'
      : record
        ? 'Old best ' + run.bestBefore + '. New best ' + run.streak + '.' + boughtNote
        : '';
  $('cause').hidden = !causeText;
  $('cause').textContent = causeText;
  const showLast = !causeText && !ninth && !!pitch;
  $('lastPitch').hidden = !showLast;
  if (showLast) {
    $('lastFace').src = faceAvatar(lookOf(P, pIdx));
    $('lastWho').textContent = P.name;
    $('lastWhat').textContent = pitch.label.charAt(0) + pitch.label.slice(1).toLowerCase() + ' · ' + pitch.mph + ' mph · ' + swingNote + boughtNote;
  }
  // the timing bar explains a strikeout; it gives way when there is more to show
  const showMeter = !ninth && !record && !nGains && lastSwing && how.how !== 'looking';
  $('oMeter').hidden = !showMeter;
  if (showMeter) {
    oMeter.zones(lastSwing.win);
    oMeter.mark(lastSwing.delta);
  }
  // this week's division, and the nearest unfinished goal
  const league = meta.division;
  $('league').hidden = !league;
  if (league) {
    $('leagueName').textContent = league.name;
    $('leagueNote').textContent = meta.promoted
      ? 'PROMOTED'
      : meta.percentile
        ? 'TOP ' + meta.percentile + '% THIS WEEK'
        : league.next
          ? league.toNext + ' TO ' + league.next.name
          : 'TOP DIVISION';
  }
  $('track').classList.toggle('up', !!meta.promoted);
  const goal = meta.goal;
  $('goal').hidden = !goal;
  if (goal) {
    $('goalText').textContent = 'Next: ' + goal.a.title + ' · ' + goal.have + '/' + goal.need;
    $('goalBar').style.width = Math.round((goal.have / goal.need) * 100) + '%';
  }
  $('track').hidden = !league && !goal;
  renderResultBoard();

  $('againBtn').textContent = duel ? 'TRY AGAIN' : ninth && !CFG.TEST_REPLAY ? 'RANKS' : 'PLAY AGAIN';
  $('shareBtn').hidden = unpaid;
  $('over').hidden = false;
  $('over').scrollTop = 0;
  hud();
  celebrate(record || bombRecord || won || meta.promoted);
  renderBoards();
  if (!unpaid) {
    buildCard();
    postScore();
  }
}
