/* ---------- ball, target ring, trail, particles, flashes, swing ribbon ---------- */
let ballM = null,
  blob = null,
  ghostM = null,
  ghostT = -1e9,
  ring = null,
  tgt = null,
  frameM = null,
  trailS = [],
  trailN = 0,
  partGeo = null,
  pNext = 0,
  ribbon = null,
  ribPts = [],
  flashS = [],
  flashN = 0;
const PN = 500,
  pPos = new Float32Array(PN * 3),
  pCol = new Float32Array(PN * 3),
  pVel = new Float32Array(PN * 3),
  pBase = new Float32Array(PN * 3),
  pLife = new Float32Array(PN),
  pAge = new Float32Array(PN),
  pG = new Float32Array(PN);
function buildFx() {
  const bt2 = ctex(256, 128, (g, w, h) => {
    g.fillStyle = '#fffaf0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e5352b';
    g.lineWidth = 7;
    for (const o of [0, w / 2]) {
      g.beginPath();
      for (let x = 0; x <= w / 2; x += 4) {
        const y = h / 2 + Math.sin((x / (w / 2)) * PI * 2) * h * 0.3;
        x ? g.lineTo(o + x, y) : g.moveTo(o + x, y);
      }
      g.stroke();
    }
  });
  ballM = new T.Mesh(
    new T.SphereGeometry(1, 20, 14),
    new T.MeshLambertMaterial({ map: bt2, transparent: true, emissive: 0x6a645a, emissiveMap: bt2 }),
  );
  ballM.castShadow = true;
  ballM.visible = false;
  scene.add(ballM);
  blob = new T.Mesh(
    new T.CircleGeometry(1, 18),
    new T.MeshBasicMaterial({ color: 0x120a20, transparent: true, opacity: 0.34, depthWrite: false }),
  );
  blob.rotation.x = -PI / 2;
  blob.renderOrder = 6;
  blob.visible = false;
  scene.add(blob);
  ghostM = new T.Mesh(
    new T.SphereGeometry(BALL_R, 14, 10),
    new T.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.6, depthTest: false, fog: false }),
  );
  ghostM.renderOrder = 18;
  ghostM.visible = false;
  scene.add(ghostM);
  // strike zone frame, dashed target and the closing ring: the timing cue
  frameM = new T.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.22, fog: false });
  [
    [0, 1.7, 1.56, 0.06],
    [0, 3.8, 1.56, 0.06],
    [-0.75, 2.75, 0.06, 2.1],
    [0.75, 2.75, 0.06, 2.1],
  ].forEach((q) => {
    const m = new T.Mesh(new T.PlaneGeometry(q[2], q[3]), frameM);
    m.position.set(q[0], q[1], 0);
    scene.add(m);
  });
  const tt = ctex(128, 128, (g, w) => {
    g.strokeStyle = '#fff6e0';
    g.lineWidth = 7;
    g.setLineDash([17, 12]);
    g.beginPath();
    g.arc(w / 2, w / 2, 56, 0, PI * 2);
    g.stroke();
  });
  tgt = new T.Sprite(new T.SpriteMaterial({ map: tt, transparent: true, depthTest: false, fog: false }));
  tgt.scale.setScalar(BALL_R * 1.25 * 2 * (128 / 112));
  tgt.renderOrder = 19;
  tgt.visible = false;
  scene.add(tgt);
  ring = new T.Mesh(
    new T.RingGeometry(0.92, 1, 48),
    new T.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, depthTest: false, fog: false, side: T.DoubleSide }),
  );
  ring.renderOrder = 20;
  ring.visible = false;
  scene.add(ring);
  for (let i = 0; i < 44; i++) {
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: glowTex,
        color: 0xffc83d,
        blending: T.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false,
      }),
    );
    s.visible = false;
    scene.add(s);
    trailS.push(s);
  }
  for (let i = 0; i < 56; i++) {
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: glowTex,
        color: 0xffffff,
        blending: T.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false,
      }),
    );
    s.visible = false;
    scene.add(s);
    flashS.push(s);
  }
  for (let i = 0; i < PN; i++) {
    pPos[i * 3 + 1] = -9999;
    pLife[i] = 1;
    pAge[i] = 2;
  }
  partGeo = new T.BufferGeometry();
  partGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
  partGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
  partMat = new T.PointsMaterial({
    size: 5 * PR,
    sizeAttenuation: false,
    vertexColors: true,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const pts = new T.Points(partGeo, partMat);
  pts.frustumCulled = false;
  scene.add(pts);
  const rg = new T.BufferGeometry();
  rg.setAttribute('position', new T.BufferAttribute(new Float32Array(9 * 2 * 3), 3));
  const idx = [];
  for (let i = 0; i < 8; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  rg.setIndex(idx);
  ribbon = new T.Mesh(
    rg,
    new T.MeshBasicMaterial({
      color: 0xfff6e0,
      transparent: true,
      opacity: 0.34,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  ribbon.frustumCulled = false;
  ribbon.visible = false;
  scene.add(ribbon);
}
const C_CHALK = [1, 0.96, 0.88],
  C_GOLD = [1, 0.78, 0.24],
  C_HOT = [1, 0.35, 0.21],
  C_TEAL = [0.37, 0.77, 0.77],
  C_DIRT = [0.62, 0.44, 0.28];
function pburst(pos, n, cols, spd, grav, life, spread) {
  for (let k = 0; k < n; k++) {
    const i = pNext;
    pNext = (pNext + 1) % PN;
    const a = rnd(0, PI * 2),
      e = rnd(-1, 1),
      v = rnd(0.3, 1) * spd,
      c = cols[(Math.random() * cols.length) | 0],
      sp = spread || 0;
    pPos[i * 3] = pos.x + rnd(-sp, sp);
    pPos[i * 3 + 1] = pos.y + rnd(-sp, sp) * 0.4;
    pPos[i * 3 + 2] = pos.z + rnd(-sp, sp);
    const ce = Math.sqrt(1 - e * e);
    pVel[i * 3] = Math.cos(a) * ce * v;
    pVel[i * 3 + 1] = e * v + spd * 0.35;
    pVel[i * 3 + 2] = Math.sin(a) * ce * v;
    pBase[i * 3] = c[0];
    pBase[i * 3 + 1] = c[1];
    pBase[i * 3 + 2] = c[2];
    pLife[i] = life * rnd(0.6, 1);
    pAge[i] = 0;
    pG[i] = grav;
  }
}
/* Moves every live particle. The buffers only go to the GPU on frames that changed something. */
function partUpdate(dt) {
  let touched = false;
  for (let i = 0; i < PN; i++) {
    if (pAge[i] >= pLife[i]) {
      if (pPos[i * 3 + 1] > -9000) {
        pPos[i * 3 + 1] = -9999;
        pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0;
        touched = true;
      }
      continue;
    }
    touched = true;
    pAge[i] += dt;
    const f = Math.max(0, 1 - pAge[i] / pLife[i]);
    pVel[i * 3 + 1] -= pG[i] * dt;
    pPos[i * 3] += pVel[i * 3] * dt;
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    pCol[i * 3] = pBase[i * 3] * f;
    pCol[i * 3 + 1] = pBase[i * 3 + 1] * f;
    pCol[i * 3 + 2] = pBase[i * 3 + 2] * f;
  }
  if (!touched) return;
  partGeo.attributes.position.needsUpdate = true;
  partGeo.attributes.color.needsUpdate = true;
}
/* crowd camera flashes: each one its own size, brightness and length */
function camFlash() {
  const s = flashS[flashN % flashS.length];
  flashN++;
  const a = rnd(-1.2, 1.2),
    up = Math.random() < 0.35,
    r = up ? rnd(340, 400) : rnd(244, 326);
  s.position.set(Math.sin(a) * r, up ? 80 + (r - 336) * 0.75 + 2 : 12 + (r - 236) * 0.617 + 3, CZ - Math.cos(a) * r);
  const big = Math.random();
  s.userData = {
    t: performance.now(),
    life: rnd(50, 170),
    sz: big > 0.9 ? rnd(16, 26) : big > 0.55 ? rnd(7, 13) : rnd(3, 6),
    a: big > 0.9 ? 1 : rnd(0.3, 0.9),
  };
  s.visible = true;
}
/* One bright pop where a home run lands. */
function landingFlash(at) {
  const s = flashS[flashN++ % flashS.length];
  s.position.copy(at);
  s.userData = { t: performance.now(), life: 480, sz: 70, a: 1 };
  s.visible = true;
}
function flashUpdate(now) {
  for (const s of flashS) {
    if (!s.visible) continue;
    const u = s.userData,
      k = (now - u.t) / u.life;
    if (k >= 1) {
      s.visible = false;
      continue;
    }
    const e = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
    s.scale.setScalar(u.sz * (0.6 + 0.4 * e));
    s.material.opacity = u.a * e;
  }
}
