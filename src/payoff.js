/* ============================================================================
   PAYOFF. What happens once bat meets ball.
     foul   stays alive, nothing counts
     hit    base hit: streak +1, no distance, camera stays home
     homer  home run: lands in the stands, quick celebration, camera stays home
     grand  grand slam: leaves the park and the camera goes with it
   The camera only moves for a grand slam, so every other ball is aimed to stay inside the
   screen: FRAME sets how wide and how high a ball may go. tests/frame.js checks it.
   ============================================================================ */

/* What the home camera can see. Angles in radians either side of centre field. */
const FRAME = {
  HIT_SPREAD: 0.15, // base hits spray this wide
  HOMER_SPREAD: 0.14,
  HOMER_APEX: [10, 27], // feet above the straight line to the seats, shortest to longest home run
};

/* Tuning for the flights. Times in ms. */
const FLY = {
  HOMER_MS: 1000,
  HOMER_HOLD: 330, // celebration after the ball lands
  GRAND_FREEZE: 130, // hit-stop on a grand slam
  GRAND_MS: [2300, 4200], // flight time, shortest to longest
  GRAND_HOLD: 1250, // time on the landing spot
  MOON_HOLD: 1500,
  ARC: 0.7, // grand slam arc: 1 = plain parabola, lower = flatter top and steeper drop
};

/* Grand slam camera: how far behind and above the ball it rides, growing with distance from the plate. */
const CHASE = { BACK: 50, BACK_PER_FT: 0.1, UP: 14, UP_PER_FT: 0.03 };

const tmpA = V(0, 0, 0);

/* Direction the ball leaves in. Early swings pull, late swings push; `spread` is the widest angle in radians. */
function sprayDir(delta, window, spread) {
  const a = clamp(delta / window, -1, 1) * spread + rnd(-0.03, 0.03);
  return V(Math.sin(a), 0, -Math.cos(a));
}

/* Point on an arc from p0 to p2 that rises `apex` above the straight line. */
function arcAt(p0, p2, apex, u, out, shape) {
  out.lerpVectors(p0, p2, u);
  out.y += apex * Math.pow(4 * u * (1 - u), shape || FLY.ARC);
  return out;
}
function bez(p0, p1, p2, u, out) {
  const a = (1 - u) * (1 - u),
    b = 2 * u * (1 - u),
    c = u * u;
  return out.set(p0.x * a + p1.x * b + p2.x * c, p0.y * a + p1.y * b + p2.y * c, p0.z * a + p1.z * b + p2.z * c);
}

/* ---------- batted balls that stay in the park: real gravity, real bounces ---------- */
/* Units are feet and milliseconds. 32 ft/s² is 0.000032 ft/ms², which is why hits take over a
   second: a ball that is easy to follow is a ball that obeys gravity. */
const BAT = {
  G: 0.000032,
  BOUNCE: 0.42, // how much of the vertical speed survives a bounce
  SKID: 0.78, // how much of the forward speed survives a bounce
  ROLL: 0.0007, // rolling drag per ms once the ball stays down
  SHAPES: {
    // launch speed in ft/ms (0.1 = 68 mph), launch angle in degrees, when the play ends (ms, or
    // `after` ms past the first bounce if sooner), and how long the ball keeps rolling for show
    grounder: { v: [0.082, 0.098], deg: [3, 8], ms: 900, after: 0, coda: 1400 },
    liner: { v: [0.115, 0.13], deg: [8, 11], ms: 950, after: 120, coda: 2000 },
    gapper: { v: [0.135, 0.145], deg: [10, 13], ms: 950, after: 120, coda: 2600 },
    chopper: { v: [0.024, 0.03], deg: [55, 70], ms: 950, after: 0, coda: 600 },
    dribbler: { v: [0.045, 0.06], deg: [4, 9], ms: 850, after: 0, coda: 600 },
  },
};
/* A ball still rolling after its play has ended: shown until the next pitch is in the hand. */
let coda = null;
/* Picks the shape of a base hit from how clean the contact was (0 = nearly a foul, 1 = nearly a home run). */
function hitShape(quality) {
  if (quality > 0.72) return 'gapper';
  if (quality > 0.36) return 'liner';
  return 'grounder';
}
function launch(L, shapeName, dir) {
  const S = BAT.SHAPES[shapeName],
    v = rnd(S.v[0], S.v[1]),
    th = rnd(S.deg[0], S.deg[1]) * D;
  coda = null;
  hit = {
    t0: gt,
    shape: shapeName,
    dur: S.ms,
    after: S.after,
    coda: S.coda,
    p: L.c.clone(),
    v: V(dir.x * v * Math.cos(th), v * Math.sin(th), dir.z * v * Math.cos(th)),
    bounces: 0,
    down: false, // rolling
    endAt: Infinity,
  };
  ball.pos.copy(hit.p);
}
/* One step of a batted ball `h`. Returns true when its play is over. */
function flyStep(h, dt) {
  const p = h.p,
    v = h.v;
  if (h.down) {
    const k = Math.max(0, 1 - BAT.ROLL * dt);
    v.x *= k;
    v.z *= k;
  } else v.y -= BAT.G * dt;
  p.x += v.x * dt;
  p.y += v.y * dt;
  p.z += v.z * dt;
  if (p.y <= BALL_R && !h.down) {
    p.y = BALL_R;
    h.bounces++;
    if (h.bounces === 1) {
      pburst(p, 8, [C_DIRT, C_CHALK], 0.014, 0.00005, 320);
      sfx.skip();
      if (h.after > 0 && h.endAt === Infinity) h.endAt = gt + h.after;
    }
    if (h.bounces > 1) sfx.skip();
    v.y = -v.y * BAT.BOUNCE;
    v.x *= BAT.SKID;
    v.z *= BAT.SKID;
    if (v.y < 0.004) {
      h.down = true;
      v.y = 0;
    }
  }
  ball.pos.copy(p);
  ball.a = 1;
  return gt >= h.endAt || gt - h.t0 >= h.dur;
}
/* Lets the last ball roll out between pitches. */
function codaStep(dt) {
  if (!coda) return;
  const left = coda.dur + coda.coda - (gt - coda.t0);
  if (left <= 0 || (state !== 'ready' && state !== 'taunt' && state !== 'intro')) {
    coda = null;
    ball.on = false;
    return;
  }
  ball.on = true;
  flyStep(coda, dt);
  ball.a = clamp(left / 400, 0, 1); // fades out over its last moments instead of vanishing
}
/* The play is over; the ball keeps going for show. */
function letRoll() {
  coda = hit;
  hit = null;
}

/* ---------- foul ---------- */
/* Off the end of the bat: a chopper straight up off the plate, or a dribbler up the line. */
function startFoul(L) {
  const side = L.delta > 0 ? 1 : -1,
    shape = Math.random() < 0.55 ? 'chopper' : 'dribbler',
    a = side * (shape === 'chopper' ? rnd(0.1, 0.3) : rnd(0.12, 0.2));
  launch(L, shape, V(Math.sin(a), 0, -Math.cos(a)));
  ninthShot(0);
  if (run.mode !== 'warmup') endHrStreak(); // a foul resets the home run streak
  sfx.crack(0);
  vib(8);
  crowd.ooh();
  state = 'foul';
}
function tickFoul() {
  if (!flyStep(hit, gtStep)) return;
  letRoll();
  if (run.mode === 'warmup') warmupNext();
  else if (run.mode === 'ninth') nextNinth();
  else nextPitchIn(CFG.PACE.AFTER_FOUL, () => Math.random() < 0.12 && crowdSay(line('foul', LINES.foul)));
}

/* ---------- base hit ---------- */
function startHit(L) {
  addStreak();
  run.tally.hits++;
  noteContact('hit', 0);
  earnCoins(coinsFor('hit', 0));
  ninthShot(0);
  const w = win(),
    quality = 1 - (Math.abs(L.delta) - w[0]) / (w[1] - w[0]), // 1 = almost a home run, 0 = almost a foul
    dir = sprayDir(L.delta, w[1], FRAME.HIT_SPREAD);
  launch(L, hitShape(quality), dir);
  shake = RM ? 0 : 0.14;
  hype = Math.max(hype, 0.45);
  // chalk only: gold is for balls that leave the yard
  pburst(L.c, 12, [C_CHALK, C_CHALK, C_DIRT], 0.018, 0.00006, 300);
  sfx.crack(1);
  crowd.cheer(0.45, 1.4);
  vib(14);
  state = 'hit';
  hud();
}
function tickHit() {
  if (!flyStep(hit, gtStep)) return;
  letRoll();
  afterContact('hit');
}

/* ---------- home run: into the stands, camera stays home ---------- */
function startHomer(L) {
  const w = win(),
    feet = homerFeet(pitch, Math.abs(L.delta), w[0], false, CFG.BAT_MULT),
    zone = zoneOf(feet, false);
  addStreak();
  run.tally.hits++;
  run.tally.homers++;
  run.bomb = Math.max(run.bomb, feet);
  const tier = noteContact('homer', feet);
  earnCoins(coinsFor('homer', feet) * hrCoinMult(run.hrRun));
  ninthShot(feet);

  // a rising line into the seats at the true distance: the stands climb as they go back
  const dir = sprayDir(L.delta, w[0], FRAME.HOMER_SPREAD),
    reach = clamp(feet, 392, 548),
    p2 = dir.clone().multiplyScalar(reach),
    far = clamp((feet - CFG.HOMER_MIN) / (CFG.HOMER_MAX - CFG.HOMER_MIN), 0, 1);
  p2.y = 14 + (reach - 385) * 0.7;
  homer = { t0: gt, feet, zone, p0: L.c.clone(), p2, apex: lerp(FRAME.HOMER_APEX[0], FRAME.HOMER_APEX[1], far), landed: 0 };

  shake = RM ? 0 : 0.35;
  zoom = RM ? 0 : 0.6;
  hype = 1;
  if (!RM) flashOn(0.4, 140);
  pburst(L.c, 28, [C_CHALK, C_GOLD, C_HOT], 0.03, 0.00006, 380);
  sfx.crack(2);
  crowd.cheer(0.8, 2.6);
  vib([16, 30, 30]);
  if (tier) hrCelebrate(tier);
  state = 'homer';
  hud();
}

/* A new home run streak tier: louder, brighter, and the organ steps up a key each time. */
function hrCelebrate(tier) {
  const level = Math.min(3, CFG.HR_STREAK.indexOf(tier));
  hype = 1;
  crowd.cheer(1, 3 + level);
  crowd.claps();
  later(250, () => music.sting('streak', level * 2));
  if (!RM) for (let i = 1; i <= level + 1; i++) later(170 * i, () => flashOn(0.3, 150)); // the lights strobe more with each tier
  if (tier.gold) goldLights(true);
  vib([20, 30, 20, 30, 60]);
}
/* Top tiers turn the stadium lights gold until the streak ends. */
function goldLights(on) {
  if (!M.lamp) return;
  M.lamp.color.setHex(on ? 0xffc83d : 0xfff3d6);
  TOWERS.forEach((t) => t.glow.material.color.setHex(on ? 0xffc83d : 0xfff3d6));
  M.shaft.color.setHex(on ? 0xffd36a : 0xfff1d0);
}
function tickHomer() {
  const t = (gt - homer.t0) / FLY.HOMER_MS;
  if (t < 1) {
    arcAt(homer.p0, homer.p2, homer.apex, 1 - Math.pow(1 - t, 1.25), ball.pos, 1);
    return;
  }
  if (!homer.landed) {
    homer.landed = gt;
    ball.on = false;
    const record = longBallRecord(homer.feet);
    showVerdict((record ? 'RECORD · ' : '') + fmt(homer.feet) + ' FT', 'good', 1100);
    sbDraw(homer.zone.label, fmt(homer.feet) + ' FT', record ? 'YOUR LONGEST EVER' : pitch.mph + ' MPH ' + pitch.label);
    landingFlash(homer.p2);
    const tierNow = hrTier(run.hrRun);
    fireworks(homer.p2, (homer.zone.kind === 'upper' || record ? 6 : 4) + (tierNow && tierNow.fire ? tierNow.fire : 0));
    if (!hrTier(run.hrRun)) music.sting('homer');
    if (homer.feet >= run.snapD) wantSnap = true;
    return;
  }
  if (gt - homer.landed > FLY.HOMER_HOLD) afterContact('homer');
}

/* True the first time this run that a ball beats the player's longest ever. */
function longBallRecord(feet) {
  if (run.mode === 'practice' || run.bombRecordShown || !run.bombBefore || feet <= run.bombBefore) return false;
  run.bombRecordShown = true;
  toast('NEW RECORD', fmt(feet) + ' FT', 'longest ever');
  return true;
}

/* Bursts above the seats, staggered. */
function fireworks(at, count) {
  for (let i = 0; i < count; i++)
    later(i * 120, () => {
      const p = at.clone().add(V(rnd(-110, 110), rnd(50, 130), rnd(-30, 10)));
      pburst(p, 46, [C_GOLD, C_HOT, C_CHALK, C_TEAL], 0.13, 0.00006, 850);
      sfx.firework();
    });
}

/* ---------- grand slam: out of the park, camera follows ---------- */
/* Picks the landing spot for a distance: a car, a building, open ground or the moon. */
function planLanding(feet, dir) {
  const zone = zoneOf(feet, true),
    spot = dir.clone().multiplyScalar(feet);
  let target = null;
  if (zone.kind === 'lights') {
    target = nearestTo(TOWERS, spot);
    spot.set(target.x, 190 + rnd(-4, 4), target.z + 2);
  } else if (zone.kind === 'board') {
    spot.set(clamp(spot.x, -SB_W * 0.42, SB_W * 0.42), SB_POS.y + rnd(-SB_H * 0.35, SB_H * 0.35), SB_POS.z + 2.6);
  } else if (zone.kind === 'cars') {
    target = nearestTo(CARS, spot);
    spot.set(target.x, CAR.ROOF, target.z);
  } else if (zone.kind === 'city') {
    target = nearestTo(BUILDINGS, spot);
    // hit the wall facing the ballpark, somewhere in its upper half
    spot.set(target.x + clamp(spot.x - target.x, -0.3, 0.3) * target.w, target.h * rnd(0.5, 0.8), target.z + target.w / 2 + 0.6);
  } else if (zone.kind === 'beyond') {
    // a back yard: just in front of the nearest house
    target = nearestTo(HOUSES, spot);
    spot.set(target.x + 6, BALL_R, target.z + 34);
  } else if (zone.kind === 'moon') {
    const toward = HOME.clone().sub(MOON_POS).setY(0).normalize();
    spot.copy(MOON_POS).addScaledVector(toward, MOON_R * 0.7);
    spot.y = MOON_POS.y - MOON_R * 0.72;
  } else spot.y = BALL_R;
  return { zone, spot, target };
}
function nearestTo(list, p) {
  let bestItem = list[0],
    bestD = Infinity;
  for (const it of list) {
    const d = (it.x - p.x) * (it.x - p.x) + (it.z - p.z) * (it.z - p.z);
    if (d < bestD) {
      bestD = d;
      bestItem = it;
    }
  }
  return bestItem;
}

function startGrand(L) {
  const w = win(),
    feet = homerFeet(pitch, Math.abs(L.delta), w[0], true, CFG.BAT_MULT),
    plan = planLanding(feet, sprayDir(L.delta, CFG.GRAND_MS, 0.1)),
    far = clamp((feet - 560) / 1300, 0, 1);
  addStreak();
  run.grands++;
  run.tally.hits++;
  run.bomb = Math.max(run.bomb, feet);
  const tier = noteContact('grand', feet);
  earnCoins(coinsFor('grand', feet) * hrCoinMult(run.hrRun));
  ninthShot(feet);
  walkOff();
  if (tier) hrCelebrate(tier);

  const p0 = L.c.clone(),
    moon = plan.zone.kind === 'moon';
  pay = {
    t0: 0,
    feet,
    zone: plan.zone,
    target: plan.target,
    moon,
    p0,
    p2: plan.spot,
    // the moon shot curves up and away; everything else is one tall arc that clears the park
    p1: moon ? V(plan.spot.x * 0.5, plan.spot.y * 0.35, plan.spot.z * 0.25) : null,
    apex: Math.max(plan.zone.kind === 'lights' || plan.zone.kind === 'board' ? 150 : 220, feet * 0.28),
    dur: lerp(FLY.GRAND_MS[0], FLY.GRAND_MS[1], far),
    done: 0,
    snapped: false,
  };
  freeze = RM ? 40 : FLY.GRAND_FREEZE;
  shake = RM ? 0 : 0.5;
  zoom = RM ? 0 : 1;
  hype = 1;
  if (!RM) flashOn(0.75, 160);
  pburst(L.c, 40, [C_CHALK, C_GOLD, C_HOT], 0.03, 0.00006, 420);
  sfx.crack(3);
  crowd.cheer(1, 3.4);
  vib([18, 30, 40]);
  state = 'hitstop';
  hud();
}

function grandPos(u, out) {
  return pay.moon ? bez(pay.p0, pay.p1, pay.p2, u, out) : arcAt(pay.p0, pay.p2, pay.apex, u, out);
}

function tickHitstop() {
  if (freeze > 0) return;
  state = 'grand';
  pay.t0 = gt;
  clearBubs();
  hideVerdict();
  $('dist').hidden = false;
  $('distLbl').textContent = 'GRAND SLAM';
  $('tier').className = '';
  $('tier').textContent = '';
  sfx.whoosh(pay.dur / 1000);
  hud();
}

function tickGrand() {
  const m = (gt - pay.t0) / pay.dur;
  if (m < 1) {
    const u = 1 - Math.pow(1 - clamp(m, 0, 1), 1.7);
    grandPos(u, ball.pos);
    chaseCamera(m, u);
    $('distN').firstChild.nodeValue = fmt(pay.feet * u);
    return;
  }
  if (!pay.done) {
    pay.done = gt;
    ball.pos.copy(pay.p2);
    ball.on = false;
    camLook.copy(pay.p2);
    $('distN').firstChild.nodeValue = fmt(pay.feet);
    $('tier').textContent = (longBallRecord(pay.feet) ? 'RECORD · ' : '') + pay.zone.label;
    $('tier').className = 'on';
    LANDINGS[pay.zone.kind]();
    music.sting('grand');
    return;
  }
  const held = gt - pay.done;
  if (!pay.snapped && held > 220) {
    pay.snapped = true;
    wantSnap = pay.feet >= run.snapD;
  }
  if (held > (pay.moon ? FLY.MOON_HOLD : FLY.GRAND_HOLD)) {
    if (!RM) flashOn(0.9, 260);
    afterContact('grand');
  }
}

/* The camera trails the ball from behind and a little above, easing out from the home view. */
function chaseCamera(m, u) {
  const far = ball.pos.distanceTo(pay.p0);
  if (pay.moon) {
    grandPos(Math.min(1, u + 0.02), tmpA);
    const heading = tmpA.sub(ball.pos).normalize(),
      seat = ball.pos.clone().addScaledVector(heading, -(30 + far * 0.07));
    seat.y += 7 + far * 0.012;
    camPos.lerpVectors(HOME, seat, 0.36 * sstep(m / 0.32));
  } else if (pay.zone.kind === 'lights' || pay.zone.kind === 'board') {
    // stays on the field side, climbs with the ball and ends looking up at the hit from below
    const toHome = TV.set(-pay.p2.x, 0, 20 - pay.p2.z).normalize(),
      seat = tmpA.copy(ball.pos).addScaledVector(toHome, 140);
    seat.y = Math.max(30, ball.pos.y * 0.4);
    camPos.lerpVectors(HOME, seat, sstep(m / 0.55));
  } else {
    const back = V(pay.p2.x - pay.p0.x, 0, pay.p2.z - pay.p0.z).normalize(),
      seat = ball.pos.clone().addScaledVector(back, -(CHASE.BACK + far * CHASE.BACK_PER_FT));
    seat.y += CHASE.UP + far * CHASE.UP_PER_FT;
    // never sit inside the grandstand or a downtown building
    if (Math.hypot(seat.x, seat.z - CZ) < 450) seat.y = Math.max(seat.y, 170);
    if (pay.zone.kind === 'city') seat.y = Math.max(seat.y, 165);
    camPos.lerpVectors(HOME, seat, sstep(m / 0.32));
  }
  camLook.lerpVectors(HLOOK, ball.pos, sstep(m / 0.1));
}

/* What the ball does to whatever it lands on. */
const LANDINGS = {
  lights() {
    towerHit(pay.target);
    sfx.clang();
    shake = RM ? 0 : 0.1;
    pburst(pay.p2, 60, [C_CHALK, C_GOLD, [1, 1, 0.8]], 0.08, 0.00016, 900, 5);
    vib([20, 40, 20]);
  },
  board() {
    boardSmash(pay.p2);
    sfx.glass();
    sfx.buzz();
    shake = RM ? 0 : 0.12;
    pburst(pay.p2, 70, [C_CHALK, C_GOLD, C_TEAL], 0.07, 0.00016, 900, 6);
    vib([20, 30, 60]);
  },
  street() {
    sfx.thud();
    pburst(pay.p2, 30, [C_DIRT, C_CHALK], 0.05, 0.0001, 600);
  },
  cars() {
    carAlarm(pay.target);
    sfx.carHit();
    sfx.carAlarm();
    shake = RM ? 0 : 0.12;
    pburst(pay.p2, 40, [C_CHALK, C_GOLD, C_HOT], 0.06, 0.00012, 700);
    vib([30, 60, 30, 60, 30]);
  },
  city() {
    breakWindow(pay.p2);
    sfx.glass();
    shake = RM ? 0 : 0.12;
    pburst(pay.p2, 70, [C_CHALK, C_TEAL, [0.8, 0.9, 1]], 0.07, 0.00016, 900, 6);
    vib([20, 30, 60]);
  },
  beyond() {
    wakeHouse(pay.target);
    sfx.thud();
    sfx.dogBark();
    pburst(pay.p2, 50, [C_DIRT, C_CHALK], 0.09, 0.0001, 900, 4);
    vib([40, 40]);
  },
  moon() {
    sfx.thud();
    shake = RM ? 0 : 0.04;
    pburst(pay.p2, 90, [C_CHALK, C_GOLD, C_HOT], 0.9, 0.0002, 1100, 40);
    vib([60, 40, 90]);
    moonCrater(pay.p2);
  },
};

/* ---------- back to the pitcher ---------- */
function afterContact(kind) {
  const big = kind === 'homer' || kind === 'grand';
  hit = homer = pay = null;
  $('dist').hidden = true;
  ball.on = !!coda; // a base hit keeps rolling for show
  camPos.copy(HOME); // the look point eases home through the micro-pan, no snap
  if (run.mode === 'warmup') return warmupNext();
  if (run.mode === 'ninth') return nextNinth();
  if (pitcherCheck(kind)) return;

  const P = PITCHERS[pIdx],
    milestone = run.streak > 0 && run.streak % 10 === 0;
  if (kind === 'grand') batGo(EMOTES.sky); // the batter poses as the camera lands back home
  liveAwards();
  if (big) {
    pitMood = 'dej';
    moodUntil = gt + 1500;
  }
  if (milestone) crowd.claps();
  // most pitches follow straight on; now and then someone has something to say
  nextPitchIn(big ? CFG.PACE.AFTER_HOMER : CFG.PACE.AFTER_HIT, () => {
    const roll = Math.random();
    if (kind === 'grand') return crowdSay(line('gs', LINES.grand));
    if (milestone) return crowdSay(line('go', LINES.go));
    if (big && roll < 0.18) return pitcherSay(line('ph' + pIdx, P.hit));
    if (big && roll < 0.33) return crowdSay(line('hr', LINES.homer));
    if (!big && roll < 0.08) return crowdSay(line('hit', LINES.hit));
    if (!big && roll < 0.2) music.riff(); // the organist fills a quiet moment
    return false;
  });
}
