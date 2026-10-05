/* ============================================================================
   FEEDBACK. Everything the player reads during play: the scorebug, the one word
   under the target after a swing, announcements between pitches, speech bubbles,
   and the celebration on the results card.
   Layout rule: while a pitch is live the ball's path holds only the target and ring.
   ============================================================================ */

function hud() {
  const playing = state !== 'menu' && state !== 'over';
  $('hud').hidden = !playing;
  $('pauseBtn').hidden = state === 'chance';
  $('lobby').hidden = state !== 'menu';

  const P = PITCHERS[pIdx],
    mode = run.mode,
    ninth = mode === 'ninth',
    score = ninth ? fmt(run.feet) : String(run.streak);
  $('hStreak').textContent = score;
  $('hStreak').classList.toggle('long', score.length > 3);
  $('hLbl').textContent = ninth ? 'Feet' : mode === 'practice' ? 'Practice' : mode === 'daily' ? 'Daily' : mode === 'challenge' ? 'Beat ' + run.duel.target : mode === 'warmup' ? 'Swings' : 'Streak';
  $('vs').textContent = ninth ? 'BOTTOM 9' : mode === 'warmup' ? 'WARM-UP' : 'vs ' + P.name;
  if (mode === 'warmup') $('hStreak').textContent = Math.min(run.warm.length, CFG.WARMUP_PITCHES) + '/' + CFG.WARMUP_PITCHES;
  if (!playing) $('bug').classList.remove('gold');

  // dots under the pitcher's name
  const pips = $('pips');
  pips.textContent = '';
  const dot = (filled) => {
    const d = document.createElement('i');
    if (!filled) d.className = 'off';
    pips.append(d);
  };
  if (ninth) for (let i = 0; i < CFG.NINTH_PITCHES; i++) dot(i >= run.shots.length); // pitches left
  else if (mode === 'daily' && !P.final) {
    // pitches faced against him so far, filling up to the pitching change (run.faced resets with the pitcher)
    for (let i = 0; i < CFG.DAILY_PER_PITCHER; i++) dot(i < Math.min(run.faced, CFG.DAILY_PER_PITCHER));
  } else if (streakRules() && P.final) {
    // hits until the final boss learns his next trick
    if (run.mimicLevel < MIMIC_LEARNS.length) for (let i = 0; i < CFG.MIMIC_LEVEL_HITS; i++) dot(i < run.mimicHits % CFG.MIMIC_LEVEL_HITS);
  } else if (streakRules()) for (let i = 0; i < CFG.KO.HOMERS; i++) dot(i < run.tally.homers); // home runs toward a knockout

  // strikes: three to a run (one more after the paid chance); not in the 9th, the warm-up or practice
  const ks = $('ks');
  ks.textContent = '';
  if (strikesCount()) {
    const max = run.revived ? 1 : CFG.STRIKES;
    for (let i = 0; i < max; i++) {
      const d = document.createElement('i');
      const on = i < (run.revived ? 0 : run.strikes);
      d.className = (on ? 'on' : '') + (run.revived ? ' last' : '');
      d.innerHTML = ic('x', 13); // greyed-out X marks that light up red
      ks.append(d);
    }
  }
  // lighting: golden hour in the lobby, later with each pitcher, night for the 9th and the final boss
  const night = ninth || state === 'cut' || P.final;
  moodT = window.__moodLock != null ? window.__moodLock : state === 'menu' ? 0.18 : night ? 1 : pIdx / 7;
}

function bumpStreak() {
  const e = $('hStreak');
  e.classList.remove('bump');
  void e.offsetWidth;
  e.classList.add('bump');
}

/* A short announcement near the top. Only used between pitches. */
let callUntil = 0;
function say(main, sub, cls) {
  const el = $('call');
  callUntil = gt + 1100;
  clearBubs(true);
  el.firstElementChild.textContent = main;
  el.lastElementChild.textContent = sub || '';
  el.className = '';
  void el.offsetWidth;
  el.className = 'show ' + (cls || '');
}
const hideSay = () => ($('call').className = '');

/* ---------- "+12" floating up from the streak counter whenever coins or slices are earned ---------- */
let gainN = 0;
function floatGain(kind, n) {
  if (state === 'menu' || state === 'over' || !n) return;
  const el = document.createElement('div');
  el.className = 'gain ' + kind;
  el.innerHTML = (kind === 'coin' ? '<i class="coin"></i>' : ic('pizza', 16)) + '<b>+' + fmt(n) + '</b>';
  const bug = $('bug').getBoundingClientRect(),
    st = stage.getBoundingClientRect();
  el.style.left = bug.right - st.left - 8 + ((gainN++ % 3) - 1) * 10 + 'px';
  el.style.top = bug.bottom - st.top + 4 + 'px';
  $('gains3d').append(el);
  setTimeout(() => el.remove(), 1300);
}

/* ---------- the announcement bar: achievements and records as they happen ---------- */
const toasts = [];
let toastBusy = 0;
function toast(kicker, title, sub) {
  toasts.push({ kicker, title, sub });
  toastNext();
}
function toastNext() {
  if (toastBusy || !toasts.length) return;
  if (!$('banner').hidden || gt < callUntil) return setTimeout(toastNext, 300); // the game is announcing: wait
  const t = toasts.shift(),
    el = $('toast');
  toastBusy = 1;
  $('toastK').textContent = t.kicker;
  $('toastT').textContent = t.title;
  $('toastS').textContent = t.sub || '';
  el.hidden = false;
  el.className = 'in';
  sfx.pop();
  vib(12);
  setTimeout(() => (el.className = 'out'), 2300);
  setTimeout(() => {
    el.hidden = true;
    el.className = '';
    toastBusy = 0;
    toastNext();
  }, 2600);
}

function flashOn(alpha, ms) {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.opacity = alpha;
  void f.offsetWidth;
  f.style.transition = 'opacity ' + ms + 'ms ease-out';
  f.style.opacity = 0;
}

function showBanner(label, name, tag) {
  clearBubs(true);
  $('banLbl').textContent = label;
  $('banName').textContent = name;
  $('banTag').textContent = tag;
  const b = $('banner');
  b.hidden = false;
  b.classList.remove('in');
  void b.offsetWidth;
  b.classList.add('in');
}

function countUp(el, to, pretty) {
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 650),
      v = Math.round(to * (1 - Math.pow(1 - k, 3)));
    el.textContent = pretty ? fmt(v) : v;
    if (k < 1 && state === 'over') requestAnimationFrame(tick);
    else el.textContent = pretty ? fmt(to) : to;
  };
  tick();
}

/* ---------- feedback at the target ---------- */
/* One short line just under the target circle. cls: good | ok | bad | hint */
let verdictUntil = 0,
  verdictHalf = 40;
function showVerdict(text, cls, ms) {
  const v = $('verdict');
  v.textContent = text;
  v.className = cls || '';
  v.hidden = false;
  verdictUntil = performance.now() + ms;
  verdictHalf = v.offsetWidth / 2 + 8; // measured once: reading it every frame forces a layout every frame
  verdictUpdate();
}
function hideVerdict() {
  $('verdict').hidden = true;
  verdictUntil = 0;
}
/* Keeps the verdict under the target and removes it when its time is up. */
function verdictUpdate() {
  const v = $('verdict');
  if (v.hidden) return;
  if (performance.now() > verdictUntil) return hideVerdict();
  const half = verdictHalf;
  v.style.left = clamp(cuePos.x, half, W - half) + 'px';
  v.style.top = cuePos.y + cuePos.r + 18 + 'px';
}

/* ---------- home run streak tag: hangs under the scorebug from the first tier on ---------- */
function showHrTag(n, tier, fresh) {
  const tag = $('hrTag');
  $('hrN').textContent = n;
  $('hrName').textContent = tier.name;
  tag.style.setProperty('--heat', '#' + tier.trail.toString(16).padStart(6, '0'));
  tag.hidden = false;
  tag.className = '';
  void tag.offsetWidth;
  tag.className = fresh ? 'tier' : 'tick';
  if (batMesh) {
    batMesh.material.emissive.setHex(tier.trail);
    batMesh.material.emissiveIntensity = 0.55;
  }
}
function dropHrTag() {
  const tag = $('hrTag');
  if (tag.hidden) return;
  tag.className = 'drop';
  setTimeout(() => {
    if (tag.className === 'drop') tag.hidden = true;
  }, 450);
  coolBat();
}
function hideHrTag() {
  $('hrTag').hidden = true;
  coolBat();
}
function coolBat() {
  goldLights(false);
  if (!batMesh) return;
  batMesh.material.emissiveIntensity = 1;
  goldBat();
}

const OUTCOME_WORD = { grand: 'GRAND SLAM', homer: 'HOME RUN', hit: 'BASE HIT', foul: 'FOUL', miss: 'STRIKE' };

/* Shows a swing where the player is looking: the ring freezes at the size it had when they
   tapped (outside the circle = early, inside = late) and one line says what happened. */
function showSwing(delta, kind) {
  lastSwing = { delta, kind, win: win().slice() };
  const good = kind === 'grand' || kind === 'homer',
    tone = good ? 'good' : kind === 'hit' ? 'ok' : 'bad',
    side = Math.abs(delta) < 1.5 ? '' : delta > 0 ? ' · LATE' : ' · EARLY';
  // the warm-up says how far off the tap was, so the player can feel the timing
  if (run.mode === 'warmup') showVerdict(Math.abs(delta) < 12 ? 'RIGHT ON TIME' : Math.round(Math.abs(delta)) + ' MS ' + (delta > 0 ? 'LATE' : 'EARLY'), Math.abs(delta) < 40 ? 'good' : 'ok', 1300);
  else showVerdict(OUTCOME_WORD[kind] + (good ? '' : side), tone, 800);
  freezeTapRing(tone);
  cuePulse(tone);
}

/* ---------- the timing meter on the results card ---------- */
function makeMeter(root) {
  root.innerHTML =
    '<span class="lbl">Early</span><div class="bar"><i class="zf"></i><i class="zh"></i><i class="zp"></i><i class="mk" hidden></i></div><span class="lbl">Late</span>';
  const q = (c) => root.querySelector(c);
  let span = 100;
  return {
    zones(w) {
      span = w[2] * 1.6;
      q('.zf').style.width = (w[2] / span) * 100 + '%';
      q('.zh').style.width = (w[1] / span) * 100 + '%';
      q('.zp').style.width = Math.max(4, (w[0] / span) * 100) + '%';
    },
    mark(delta) {
      const m = q('.mk');
      m.hidden = delta === null;
      if (delta !== null) m.style.left = clamp(50 + (delta / span) * 50, 1.5, 98.5) + '%';
    },
  };
}
const oMeter = makeMeter($('oMeter'));

/* ---------- crowd and pitcher talk: only when the ball is dead ---------- */
let pBub = null;
/* Screen position of a world point. Returns a shared object: read it before the next call. */
const SCREEN_PT = { x: 0, y: 0 };
function toScreen(v) {
  const p = TV2.copy(v).project(camera);
  SCREEN_PT.x = (p.x * 0.5 + 0.5) * W;
  SCREEN_PT.y = (-p.y * 0.5 + 0.5) * H;
  return SCREEN_PT;
}
/* Talk is allowed between pitches, after a strike is caught, and during a pitching change,
   and never while the game itself is announcing something (banner or call): one voice at a time. */
const announcing = () => !$('banner').hidden || gt < callUntil;
const talkAllowed = () =>
  !paused && !announcing() && (state === 'ready' || state === 'taunt' || state === 'ko' || state === 'swap' || (state === 'miss' && !ball.on));

function crowdSay(text, delay) {
  if (!talkAllowed()) return false;
  setTimeout(() => {
    if (!talkAllowed() || $('bubs').childElementCount >= 2) return;
    const b = document.createElement('div');
    b.className = 'bub';
    b.textContent = text;
    // seat the bubble in the stands to one side of the scoreboard, never over the pitcher
    const side = Math.random() < 0.5 ? -1 : 1,
      s = toScreen(V(side * rnd(95, 140), rnd(40, 80), -430));
    b.style.left = clamp(s.x, W * 0.3, W * 0.7) + 'px';
    b.style.top = Math.max(132, s.y) + 'px'; // below the scorebug and the home run streak tag
    $('bubs').append(b);
    setTimeout(() => b.remove(), 2400);
  }, delay || 0);
  return true;
}
function pitcherSay(text) {
  if (!text || !talkAllowed()) return false;
  if (pBub) pBub.remove();
  const b = document.createElement('div');
  b.className = 'bub p';
  b.textContent = text;
  $('bubs').append(b);
  pBub = b;
  bubUpdate();
  setTimeout(() => {
    if (pBub === b) pBub = null;
    b.remove();
  }, 2400);
  return true;
}
function bubUpdate() {
  if (!pBub || !pit) return;
  const v = TV;
  pit.head.getWorldPosition(v);
  v.y += 2.0;
  const s = toScreen(v);
  pBub.style.left = clamp(s.x, W * 0.36, W * 0.64) + 'px';
  pBub.style.top = Math.max(150, s.y - 8) + 'px'; // the tail points at him
}
/* Removes every bubble. With `fade` they fade out fast instead of vanishing. */
function clearBubs(fade) {
  const all = Array.from($('bubs').children);
  pBub = null;
  if (!fade) return all.forEach((b) => b.remove());
  all.forEach((b) => {
    b.classList.add('out');
    setTimeout(() => b.remove(), 160);
  });
}

/* ---------- the results card when a record falls ---------- */
const CONFETTI = ['#ffc83d', '#ff5a36', '#52d273', '#49a9ff', '#fff6e0'];
function celebrate(on) {
  const box = $('confetti');
  box.textContent = '';
  $('over').classList.toggle('record', !!on);
  if (!on) return;
  music.sting('record');
  crowd.cheer(1, 4);
  crowd.claps();
  vib([30, 40, 30, 40, 80]);
  if (RM) return;
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = CONFETTI[i % CONFETTI.length];
    p.style.animationDelay = Math.random() * 1.2 + 's';
    p.style.animationDuration = 2.2 + Math.random() * 1.6 + 's';
    p.style.setProperty('--drift', (Math.random() * 2 - 1) * 60 + 'px');
    p.style.setProperty('--spin', (Math.random() * 2 - 1) * 900 + 'deg');
    box.append(p);
  }
}
