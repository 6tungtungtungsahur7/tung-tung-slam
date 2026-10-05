/* ============================================================================
   UPDATE. One step of the game per frame. Each state has one small function in STEP.
   dt = game time passed (0 during hit-stop and pause), rdt = real time passed.
   ============================================================================ */

const POSE_TMP = new Array(23);
/* states in which the pitcher is following through after letting go */
const AFTER_RELEASE = ['flight', 'miss', 'lead', 'hitstop', 'hit', 'foul', 'homer', 'grand'];

const STEP = {
  ready() {
    if (gt >= nextAt) beginPitch();
  },
  intro() {
    if (gt < introUntil) return;
    $('banner').hidden = true;
    startWindup();
  },
  taunt() {
    if (gt < tauntUntil) return;
    if (run.drama) return dramaStep(); // the 9th: one more bit of business, or the pitch
    startWindup();
  },
  cut: () => (cut && cut.kind === 'ninth' ? tickNinthIntro() : tickCutscene()),
  windup() {
    if (windPhase() >= 1) release();
  },
  flight() {
    stepPitchedBall();
  },
  miss() {
    stepPitchedBall();
    if (!ball.on && gt >= nextAt) afterStrike();
  },
  lead() {
    const k = clamp((gt - lead.t0) / CFG.LEAD_MS, 0, 1);
    ball.pos.lerpVectors(lead.b0, lead.c, k);
    ball.a = 1;
    if (k >= 1) contact();
  },
  hit: () => tickHit(),
  foul: () => tickFoul(),
  homer: () => tickHomer(),
  hitstop: () => tickHitstop(),
  grand: () => tickGrand(),
  ko() {
    if (gt < koUntil) return;
    $('banner').hidden = true;
    changePitcher(pIdx + 1);
  },
  swap() {
    const t = (gt - swapT0) / CFG.PACE.SWAP;
    if (pitOld) {
      // old pitcher walks off toward the dugout
      placePitcher(pitOld, oldP, sstep(t / 0.6) * 42);
      pitOld.g.rotation.y = PI / 2;
      applyPitcher(pitOld, walkPose(gt));
      if (t >= 0.6) {
        disposeFig(pitOld);
        pitOld = null;
      }
    }
    const x = -40 * (1 - sstep((t - 0.25) / 0.7));
    placePitcher(pit, PITCHERS[pIdx], x);
    pit.g.rotation.y = x < -0.5 ? PI / 2 : 0;
    if (t < 1.15) return;
    $('banner').hidden = true;
    nextPitchIn(250);
  },
};

/* The pitched ball on its way in, and the strike when it gets past. */
function stepPitchedBall() {
  if (!ball.on) return;
  ball.a = ballAt((gt - tRel) / pitch.T, ball.pos);
  if (ball.pos.z <= 5.4) return;
  ball.on = false;
  pburst(ball.pos, 8, [C_DIRT, C_CHALK], 0.012, 0.00004, 260);
  if (state === 'flight') takenPitch();
  strikeCall();
  pitcherSay(line('pk' + pIdx, PITCHERS[pIdx].k));
}

function update(dt, rdt) {
  if (paused) return;
  gtStep = dt;
  shake = Math.max(0, shake - rdt / 420);
  zoom = Math.max(0, zoom - rdt / 260);
  hype = Math.max(0, hype - rdt / 2600);
  partUpdate(rdt);
  batUpdate(dt);
  fansUpdate(hype);
  worldUpdate();
  runTimers();
  stepMood(rdt);
  stepPressure(rdt);

  // camera flashes in the crowd: more of them the louder it gets; the 9th never goes quiet
  if (run.mode === 'ninth' && state !== 'menu' && state !== 'over') hype = Math.max(hype, 0.55);
  let n = (0.004 + hype * 0.06) * rdt;
  while (n > 0) {
    if (Math.random() < n) camFlash();
    n -= 1;
  }
  // glide from the lobby camera to the batter's view
  if (gt - camIntro < 900) {
    const k = sstep((gt - camIntro) / 850);
    camPos.lerpVectors(MENU_POS, HOME, k);
    camLook.lerpVectors(MENU_LOOK, HLOOK, k);
  }
  if (STEP[state]) STEP[state]();
  codaStep(dt);
  posePitcher(rdt);
  panUpdate(rdt);
}

/* Camera micro-pan: the home camera tilts a little to keep a ball in play in view, then settles. */
const PAN = { CHASE: { grand: 1, hitstop: 1, cut: 1, menu: 1, over: 1 }, UP: 0.3, SIDE: 0.08, MAX_UP: 9, MAX_SIDE: 4, EASE: 220 };
const pan = V(0, 0, 0);
function panUpdate(rdt) {
  if (PAN.CHASE[state]) {
    pan.set(0, 0, 0); // another camera owns the view; nothing to undo later
    return;
  }
  if (gt - camIntro < 900) return;
  let ux = 0,
    uy = 0;
  if ((hit && (state === 'hit' || state === 'foul')) || coda) {
    uy = clamp((ball.pos.y - 9) * PAN.UP, 0, PAN.MAX_UP);
    ux = clamp(ball.pos.x * PAN.SIDE, -PAN.MAX_SIDE, PAN.MAX_SIDE);
  }
  const k = Math.min(1, rdt / PAN.EASE);
  pan.x += (ux - pan.x) * k;
  pan.y += (uy - pan.y) * k;
  camLook.copy(HLOOK).add(pan);
}

/* Time of day eases toward its target. */
function stepMood(rdt) {
  if (Math.abs(moodT - moodCur) <= 0.002) return;
  moodCur = moodCur < 0 ? moodT : moodCur + (moodT - moodCur) * Math.min(1, rdt / 700);
  applyMood(moodCur);
}

/* Pressure: the vignette tightens and a heartbeat plays when one hit ends a boss or in the 9th. */
function stepPressure(rdt) {
  const tense = state === 'ready' || state === 'taunt' || state === 'windup' || state === 'flight';
  let target = 0;
  if (state !== 'menu' && state !== 'over') {
    if (run.mode === 'ninth' || state === 'cut') target = 1;
    // one home run from a knockout, or one hit from a personal best
    else if (run.revived && tense) target = pitMood === 'stare' ? 1 : 0.6; // one strike from the end
    else if (run.mode === 'streak' && tense && (run.tally.homers === CFG.KO.HOMERS - 1 || (run.bestBefore >= 3 && run.streak === run.bestBefore))) target = 0.6;
  }
  pressCur += (target - pressCur) * Math.min(1, rdt / 500);
  const vig = $('vig');
  vig.style.opacity = clamp(0.3 + 0.4 * Math.max(0, moodCur) + 0.3 * pressCur, 0, 1);
  vig.classList.toggle('beat', pressCur > 0.5 && tense && !RM);
  if (pressCur > 0.5 && tense && gt > heartAt) {
    // the heart speeds up as the pitch gets close: slow while he makes you wait, racing in flight
    const racing = state === 'flight' || state === 'windup';
    heartAt = gt + (racing ? 560 : 850);
    sfx.heart(racing ? 1.3 : 0.9 + 0.4 * pressCur);
  }
}

let pitHeadYaw = 0,
  dramaT0 = 0;
function posePitcher(rdt) {
  if (!pit) return;
  if (pitMood !== 'shake') pitHeadYaw *= 0.8;
  if (pitMood !== 'stepoff' && state !== 'swap' && state !== 'cut' && pit.g.position.x !== 0 && !pitOld) placePitcher(pit, PITCHERS[pIdx], 0);
  if (state === 'cut') return; // the entrance poses him itself
  if (state === 'swap') {
    applyPitcher(pit, pit.g.rotation.y ? walkPose(gt + 400) : PK[0][1]);
    return;
  }
  const P = PITCHERS[pIdx];
  let target,
    snap = false;
  if (state === 'windup') {
    target = pkAt(windPhase(), pitch.sidearm);
    snap = true;
  } else if (pitch && gt - tRel < 900 && AFTER_RELEASE.indexOf(state) >= 0) {
    const f = (gt - tRel) / 300;
    target = lerpA(pitch.sidearm ? sideOf(PK[5][1], SIDE[5]) : PK[5][1], PF, eOut(f), POSE_TMP);
    snap = f < 1;
  } else if (pitMood === 'melt') {
    target = P_MELT.slice();
    target[0] += Math.sin(gt / 45) * 0.06;
  } else if ((pitMood === 'pump' && gt < moodUntil) || state === 'chance' || (state === 'over' && run.mode !== 'ninth')) {
    target = P_PUMP.slice();
    target[9] += Math.sin(gt / 120) * 0.25;
  } else if (pitMood === 'dej' && gt < moodUntil) target = P_DEJ;
  else if (pitMood === 'shake' && gt < moodUntil) {
    // shakes off the sign: idle pose, head going side to side, glove up
    target = PK[0][1].slice();
    target[12] += 0.3;
    pitHeadYaw = Math.sin(gt / 110) * 0.45;
  } else if (pitMood === 'rosin' && gt < moodUntil) {
    // bends to the rosin bag by his back foot and works the ball
    target = PK[0][1].slice();
    target[5] -= 0.5;
    target[6] += 0.2;
    target[8] = -0.2;
    target[9] = 1.4 + Math.abs(Math.sin(gt / 120)) * 0.25;
    target[10] = 0.6;
  } else if (pitMood === 'stepoff' && gt < moodUntil) {
    // off the rubber, a walk to the side and back
    const k = clamp(1 - (moodUntil - gt) / Math.max(1, moodUntil - dramaT0), 0, 1),
      away = Math.sin(k * PI) * 5;
    placePitcher(pit, P, -away);
    target = walkPose(gt);
    target[1] = 3.0;
  } else if (pitMood === 'stare' && gt < moodUntil) {
    // leans in and glares; the glove hand works the ball
    target = PK[0][1].slice();
    target[5] -= 0.12;
    target[6] += 0.35;
    target[9] += Math.sin(gt / 140) * 0.08;
    target[12] += Math.sin(gt / 140 + 1) * 0.08;
  }
  else {
    target = PK[0][1].slice();
    target[1] += Math.sin(gt / 520) * 0.03;
  }
  if (snap) lerpA(target, target, 0, pitCur);
  else lerpA(pitCur, target, Math.min(1, rdt * 0.009), pitCur);
  applyPitcher(pit, pitCur);
}
