/* ============================================================================
   RENDER. Draws one frame: ball, trail, swing ribbon, camera, and the timing cue
   (the target circle and the ring that closes on it).
   ============================================================================ */

/* How the ball is drawn in each kind of flight: [distance at which it starts being enlarged, trail colour, trail life ms, trail size] */
const BALL_LOOK = {
  pitch: { grow: 110, trail: null, life: 110, size: 0.7, alpha: 0.3 },
  hit: { grow: 55, trail: 0xfff6e0, life: 230, size: 1.0, alpha: 0.45 }, // white: a ball in play, nothing more
  foul: { grow: 70, trail: null, life: 110, size: 0.7, alpha: 0.3 },
  homer: { grow: 30, trail: 0xffc83d, life: 520, size: 1.5, alpha: 0.75 },
  grand: { grow: 38, trail: 0xffc83d, life: 900, size: 1.6, alpha: 0.85 },
};
const ballLook = () => BALL_LOOK[state] || BALL_LOOK.pitch;
/* During a home run streak the ball's trail takes the tier's colour. */
const hotTrail = () => (hrTier(run.hrRun) ? hrTier(run.hrRun).trail : null);

function drawBall() {
  if (state === 'windup') {
    // in the pitcher's hand
    pit.g.updateMatrixWorld(true);
    pit.ha[0].getWorldPosition(ball.pos);
    ball.a = 1;
  }
  const show = (ball.on || state === 'windup') && ball.a > 0.02,
    look = ballLook();
  ballM.visible = show;
  blob.visible = false;
  if (show) {
    const size = BALL_R * Math.max(1, ball.pos.distanceTo(camPos) / look.grow);
    ballM.position.copy(ball.pos);
    ballM.scale.setScalar(size);
    ballM.material.opacity = ball.a;
    ballM.rotation.x -= 0.35;
    ballM.rotation.z += 0.11;
    if (ball.pos.y < 60 && state !== 'windup') groundShadow(size * 1.2, 0.34 * ball.a * clamp(1 - ball.pos.y / 60, 0.25, 1));
  } else if (pitch && pitch.ghost && ball.on && (state === 'flight' || state === 'miss')) {
    // a ghost ball still casts its shadow
    groundShadow(BALL_R * 1.3, 0.3);
  }
  return show;
}
function groundShadow(size, opacity) {
  blob.visible = true;
  blob.position.set(ball.pos.x, 0.07, ball.pos.z);
  blob.scale.setScalar(size);
  blob.material.opacity = opacity;
}

function drawTrail(show, now) {
  const look = ballLook(),
    flying = state === 'flight' || state === 'miss' || state === 'homer' || state === 'hit' || (state === 'grand' && pay && !pay.done);
  if (show && flying) {
    const s = trailS[trailN++ % trailS.length],
      tell = look === BALL_LOOK.pitch && pitch && pitch.ty.trail,
      hot = look === BALL_LOOK.homer || look === BALL_LOOK.grand ? hotTrail() : null;
    s.visible = true;
    s.position.copy(ball.pos);
    s.material.color.setHex(hot || look.trail || tell || 0xfff6e0);
    s.userData = { born: now, look, life: tell ? 260 : look.life, alpha: tell ? 0.75 : look.alpha };
  }
  for (const s of trailS) {
    if (!s.visible) continue;
    const d = s.userData,
      k = 1 - (now - d.born) / d.life;
    if (k <= 0) {
      s.visible = false;
      continue;
    }
    const size = d.look.size * Math.max(1, s.position.distanceTo(camPos) / d.look.grow) * k;
    s.scale.set(size, size, 1);
    s.material.opacity = d.alpha * k;
  }
}

function drawRibbon() {
  if (gt - ribOn < 230 && bt.G) {
    const a = bt.G.clone().addScaledVector(bt.B, 1.1),
      b = bt.G.clone().addScaledVector(bt.B, 2.85);
    batter.g.localToWorld(a);
    batter.g.localToWorld(b);
    ribPts.push([a, b]);
    if (ribPts.length > 9) ribPts.shift();
  } else if (ribPts.length && freeze <= 0) ribPts.shift();
  if (ribPts.length < 2) {
    ribbon.visible = false;
    return;
  }
  const arr = ribbon.geometry.attributes.position.array,
    n = ribPts.length;
  for (let i = 0; i < 9; i++) {
    const p = ribPts[Math.min(i, n - 1)];
    arr.set([p[0].x, p[0].y, p[0].z, p[1].x, p[1].y, p[1].z], i * 6);
  }
  ribbon.geometry.attributes.position.needsUpdate = true;
  ribbon.visible = true;
}

/* A hot bat sheds embers for as long as the home run streak lives. */
let emberAt = 0;
const TIER_RGB = {};
const tierRgb = (tier) => TIER_RGB[tier.trail] || (TIER_RGB[tier.trail] = new T.Color(tier.trail).toArray());
function batEmbers(now) {
  const tier = hrTier(run.hrRun);
  if (!tier || !bt.G || paused || now < emberAt || state === 'grand' || state === 'menu' || state === 'over') return;
  emberAt = now + 70;
  const tip = TV.copy(bt.G).addScaledVector(bt.B, rnd(1.2, 2.8));
  batter.g.localToWorld(tip);
  pburst(tip, 1, [tierRgb(tier), C_GOLD], 0.004, -0.00001, 520);
}

function draw() {
  const now = performance.now();
  applyBatter();
  const show = drawBall();
  if (ghostM.visible) {
    // red marker where the ball was when a swing missed
    const k = 1 - (gt - ghostT) / 900;
    if (k <= 0) ghostM.visible = false;
    else ghostM.material.opacity = 0.65 * k;
  }
  drawTrail(show, now);
  flashUpdate(now);
  drawRibbon();
  batEmbers(now);

  // camera: slow push in under pressure, punch on contact
  camera.position.copy(camPos);
  if (shake > 0) {
    const reach = state === 'grand' ? 0.04 * camPos.distanceTo(camLook) + 1 : 1;
    camera.position.add(TV.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake * reach));
  }
  camera.fov = 50 - zoom * 3 - pressCur * 2.5;
  camera.updateProjectionMatrix();
  camera.lookAt(camLook);
  bubUpdate();
  if (window.__skipRender) {
    // tests fast-forward without drawing; the camera still has to be current for screen positions
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  } else renderer.render(scene, camera);
  cueUpdate();
  verdictUpdate();
  if (wantSnap) {
    wantSnap = false;
    try {
      run.snap = glc.toDataURL('image/jpeg', 0.82);
      run.snapD = run.bomb;
    } catch (e) {}
  }
}

/* ---------- timing cue ---------- */
const cueT = $('tgt'),
  cueR = $('ring');

/* The ring starts RING_START times the target's size at release and shrinks in step with the ball's
   remaining distance, so ring-on-circle is the exact moment to tap. */
function cueUpdate() {
  const live = pitch && !paused && (state === 'windup' || state === 'flight' || state === 'lead' || (state === 'miss' && ball.on)),
    showResult = pitch && !paused && gt < cueHold;
  if (!live && !showResult) {
    cueT.hidden = true;
    cueR.hidden = true;
    return;
  }
  const s0 = toScreen(TV.set(pitch.end.x, pitch.end.y, 0)),
    cx = s0.x,
    cy = s0.y,
    edge = toScreen(TV.set(pitch.end.x + 1, pitch.end.y, 0)),
    rt = CFG.TGT_R * Math.abs(edge.x - cx),
    c = cuePos;
  c.x = cx;
  c.y = cy;
  c.r = rt;
  cueT.hidden = false;
  const st = cueT.style;
  st.left = c.x + 'px';
  st.top = c.y + 'px';
  st.width = st.height = rt * 2 + 'px';
  st.opacity = state === 'windup' ? 0.6 : 1;
  if (!live || state === 'windup' || !pitch.rel) {
    cueR.hidden = true;
    return;
  }
  const z = ball.pos.z,
    leadFt = (CFG.CUE_LEAD_MS / pitch.T) * Math.abs(pitch.rel.z), // distance the ball covers in the lead time
    remaining = clamp((-z - leadFt) / Math.abs(pitch.rel.z), 0, 1),
    past = z + leadFt > 0 ? clamp((z + leadFt) / 2.2, 0, 1) : 0,
    r = rt * (1 + (CFG.RING_START - 1) * remaining) * (1 - 0.55 * past);
  cueR.hidden = false;
  cueR.className = past > 0 ? 'late' : '';
  const rs = cueR.style;
  rs.left = c.x + 'px';
  rs.top = c.y + 'px';
  rs.width = rs.height = r * 2 + 'px';
  rs.opacity = ball.a * clamp((1 - remaining) / 0.12, 0, 1) * (1 - past * 0.5);
  if (state === 'flight' && !cueFlash && gt >= tA) {
    cueFlash = true;
    cuePulse('now');
  }
}

/* Leaves a copy of the ring where it was at the tap: bigger than the circle = early, smaller = late. */
const cueTap = $('tap');
function freezeTapRing(tone) {
  if (cueR.hidden) return;
  const s = cueTap.style;
  s.left = cueR.style.left;
  s.top = cueR.style.top;
  s.width = s.height = cueR.style.width;
  cueTap.className = '';
  void cueTap.offsetWidth;
  cueTap.className = 'show ' + tone;
}

/* Colours the target for a moment: now (the on-time flash), good, ok, bad. */
let cueHold = 0;
function cuePulse(kind) {
  cueT.classList.remove('now', 'good', 'ok', 'bad');
  void cueT.offsetWidth;
  cueT.classList.add(kind);
  if (kind !== 'now') cueHold = gt + 260;
}

/* ---------- frame loop ---------- */
/* Adaptive quality. Three levels: 0 = full resolution and shadows, 1 = resolution capped at 1.5,
   2 = resolution 1 and no shadows. The first seconds after boot are ignored (shader compiles and
   the first shadow map make every phone look slow), the step down needs a slow second, and a
   fast ten seconds steps back up, so a phone that only stumbled on load gets its sharpness back. */
const QUALITY = { WARM_MS: 3000, SLOW_MS: 27, FAST_MS: 13, UP_FRAMES: 600, DOWN_FRAMES: 60, COOL_MS: 4000 };
let qBorn = 0,
  qCool = 0,
  qFast = 0;
function setQuality(level) {
  qual = level;
  PRcap = level === 0 ? 2 : level === 1 ? 1.5 : 1;
  const shadows = level < 2;
  key.castShadow = shadows;
  M.shaft.visible = shadows;
  resize();
  qCool = performance.now() + QUALITY.COOL_MS;
  qAcc = qN = qFast = 0;
}
function quality(raw) {
  if (window.__DEV || paused || raw > 250) return;
  const now = performance.now();
  if (!qBorn) qBorn = now;
  if (now - qBorn < QUALITY.WARM_MS || now < qCool) return;
  qAcc += raw;
  qN++;
  qFast = raw < QUALITY.FAST_MS ? qFast + 1 : 0;
  if (qFast >= QUALITY.UP_FRAMES && qual > 0) return setQuality(qual - 1);
  if (qN < QUALITY.DOWN_FRAMES) return;
  const avg = qAcc / qN;
  qAcc = qN = 0;
  if (avg > QUALITY.SLOW_MS && qual < 2) setQuality(qual + 1);
}

/* Performance readout: fps over the last second, the worst frame, where the time goes. */
const PERF = { on: store.get('perf', '0') === '1', frames: 0, t0: 0, worst: 0, upd: 0, drw: 0, last: 0, worstState: '' };
function perfTick(now, updMs, drwMs, rawDt) {
  const P = PERF;
  P.frames++;
  P.upd += updMs;
  P.drw += drwMs;
  if (rawDt > P.worst) {
    P.worst = rawDt;
    P.worstState = state;
  }
  if (now - P.t0 < 1000) return;
  const el = $('perf');
  if (!el.hidden) {
    const info = renderer.info,
      secs = (now - P.t0) / 1000;
    el.textContent =
      'fps ' + (P.frames / secs).toFixed(0) + '  worst ' + P.worst.toFixed(0) + ' ms (' + P.worstState + ')' +
      '\nupdate ' + (P.upd / P.frames).toFixed(1) + ' ms  render ' + (P.drw / P.frames).toFixed(1) + ' ms' +
      '\ncalls ' + info.render.calls + '  tris ' + (info.render.triangles / 1000).toFixed(0) + 'k  tex ' + info.memory.textures + '  geo ' + info.memory.geometries +
      '\npr ' + PR.toFixed(2) + ' of ' + (window.devicePixelRatio || 1) + '  quality ' + qual + '  ' + W + 'x' + H +
      '\nstate ' + state + '  ' + (navigator.hardwareConcurrency || '?') + ' cores';
  }
  P.frames = 0;
  P.upd = P.drw = P.worst = 0;
  P.t0 = now;
}

function frame(now) {
  const raw = now - lastT;
  quality(raw);
  // a slow frame moves the game by at most 100 ms, so a stutter never becomes slow motion
  let rdt = Math.min(100, raw);
  lastT = now;
  lastP = performance.now();
  if (paused) rdt = 0;
  let dt = rdt;
  if (freeze > 0) {
    freeze -= rdt;
    dt = 0;
  }
  if (now < slowUntil) dt *= 0.22; // slow motion on the swing that beats a record
  gt += dt;
  const t1 = performance.now();
  update(dt, rdt);
  audioUpdate(); // even when paused, so sound can settle
  const t2 = performance.now();
  draw();
  if (PERF.on) perfTick(now, t2 - t1, performance.now() - t2, raw);
  requestAnimationFrame(frame);
}
