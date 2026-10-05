/* ============================================================================
   CUTSCENE. The final boss walks in: the lights drop, seven lights (one per
   pitcher) spiral to the mound and become one figure. About four seconds; a tap skips it.
   ============================================================================ */

const CUT = {
  DARK: 700, // the park goes dark and the old pitcher leaves
  GATHER: 2000, // the seven lights spiral in
  REVEAL: 1500, // he stands there; name card
  CAM_POS: V(0, 6.5, -24), // where the camera pushes in to
  CAM_LOOK: V(0, 6.2, -54),
  SKIP_AFTER: 500,
};
let cutOrbs = null;

function startCutscene(next) {
  if (!cutOrbs) {
    cutOrbs = PITCHERS.filter((P) => !P.final).map((P) => {
      const s = new T.Sprite(
        new T.SpriteMaterial({ map: glowTex, color: P.jersey, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }),
      );
      s.visible = false;
      scene.add(s);
      return s;
    });
  }
  state = 'cut';
  cut = { t0: gt, revealed: false, skipTo: null };
  // the old pitcher walks off, the new one waits out of sight
  disposeFig(pitOld);
  pitOld = pit;
  oldP = PITCHERS[pIdx];
  pIdx = next;
  if (run.mode !== 'streak') run.mimicLevel = MIMIC_LEARNS.length;
  pit = makePitcherFigure(next);
  placePitcher(pit, PITCHERS[next], 0);
  pit.g.visible = false;
  scene.add(pit.g);
  pitCur = P_PUMP.slice();
  clearBubs();
  hideSay();
  $('banner').hidden = true;
  crowd.hush();
  music.sting('mimic');
  sbDraw('WHO IS THAT?', '? ? ?', '');
  hud();
}

/* A tap during the entrance jumps to the reveal, then to the end. */
function skipCutscene() {
  if (state !== 'cut' || gt - cut.t0 < CUT.SKIP_AFTER) return;
  if (cut.kind === 'ninth') {
    cut.t0 = Math.min(cut.t0, gt - NINTH_CUT.HOLD); // straight to the sweep home
    return;
  }
  const reveal = CUT.DARK + CUT.GATHER;
  cut.t0 = gt - (cut.revealed ? reveal + CUT.REVEAL : reveal);
}

function tickCutscene() {
  const t = gt - cut.t0,
    reveal = CUT.DARK + CUT.GATHER,
    P = PITCHERS[pIdx],
    mound = V(0, MOUND_H + 4.2, -MOUND);

  // old pitcher off
  if (pitOld) {
    const k = t / CUT.DARK;
    placePitcher(pitOld, oldP, sstep(k) * 42);
    pitOld.g.rotation.y = PI / 2;
    applyPitcher(pitOld, walkPose(gt));
    if (k >= 1) {
      disposeFig(pitOld);
      pitOld = null;
    }
  }
  // camera pushes in, then comes home during the reveal
  const push = sstep(t / (CUT.DARK + 600)) * (1 - sstep((t - reveal - 700) / 700));
  camPos.lerpVectors(HOME, CUT.CAM_POS, push);
  camLook.lerpVectors(HLOOK, CUT.CAM_LOOK, push);

  // seven lights spiral into the mound
  const g = clamp((t - CUT.DARK * 0.5) / (CUT.GATHER + CUT.DARK * 0.5), 0, 1);
  cutOrbs.forEach((orb, i) => {
    const angle = (i / cutOrbs.length) * PI * 2 + g * 7,
      radius = 46 * Math.pow(1 - g, 1.4),
      height = lerp(1.5 + (i % 3) * 5, 0, g);
    orb.visible = t < reveal && g > 0;
    orb.position.set(mound.x + Math.cos(angle) * radius, mound.y + height, mound.z + Math.sin(angle) * radius);
    orb.scale.setScalar(5 + 7 * g);
    orb.material.opacity = 0.5 + 0.5 * g;
  });

  if (t >= reveal && !cut.revealed) {
    cut.revealed = true;
    pit.g.visible = true;
    if (!RM) flashOn(0.85, 300);
    shake = RM ? 0 : 0.25;
    pburst(mound, 80, PITCHERS.filter((p) => !p.final).map((p) => new T.Color(p.jersey).toArray()), 0.05, 0.00004, 900);
    sfx.thud();
    crowd.ooh();
    showBanner('Final pitcher', P.name, P.tag);
    sbDraw('FINAL PITCHER', P.name, 'STILL LEARNING');
    vib([30, 40, 80]);
  }
  if (cut.revealed) {
    const pose = P_PUMP.slice();
    pose[9] += Math.sin(gt / 160) * 0.2;
    applyPitcher(pit, pose);
  }
  if (t < reveal + CUT.REVEAL) return;
  // done
  cutOrbs.forEach((o) => (o.visible = false));
  $('banner').hidden = true;
  camPos.copy(HOME);
  camLook.copy(HLOOK);
  cut = null;
  pitCur = PK[0][1].slice();
  nextPitchIn(500);
}

/* ============================================================================
   BOTTOM OF THE 9TH. The opening cut: the board with the score, the crowd on its feet,
   flashes everywhere, then the camera comes home to the plate. A tap skips it.
   Then, before every pitch, the closer makes you wait: stares in, shakes off a sign,
   steps off, goes to the rosin bag, says something. Varying order, varying length.
   ============================================================================ */
const NINTH_CUT = {
  CAM_POS: V(0, 92, -196), // on the scoreboard, far enough back to read the whole line score
  CAM_LOOK: V(0, 84, -452),
  HOLD: 1500, // on the board
  SWEEP: 1700, // back to the plate
};
function startNinthIntro() {
  state = 'cut';
  cut = { t0: gt, kind: 'ninth', banner: false, skipTo: null };
  clearBubs();
  hideSay();
  $('banner').hidden = true;
  camPos.copy(NINTH_CUT.CAM_POS);
  camLook.copy(NINTH_CUT.CAM_LOOK);
  hype = 1;
  crowd.cheer(1, 5);
  crowd.claps();
  music.sting('ninth');
  hud();
}
function tickNinthIntro() {
  const t = gt - cut.t0,
    C = NINTH_CUT;
  hype = Math.max(hype, 0.9); // flashes everywhere
  if (t > 300 && !cut.banner) {
    cut.banner = true;
    showBanner('Game seven · Bottom of the 9th', 'BASES LOADED', 'Two out. Down three. A grand slam wins it.');
    vib([20, 40, 20]);
  }
  const k = sstep((t - C.HOLD) / C.SWEEP);
  camPos.lerpVectors(C.CAM_POS, HOME, k);
  camLook.lerpVectors(C.CAM_LOOK, HLOOK, k);
  applyPitcher(pit, PK[0][1]);
  if (t < C.HOLD + C.SWEEP + 300) return;
  $('banner').hidden = true;
  camPos.copy(HOME);
  camLook.copy(HLOOK);
  cut = null;
  nextPitchIn(400);
}

/* The closer's business before a pitch. Returns true when a sequence was started. */
const DRAMA = {
  stare: { ms: [900, 1600] },
  shake: { ms: [800, 1200] }, // shakes off the sign
  stepoff: { ms: [1500, 2100] }, // steps off the rubber and back
  rosin: { ms: [900, 1300] }, // the rosin bag
  taunt: { ms: [1300, 1700] },
};
const DRAMA_ORDER = ['stare', 'shake', 'stepoff', 'rosin', 'taunt'];
function startDrama() {
  if (run.dramaDone === run.idx) return false; // already made you wait for this pitch
  run.dramaDone = run.idx;
  const N = CFG.NINTH,
    rng = run.rng,
    count = N.DRAMA_STEPS[0] + Math.floor(rng() * (N.DRAMA_STEPS[1] - N.DRAMA_STEPS[0] + 1)),
    steps = [];
  const pool = DRAMA_ORDER.slice();
  for (let i = 0; i < count && pool.length; i++) steps.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  if (steps.indexOf('stare') < 0) steps.unshift('stare');
  run.drama = steps.map((name) => ({ name, ms: lerp(DRAMA[name].ms[0], DRAMA[name].ms[1], rng()) }));
  state = 'taunt';
  tauntUntil = gt; // dramaStep() extends it one step at a time
  crowd.hush();
  if (Math.random() < 0.5) crowdSay(line('ninth', LINES.ninth), 300);
  dramaStep();
  hud();
  return true;
}
/* Advances the closer's routine. Called from the taunt state. */
function dramaStep() {
  if (!run.drama) return;
  const step = run.drama.shift();
  if (!step) {
    run.drama = null;
    pitMood = 'idle';
    return;
  }
  tauntUntil = gt + step.ms;
  pitMood = step.name;
  moodUntil = tauntUntil;
  dramaT0 = gt;
  if (step.name === 'taunt') pitcherSay(line('nt', LINES.ninthTaunt), true);
  if (step.name === 'stepoff') crowd.ooh();
  if (step.name === 'rosin') sfx.pop();
}
