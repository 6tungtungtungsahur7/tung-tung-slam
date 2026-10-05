/* ---------- figures: joints solved each frame, chunky limbs laid between them ---------- */
function seg(m, a, b) {
  TV.subVectors(b, a);
  const L = TV.length() || 0.001;
  m.position.copy(a).addScaledVector(TV, 0.5);
  m.quaternion.setFromUnitVectors(YA, TV.multiplyScalar(1 / L));
  m.scale.set(1, L, 1);
}
/* Two-bone IK. Returns a scratch vector (see sv in util.js): use it before the next scrReset. */
function ik(a, c, l1, l2, pole) {
  const d = svc(c).sub(a);
  let L = Math.min(d.length(), l1 + l2 - 0.01);
  if (L < 0.05) L = 0.05;
  d.normalize();
  const aa = (l1 * l1 - l2 * l2 + L * L) / (2 * L),
    h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa));
  const pp = svc(pole).addScaledVector(d, -pole.dot(d));
  if (pp.lengthSq() < 1e-6) pp.set(0, 1, 0);
  pp.normalize();
  return svc(a).addScaledVector(d, aa).addScaledVector(pp, h);
}
function jerseyTex(base, trim, num, name, u) {
  return ctex(256, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = trim;
    g.fillRect(0, 0, w, 10);
    const x = (u == null ? 0.5 : u) * w;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (name) {
      g.font = '700 24px "Barlow Condensed","Arial Narrow",sans-serif';
      g.fillText(name, x, 32);
    }
    if (num != null) {
      g.font = '60px "Bungee","Impact",sans-serif';
      g.fillText(String(num), x, name ? 84 : 70);
    }
    if (num != null && u !== 0.5) {
      g.font = '30px "Bungee","Impact",sans-serif';
      g.fillText(String(num), w * 0.06, 52);
    }
  });
}
/* ============================================================================
   TUNG TUNG TUNG SAHUR, from the character sheet. Proportions measured off the front view:
   the log is 73% of his height and 29% as wide as he is tall; the shirt covers the lower
   40% of the log; eyes sit 31% down from the top, a third of the log wide, with a wide open
   smile under them; stick arms a sixth of the log's width; white shorts, wooden shins,
   navy slip-ons with white soles; a classic tapered bat in a lighter wood.
   He uses the same joints as every other figure so every pose and swing works unchanged.
   ============================================================================ */
const TUNG = { wood: '#c58544', grain: '#8a5225', light: '#dfb27a', dark: '#6b3f1d', navy: '#1e2a4a', cream: '#f5ede0', bat: '#d49a56', bath: '#9a6030', ink: '#1a1a1a' };
/* The log's side: warm wood with fine vertical grain and a few knots; the shirt band at the bottom.
   Wrapped around the torso cylinder; u 0.75 faces the pitcher. */
function tungTex(o) {
  const tex = ctex(1024, 512, (g, w, h) => {
    g.fillStyle = TUNG.wood;
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let x = 4; x < w; x += 11) {
      const dark = x % 22 === 4;
      g.strokeStyle = dark ? 'rgba(120,70,30,.55)' : 'rgba(255,225,180,.25)';
      g.lineWidth = dark ? 2.6 : 1.6;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 5, h * 0.33, x - 5, h * 0.66, x + 2, h);
      g.stroke();
    }
    [[150, 110], [620, 230], [900, 70], [330, 300]].forEach(([x, y]) => {
      g.strokeStyle = 'rgba(110,60,25,.7)';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y, 9, 15, 0.25, 0, 7);
      g.stroke();
      g.fillStyle = 'rgba(110,60,25,.35)';
      g.beginPath();
      g.ellipse(x, y, 4, 7, 0.25, 0, 7);
      g.fill();
    });
    // the shirt: lower 40% of the log, crew collar line, TRIPLE T over the number, facing the pitcher
    const top = h * 0.6,
      cx = w * 0.75;
    g.fillStyle = TUNG.cream;
    g.fillRect(0, top, w, h - top);
    g.fillStyle = TUNG.navy;
    g.fillRect(0, top, w, 7);
    g.fillStyle = TUNG.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 40px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText('TRIPLE T', cx, top + 52);
    g.font = '104px "Bungee","Impact",sans-serif';
    g.fillText(String(o.num == null ? 67 : o.num), cx, top + 132);
  });
  tex.wrapS = T.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
/* The cut face of the log: rings. */
function ringTex() {
  return ctex(256, 256, (g, w) => {
    g.fillStyle = TUNG.light;
    g.fillRect(0, 0, w, w);
    for (let r = 8; r < w / 2; r += 9) {
      g.strokeStyle = r % 18 === 8 ? 'rgba(120,70,30,.45)' : 'rgba(120,70,30,.2)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(w / 2 + 4, w / 2 - 3, r, r * 0.92, 0.2, 0, 7);
      g.stroke();
    }
  });
}
function makeTung(o) {
  const g = new T.Group(),
    M = (c, extra) => new T.MeshLambertMaterial(Object.assign({ color: c }, extra || {})),
    mWood = M(TUNG.wood),
    mCream = M(TUNG.cream),
    mNavy = M(TUNG.navy),
    mSole = M('#ffffff'),
    mLog = M('#ffffff', { map: tungTex(o) });
  g.userData.jersey = mLog;
  g.userData.look = o;
  const add = (geo, m, par) => {
    const me = new T.Mesh(geo, m);
    me.castShadow = true;
    (par || g).add(me);
    return me;
  };
  const cyl = (ra, rb, m, segs) => add(new T.CylinderGeometry(rb, ra, 1, segs || 12), m),
    sph = (r, m, par) => add(new T.SphereGeometry(r, 18, 14), m, par);
  // the log: one tapered cylinder from the hips to the top; the torso is scaled to the hip-to-shoulder length
  // by poseFigure (about 1.8), so a geometry 3.3 tall ending 2.78 above its centre reaches 5 units above the hips
  const log = new T.CylinderGeometry(0.66, 0.84, 3.3, 32, 1);
  log.translate(0, 1.15, 0);
  const f = {
    g,
    torso: add(log, [mLog, M('#ffffff', { map: ringTex() }), M(TUNG.dark)]),
    yoke: add(new T.SphereGeometry(0.1, 4, 4), mWood), // unused by this body: kept so the poses have something to move
    belt: add(new T.CylinderGeometry(0.86, 0.86, 0.26, 24), mNavy),
    pelvis: sph(0.8, mCream),
    neck: add(new T.CylinderGeometry(0.1, 0.1, 1, 4), mWood),
    ua: [cyl(0.17, 0.15, mWood), cyl(0.17, 0.15, mWood)],
    fa: [cyl(0.15, 0.13, mWood), cyl(0.15, 0.13, mWood)],
    th: [cyl(0.34, 0.26, mCream), cyl(0.34, 0.26, mCream)],
    sh: [cyl(0.2, 0.17, mWood), cyl(0.2, 0.17, mWood)],
    sho: [sph(0.23, mCream), sph(0.23, mCream)], // the short sleeves
    el: [sph(0.17, mWood), sph(0.17, mWood)],
    kn: [sph(0.22, mWood), sph(0.22, mWood)],
    ha: [sph(0.27, mWood), sph(0.27, mWood)],
    ft: [new T.Group(), new T.Group()],
    head: new T.Group(),
  };
  f.yoke.visible = false;
  f.neck.visible = false;
  f.pelvis.scale.set(1, 0.72, 0.8);
  f.belt.scale.set(1, 1, 0.8);
  // slip-on shoes: navy upper on a white sole
  f.ft.forEach((grp) => {
    g.add(grp);
    const upper = sph(1, mNavy, grp);
    upper.scale.set(0.34, 0.24, 0.6);
    upper.position.y = 0.05;
    const sole = sph(1, mSole, grp);
    sole.scale.set(0.36, 0.1, 0.63);
    sole.position.y = -0.1;
  });
  g.add(f.head);
  // the face sits on the log, 31% down from the top. It looks along the head's +z, which the
  // poses turn toward the pitcher in play and toward the camera in the lobby.
  const face = new T.Group();
  face.position.set(0, 0.35, 0);
  f.head.add(face);
  const fwd = 0.74;
  for (const sgn of [-1, 1]) {
    const eye = sph(0.36, M('#ffffff'), face);
    eye.scale.set(1, 1.08, 0.5);
    eye.position.set(sgn * 0.42, 0, fwd);
    const pupil = sph(0.2, M(TUNG.ink), face);
    pupil.scale.set(1, 1.1, 0.45);
    pupil.position.set(sgn * 0.42 + sgn * 0.03, -0.02, fwd + 0.19);
    const shine = sph(0.07, M('#ffffff'), face);
    shine.position.set(sgn * 0.42 - 0.07, 0.1, fwd + 0.29);
    const brow = add(new T.BoxGeometry(0.4, 0.055, 0.08), M(TUNG.dark), face);
    brow.position.set(sgn * 0.42, 0.42, fwd + 0.03);
    brow.rotation.z = -sgn * 0.12;
  }
  // the wide open smile: the lower half of a flattened sphere, dark inside, a thin band of teeth along its top edge
  const mouth = add(new T.SphereGeometry(0.5, 28, 14, 0, PI * 2, PI / 2, PI / 2), M('#2a1208'), face);
  mouth.scale.set(1.0, 0.7, 0.26);
  mouth.position.set(0, -0.5, fwd - 0.08);
  const teeth = add(new T.BoxGeometry(0.78, 0.09, 0.08), M('#fff6e0'), face);
  teeth.position.set(0, -0.53, fwd + 0.02);
  return f;
}
/* faces are drawn flat and wrapped on the head: dark oval eyes with one highlight, brows, a small nose, always a mouth */
function faceCanvas(o) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d'),
    cx = 128,
    look = o.look || 'plain',
    hair = o.hair || '#3b2416',
    ey = 142;
  g.fillStyle = o.skin;
  g.fillRect(0, 0, 512, 256);
  if (look === 'mimic') {
    // two faces stitched into one
    g.fillStyle = '#b57f59';
    g.fillRect(cx, 0, 256, 256);
  }
  if (look === 'tung') {
    // a log: bark grain down the face, no hair, no blush
    g.strokeStyle = 'rgba(60,30,10,.35)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let x = 12; x < 512; x += 26) {
      g.beginPath();
      g.moveTo(x, 0);
      g.quadraticCurveTo(x + 8, 128, x - 4, 256);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,220,170,.18)';
    g.lineWidth = 3;
    for (let x = 24; x < 512; x += 26) {
      g.beginPath();
      g.moveTo(x, 0);
      g.quadraticCurveTo(x - 6, 128, x + 5, 256);
      g.stroke();
    }
  }
  if (look !== 'ghost' && look !== 'tung') {
    g.fillStyle = hair;
    const hb = look === 'hair' ? 222 : 176;
    g.fillRect(222, 0, 290, hb);
    g.fillRect(0, 0, 34, hb);
    g.fillRect(0, 0, 512, 86);
    g.beginPath();
    g.ellipse(34, 150, 16, 34, 0, 0, 7);
    g.ellipse(222, 150, 16, 34, 0, 0, 7);
    g.fill();
  }
  if (look !== 'ghost' && look !== 'tung') {
    g.fillStyle = 'rgba(255,105,95,.24)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 54, 172, 15, 0, 7);
      g.fill();
    }
  }
  if (look === 'shades') {
    g.fillStyle = '#0e0a1a';
    g.beginPath();
    g.ellipse(cx - 30, ey, 27, 17, 0, 0, 7);
    g.ellipse(cx + 30, ey, 27, 17, 0, 0, 7);
    g.fill();
    g.fillRect(cx - 12, ey - 6, 24, 8);
    g.fillStyle = 'rgba(255,255,255,.4)';
    g.beginPath();
    g.ellipse(cx - 38, ey - 6, 9, 4, -0.4, 0, 7);
    g.ellipse(cx + 22, ey - 6, 9, 4, -0.4, 0, 7);
    g.fill();
  } else
    for (const s of [-1, 1]) {
      const big = look === 'tung' ? 1.9 : 1; // wide, unblinking
      if (big > 1) {
        g.fillStyle = '#fff6e0';
        g.beginPath();
        g.ellipse(cx + s * 34, ey, 13 * big, 17 * big, 0, 0, 7);
        g.fill();
      }
      g.fillStyle = look === 'ghost' || (look === 'mimic' && s < 0) ? '#39d6e8' : look === 'mimic' ? '#ffc83d' : '#2a1a12';
      g.beginPath();
      g.ellipse(cx + s * (big > 1 ? 34 : 30), ey, 11.5 * (big > 1 ? 1.3 : 1), 16.5 * (big > 1 ? 1.3 : 1), 0, 0, 7);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + s * 30 - 4, ey - 7, 4.4 * (big > 1 ? 1.4 : 1), 0, 7);
      g.fill();
      g.beginPath();
      g.arc(cx + s * 30 + 4, ey + 6, 2, 0, 7);
      g.fill();
    }
  if (look === 'glasses') {
    g.strokeStyle = '#1b1033';
    g.lineWidth = 4;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 30, ey, 22, 0, 7);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - 8, ey);
    g.lineTo(cx + 8, ey);
    g.stroke();
  }
  if (look !== 'shades' && look !== 'tung') {
    g.strokeStyle = look === 'ghost' ? '#8a93a8' : hair;
    g.lineWidth = 6;
    g.lineCap = 'round';
    const t = o.brow || 0;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 17, 113 + t);
      g.lineTo(cx + s * 44, 113 - t);
      g.stroke();
    }
  }
  g.strokeStyle = 'rgba(110,55,30,.38)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, 162, 5, 0.1 * PI, 0.9 * PI);
  g.stroke();
  if (look === 'beard') {
    g.fillStyle = '#21140c';
    g.beginPath();
    g.moveTo(cx - 94, 150);
    g.quadraticCurveTo(cx - 66, 172, cx - 30, 170);
    g.lineTo(cx + 30, 170);
    g.quadraticCurveTo(cx + 66, 172, cx + 94, 150);
    g.lineTo(cx + 94, 256);
    g.lineTo(cx - 94, 256);
    g.closePath();
    g.fill();
  }
  if (look === 'stache') {
    g.fillStyle = '#2b1a10';
    g.beginPath();
    g.ellipse(cx - 14, 176, 19, 7, -0.28, 0, 7);
    g.ellipse(cx + 14, 176, 19, 7, 0.28, 0, 7);
    g.fill();
  }
  if (look === 'mimic') {
    g.strokeStyle = '#1b1033';
    g.lineWidth = 3;
    for (let y = 96; y < 236; y += 13) {
      g.beginPath();
      g.moveTo(cx - 7, y);
      g.lineTo(cx + 7, y + 5);
      g.stroke();
    }
  }
  if (look === 'plain') {
    g.fillStyle = 'rgba(150,80,40,.5)';
    [
      [-46, 160],
      [-56, 166],
      [-40, 168],
      [46, 160],
      [56, 166],
      [40, 168],
    ].forEach((q) => {
      g.beginPath();
      g.arc(cx + q[0], q[1], 1.8, 0, 7);
      g.fill();
    });
  }
  const my = look === 'stache' ? 188 : 182,
    m = o.mouth || 'smile';
  g.strokeStyle = look === 'beard' ? '#d8b59a' : '#7a2e22';
  g.lineWidth = 4.5;
  g.beginPath();
  if (m === 'smile') g.arc(cx, my - 10, 17, 0.2 * PI, 0.8 * PI);
  else if (m === 'flat') {
    g.moveTo(cx - 11, my + 4);
    g.lineTo(cx + 11, my + 4);
  } else if (m === 'smirk') {
    g.moveTo(cx - 12, my + 4);
    g.quadraticCurveTo(cx + 4, my + 8, cx + 16, my - 3);
  } else g.arc(cx, my + 2, 6, 0, 7);
  g.stroke();
  return c;
}
function faceAvatar(o) {
  const f = faceCanvas(o),
    c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.drawImage(f, 128 - 84, 62, 168, 168, 0, 0, 96, 96);
  g.fillStyle = o.cap;
  g.beginPath();
  g.ellipse(48, 6, 56, 30, 0, 0, 7);
  g.fill();
  g.fillRect(8, 30, 80, 7);
  return c.toDataURL('image/png');
}
let farFace = null;
function makeFigure(o) {
  const g = new T.Group(),
    far = !!o.far;
  const M2 = (c) =>
    far
      ? new T.MeshLambertMaterial({ color: c })
      : new T.MeshToonMaterial({ color: c, transparent: !!o.ghost, opacity: o.ghost ? 0.74 : 1 });
  const trim = o.trim || '#1b1033',
    mJ = M2('#ffffff'),
    mJ2 = M2(o.jersey),
    mP = M2(o.pants || '#f2ede0'),
    mS = M2(o.skin),
    mC = M2(o.cap),
    mD = M2('#15102a'),
    mA = M2(o.sleeve || trim),
    mK = M2(o.sock || trim),
    mG = M2(o.gloves || o.skin);
  mJ.map = jerseyTex(o.jersey, trim, o.num, o.name, o.numU);
  g.userData.jersey = mJ;
  g.userData.look = o;
  const add = (geo, m, par) => {
    const me = new T.Mesh(geo, m);
    me.castShadow = !far;
    (par || g).add(me);
    return me;
  };
  const cyl = (ra, rb, m) => add(new T.CylinderGeometry(rb, ra, 1, far ? 8 : 14), m),
    sph = (r, m, par) => add(new T.SphereGeometry(r, far ? 10 : 18, far ? 8 : 14), m, par);
  const tg = new T.CylinderGeometry(0.98, 0.8, 1, 18);
  tg.scale(1, 1, 0.7);
  const f = {
    g,
    torso: add(tg, mJ),
    yoke: sph(1, mJ2),
    belt: add(new T.CylinderGeometry(0.88, 0.88, 0.24, 18), mD),
    pelvis: sph(0.76, mP),
    neck: cyl(0.32, 0.3, mS),
    ua: [cyl(0.3, 0.25, mA), cyl(0.3, 0.25, mA)],
    fa: [cyl(0.23, 0.2, mS), cyl(0.23, 0.2, mS)],
    th: [cyl(0.43, 0.33, mP), cyl(0.43, 0.33, mP)],
    sh: [cyl(0.32, 0.25, mK), cyl(0.32, 0.25, mK)],
    sho: [sph(0.34, mA), sph(0.34, mA)],
    el: [sph(0.26, mA), sph(0.26, mA)],
    kn: [sph(0.33, mP), sph(0.33, mP)],
    ha: [sph(0.31, mG), sph(o.mitt ? 0.48 : 0.31, o.mitt ? M2('#8a5426') : mG)],
    ft: [sph(1, mD), sph(1, mD)],
    head: new T.Group(),
  };
  f.pelvis.scale.set(1, 0.78, 0.76);
  f.belt.scale.set(1, 1, 0.7);
  f.ft[0].scale.set(0.31, 0.23, 0.54);
  f.ft[1].scale.set(0.31, 0.23, 0.54);
  g.add(f.head);
  // big round head with a drawn face
  const R = 1.2;
  let ftx;
  if (far) {
    ftx = farFace || (farFace = new T.CanvasTexture(faceCanvas({ skin: o.skin, look: 'far', mouth: 'flat' })));
  } else ftx = new T.CanvasTexture(faceCanvas(o));
  const hm = far
    ? new T.MeshLambertMaterial({ map: ftx })
    : new T.MeshToonMaterial({ map: ftx, transparent: !!o.ghost, opacity: o.ghost ? 0.8 : 1 });
  add(new T.SphereGeometry(R, far ? 14 : 28, far ? 10 : 20), hm, f.head);
  if (!far)
    for (const s of [-1, 1]) {
      const e = sph(0.27, mS, f.head);
      e.position.set(s * 1.17, -0.14, 0.02);
      e.scale.set(0.5, 1, 0.8);
    }
  const cap = add(new T.SphereGeometry(R + 0.06, 22, 12, 0, PI * 2, 0, PI * 0.455), mC, f.head);
  cap.position.y = 0.06;
  const brim = add(new T.CylinderGeometry(0.82, 0.82, 0.08, 18, 1, false, -PI / 2, PI), mC, f.head);
  brim.position.set(0, 0.3, R * 0.86);
  brim.rotation.x = 0.12;
  if (o.helmet) {
    const b = add(new T.SphereGeometry(R + 0.07, 20, 12, PI, PI, PI * 0.3, PI * 0.36), mC, f.head);
    b.position.y = 0.06;
    for (const s of [-1, 1]) {
      const e = add(new T.SphereGeometry(0.5, 12, 10), mC, f.head);
      e.position.set(s * 1.1, -0.2, 0.05);
      e.scale.set(0.55, 1, 1);
    }
  }
  if (o.look === 'hair' && !far) {
    const h = add(new T.SphereGeometry(1.05, 14, 10), M2(o.hair || '#3b2416'), f.head);
    h.position.set(0, -0.55, -0.5);
    h.scale.set(1.1, 1, 0.75);
  }
  return f;
}
/* poses are authored for a tall figure; legs are squashed here so the body lands near 2.6 heads tall */
const POSE_HIP = [null, null],
  POSE_SH = [null, null],
  POSE_HANDS = [null, null],
  POSE_POLES = [null, null],
  POSE_FEET = [null, null];
const ryv = (y) => (y <= 3 ? y * 0.72 : 2.16 + (y - 3) * 0.95),
  invY = (w) => (w <= 2.16 ? w / 0.72 : 3 + (w - 2.16) / 0.95),
  ry = (v) => {
    const c = svc(v);
    c.y = ryv(c.y);
    return c;
  };
/* Lays the limbs between the joints in q. Runs on scratch vectors: callers scrReset() first. */
const POSE_P = {};
function poseFigure(f, q) {
  const p = POSE_P;
  p.P = ry(q.P);
  p.S = ry(q.S);
  p.RH = ry(q.RH);
  p.LH = ry(q.LH);
  p.RF = ry(q.RF);
  p.LF = ry(q.LF);
  const rH = sv(-Math.cos(q.thH), 0, Math.sin(q.thH)),
    rT = sv(-Math.cos(q.thT), 0, Math.sin(q.thT)),
    fH = sv(Math.sin(q.thH), 0, Math.cos(q.thH));
  const hip = POSE_HIP,
    sh = POSE_SH;
  hip[0] = svc(p.P).addScaledVector(rH, 0.46);
  hip[1] = svc(p.P).addScaledVector(rH, -0.46);
  const sw = f.shoulderW || 0.9;
  sh[0] = svc(p.S).addScaledVector(rT, sw);
  sh[1] = svc(p.S).addScaledVector(rT, -sw);
  const base = svc(p.P);
  base.y += 0.1;
  const up = svc(p.S).sub(base),
    len = up.length();
  up.normalize();
  const x = svc(rT).addScaledVector(up, -rT.dot(up)).normalize(),
    z = sv().crossVectors(x, up);
  M4.makeBasis(x, up, z);
  f.torso.quaternion.setFromRotationMatrix(M4);
  f.torso.position.copy(base).addScaledVector(up, len * 0.5 + 0.02);
  f.torso.scale.set(1, len + 0.1, 1);
  f.yoke.quaternion.copy(f.torso.quaternion);
  f.yoke.position.copy(p.S).addScaledVector(up, 0.05);
  f.yoke.scale.set(1, 0.42, 0.68);
  f.belt.quaternion.copy(f.torso.quaternion);
  f.belt.position.copy(base).addScaledVector(up, 0.12);
  f.pelvis.position.copy(p.P);
  f.pelvis.rotation.y = q.thH;
  const hands = POSE_HANDS,
    poles = POSE_POLES,
    feet = POSE_FEET;
  hands[0] = p.RH;
  hands[1] = p.LH;
  poles[0] = q.polR;
  poles[1] = q.polL;
  feet[0] = p.RF;
  feet[1] = p.LF;
  for (let i = 0; i < 2; i++) {
    const e = ik(sh[i], hands[i], 1.0, 0.95, poles[i]);
    seg(f.ua[i], sh[i], e);
    seg(f.fa[i], e, hands[i]);
    f.sho[i].position.copy(sh[i]);
    f.el[i].position.copy(e);
    f.ha[i].position.copy(hands[i]);
    const ank = svc(feet[i]);
    ank.y += 0.26;
    const pole = svc(fH);
    pole.y += 0.25;
    const k = ik(hip[i], ank, 1.2, 1.15, pole);
    seg(f.th[i], hip[i], k);
    seg(f.sh[i], k, ank);
    f.kn[i].position.copy(k);
    f.ft[i].position.copy(feet[i]).addScaledVector(fH, 0.2);
    f.ft[i].position.y += 0.2;
    f.ft[i].rotation.y = q.thH;
  }
  const nk = svc(p.S).addScaledVector(up, 0.1),
    hd = svc(p.S).addScaledVector(up, 1.4);
  seg(f.neck, nk, hd);
  f.head.position.copy(hd);
  f.head.rotation.y = q.headYaw || 0;
}
const lerpA = (a, b, t, out) => {
  for (let i = 0; i < a.length; i++) out[i] = lerp(a[i], b[i], t);
  return out;
};
/* pitcher pose: P, hipYaw, S rel, shoulderYaw, RH, LH, RF, LF, right elbow pole. Local frame faces the plate (+z). */
const PK = [
  [0, [0, 3.05, 0, 0, 0, 1.75, 0.05, 0, -0.15, 3.9, 0.75, 0.2, 3.9, 0.8, -0.4, 0, 0, 0.4, 0, 0, -0.6, -1, 0]],
  [
    0.22,
    [-0.05, 3.05, 0, -50, 0, 1.75, 0, -55, -0.4, 4.0, 0.6, -0.2, 4.0, 0.7, -0.35, 0, 0, 0.3, 0.5, 0.2, -0.6, -1, 0],
  ],
  [
    0.45,
    [
      -0.1, 3.1, -0.05, -90, 0, 1.75, -0.05, -95, -0.75, 4.1, 0.3, -0.7, 4.15, 0.5, -0.35, 0, 0, -0.7, 1.9, 0.5, -0.6,
      -1, 0,
    ],
  ],
  [
    0.7,
    [0, 2.8, 1.3, -80, 0, 1.72, -0.3, -90, -0.2, 2.75, -0.6, -0.2, 4.5, 3.0, -0.35, 0, 0, 0, 0.5, 3.4, -0.4, -0.6, -1],
  ],
  [
    0.88,
    [
      0.05, 2.55, 2.5, -35, 0, 1.72, 0, -80, -0.65, 5.75, 0.85, 0.35, 3.8, 3.1, -0.35, 0.05, 0.1, 0.2, 0, 4.6, -0.6, 0,
      -1,
    ],
  ],
  [
    1,
    [
      0.15, 2.5, 3.2, 5, 0.25, 1.55, 0.8, 20, -1.0, 5.8, 5.05, 0.7, 3.4, 3.5, -0.3, 0.35, 1.2, 0.2, 0, 4.6, -0.5, 0.3,
      -0.6,
    ],
  ],
];
const PF = [
  0.2, 2.6, 3.6, 35, 0.35, 1.15, 1.35, 60, 1.0, 2.2, 5.1, 0.8, 3.2, 3.4, -1.0, 0, 3.9, 0.2, 0, 4.6, 0, -1, 0.2,
];
const SIDE = { 4: [-1.65, 4.37, 1.03, -1, 0, -0.4], 5: [-2.25, 4.0, 4.6, -1, -0.2, 0.2] };
const P_DEJ = [
  0, 3.0, 0, 0, 0, 1.68, 0.18, 0, -0.95, 3.1, 0.15, 0.95, 3.1, 0.15, -0.45, 0, 0, 0.45, 0, 0, -1, -0.2, -0.6,
];
const P_MELT = [0, 2.5, 0, 0, 0, 1.6, 0.4, 0, -1.0, 5.45, 0.85, 1.0, 5.45, 0.85, -0.55, 0, 0, 0.55, 0, 0, -1, 0.3, 0];
const P_PUMP = [
  0, 3.05, 0, -20, 0, 1.75, 0, -20, -1.15, 6.55, 0.4, 0.6, 3.5, 0.5, -0.4, 0, 0, 0.4, 0, 0, -0.6, -0.3, -0.6,
];
function sideOf(a, s) {
  const c = a.slice();
  c[8] = s[0];
  c[9] = s[1];
  c[10] = s[2];
  c[20] = s[3];
  c[21] = s[4];
  c[22] = s[5];
  return c;
}
const PK_OUT = new Array(23);
function pkAt(ph, side) {
  const out = PK_OUT;
  for (let i = 0; i < PK.length - 1; i++) {
    if (ph <= PK[i + 1][0]) {
      let k = (ph - PK[i][0]) / (PK[i + 1][0] - PK[i][0]);
      k = i === 4 ? k * k : sstep(k);
      let a = PK[i][1],
        b = PK[i + 1][1];
      if (side) {
        if (SIDE[i]) a = sideOf(a, SIDE[i]);
        if (SIDE[i + 1]) b = sideOf(b, SIDE[i + 1]);
      }
      return lerpA(a, b, k, out);
    }
  }
  return side ? sideOf(PK[5][1], SIDE[5]) : PK[5][1].slice();
}
function walkPose(t) {
  const s = Math.sin(t * 0.012),
    c = Math.cos(t * 0.012);
  return [
    0,
    3.0 + Math.abs(c) * 0.08,
    0,
    0,
    0,
    1.74,
    0.12,
    0,
    -0.95,
    2.9,
    0.2 + s * 0.5,
    0.95,
    2.9,
    0.2 - s * 0.5,
    -0.4,
    Math.max(0, s) * 0.5,
    c * 0.7,
    0.4,
    Math.max(0, -s) * 0.5,
    -c * 0.7,
    -0.6,
    -1,
    0,
  ];
}
const POSE_Q = { P: null, thH: 0, S: null, thT: 0, RH: null, LH: null, RF: null, LF: null, polR: null, polL: null, headYaw: 0 };
function applyPitcher(f, a) {
  scrReset();
  const q = POSE_Q;
  q.P = sv(a[0], a[1], a[2]);
  q.thH = a[3] * D;
  q.S = sv(a[0] + a[4], a[1] + a[5], a[2] + a[6]);
  q.thT = a[7] * D;
  q.RH = sv(a[8], a[9], a[10]);
  q.LH = sv(a[11], a[12], a[13]);
  q.RF = sv(a[14], a[15], a[16]);
  q.LF = sv(a[17], a[18], a[19]);
  q.polR = sv(a[20], a[21], a[22]);
  q.polL = sv(0.6, -1, 0.1);
  q.headYaw = f === pit ? pitHeadYaw : 0;
  poseFigure(f, q);
}
/* batter pose: P, hipYaw, S rel, shoulderYaw, hands, bat direction, back foot, front foot. Local frame faces the plate, pitcher is toward +x. */
const B0 = [-0.1, 2.85, 0, 0, 0.05, 1.72, 0.3, -8, -1.05, 4.45, 0.65, -0.3, 0.9, -0.25, -1.05, 0, 0, 1.0, 0, 0];
const B1 = [-0.32, 2.8, 0, -8, 0, 1.72, 0.3, -24, -1.3, 4.5, 0.5, -0.12, 0.85, -0.5, -1.05, 0, 0, 1.05, 0.4, 0.05];
const B2 = [0.1, 2.75, 0.05, 50, 0, 1.7, 0.3, 22, -0.45, 3.8, 1.05, -0.9, 0.25, 0.3, -0.95, 0.1, 0, 1.5, 0, 0.05];
const B3 = [
  0.3, 2.72, 0.05, 82, -0.12, 1.68, 0.32, 72, 0.55, 3.05, 1.25, 0.12, -0.1, 0.98, -0.85, 0.15, 0.05, 1.5, 0, 0.05,
];
const B4 = [
  0.38, 2.75, 0.05, 92, -0.15, 1.7, 0.25, 100, 1.2, 3.35, 0.9, 0.85, 0.05, 0.5, -0.85, 0.15, 0.05, 1.5, 0, 0.05,
];
const B5 = [
  0.4, 2.85, 0, 100, -0.15, 1.74, 0.1, 135, 1.25, 4.7, -0.3, 0.2, 0.45, -0.87, -0.85, 0.15, 0.05, 1.5, 0, 0.05,
];
let batter = null,
  batMesh = null;
/* lobby emote: bat to the sky */
const B_SKY = B0.slice();
B_SKY[8] = -0.5;
B_SKY[9] = 5.7;
B_SKY[10] = 0.5;
B_SKY[11] = 0.05;
B_SKY[12] = 1;
B_SKY[13] = 0.12;
B_SKY[3] = 24;
B_SKY[7] = 18;
const EMOTES = { sky: [[B_SKY, 260, eOut], [B_SKY, 520], [B0, 380]] };
const bt = { cur: B0.slice(), from: B0.slice(), q: [], t: 0, G: null, B: null };
function batGo(list) {
  bt.q = list.slice();
  bt.from = bt.cur.slice();
  bt.t = 0;
}
function batUpdate(dt) {
  if (!bt.q.length) {
    const tg = B0.slice();
    tg[11] += Math.sin(gt / 260) * 0.07;
    tg[13] += Math.cos(gt / 330) * 0.05;
    tg[1] += Math.sin(gt / 500) * 0.03;
    lerpA(bt.cur, tg, Math.min(1, dt * 0.012), bt.cur);
    return;
  }
  const s = bt.q[0];
  bt.t += dt;
  const k = Math.min(1, bt.t / s[1]),
    e = s[2] ? s[2](k) : sstep(k);
  lerpA(bt.from, s[0], e, bt.cur);
  if (k >= 1) {
    bt.q.shift();
    bt.from = bt.cur.slice();
    bt.t = 0;
  }
}
const BAT_G = V(0, 0, 0),
  BAT_B = V(0, 1, 0);
function applyBatter() {
  scrReset();
  const a = bt.cur,
    q = POSE_Q,
    G = BAT_G.set(a[8], a[9], a[10]),
    B = BAT_B.set(a[11], a[12], a[13]).normalize();
  q.P = sv(a[0], a[1], a[2]);
  q.thH = a[3] * D;
  q.S = sv(a[0] + a[4], a[1] + a[5], a[2] + a[6]);
  q.thT = a[7] * D;
  q.LH = G;
  q.RH = svc(G).addScaledVector(B, 0.42);
  q.RF = sv(a[14], a[15], a[16]);
  q.LF = sv(a[17], a[18], a[19]);
  q.polR = sv(-0.5, -1, -0.2);
  q.polL = sv(0.2, -1, 0);
  q.headYaw = state === 'menu' ? 0.72 : PI / 2;
  poseFigure(batter, q);
  batMesh.position.copy(G).addScaledVector(B, -0.3);
  batMesh.quaternion.setFromUnitVectors(YA, B);
  bt.G = G; // owned vectors, safe to read later in the frame
  bt.B = B;
}
let pit = null,
  pitOld = null,
  oldP = null,
  pitCur = PK[0][1].slice(),
  pIdx = 0;
const PNUM = [19, 27, 8, 31, 49, 0, 99, 77];
const FACE = [
  { brow: -3, mouth: 'o' },
  { brow: 3, mouth: 'smirk' },
  { brow: 0, mouth: 'smirk' },
  { brow: 1, mouth: 'flat', hair: '#b9b4ad' },
  { brow: -1, mouth: 'smile', hair: '#5a3418' },
  { brow: 2, mouth: 'flat' },
  { brow: 5, mouth: 'flat', hair: '#21140c' },
  { brow: 4, mouth: 'smirk', hair: '#e9e4d4' },
];
function lookOf(P, i) {
  return Object.assign(
    {
      jersey: P.jersey,
      trim: P.trim,
      skin: P.skin,
      cap: P.cap,
      look: P.look,
      ghost: P.look === 'ghost',
      mitt: true,
      num: PNUM[i],
      numU: 0.5,
    },
    FACE[i],
  );
}
/* Builds pitcher number i. The final boss is stitched together from the other seven:
   one piece of each uniform. */
function makePitcherFigure(i) {
  const P = PITCHERS[i],
    f = makeFigure(lookOf(P, i));
  if (!P.final) return f;
  const paint = (mesh, color) => (mesh.material = new T.MeshToonMaterial({ color }));
  const from = (n) => PITCHERS[n].jersey;
  [f.ua[0], f.sho[0], f.el[0]].forEach((m) => paint(m, from(1))); // Hooks' sleeve
  [f.ua[1], f.sho[1], f.el[1]].forEach((m) => paint(m, from(2))); // Sidewinder's sleeve
  paint(f.sh[0], from(3)); // The Professor's sock
  paint(f.sh[1], from(4)); // Flutter's sock
  [f.th[0], f.kn[0]].forEach((m) => paint(m, from(5))); // one Phantom trouser leg
  paint(f.yoke, from(6)); // The Closer's shoulders; the cap is Rookie's
  return f;
}
/* Frees a figure's GPU memory: geometry, materials and the face and jersey textures drawn for it. */
function disposeFig(f) {
  if (!f) return;
  scene.remove(f.g);
  const mats = new Set();
  f.g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) mats.add(o.material);
  });
  mats.forEach((m) => {
    if (m.map && m.map !== farFace) m.map.dispose();
    m.dispose();
  });
}
function placePitcher(f, P, x) {
  f.g.position.set(x, MOUND_H * Math.max(0, 1 - Math.abs(x) / 9), -MOUND);
  const s = 1.12 * P.size;
  f.g.scale.set(P.lefty ? -s : s, s, s);
}
function setPitcher(i) {
  disposeFig(pit);
  disposeFig(pitOld);
  pitOld = null;
  pIdx = i;
  const P = PITCHERS[i];
  pit = makePitcherFigure(i);
  placePitcher(pit, P, 0);
  pit.g.rotation.y = 0;
  scene.add(pit.g);
  pitCur = PK[0][1].slice();
}
function buildBatter() {
  if (batter) disposeFig(batter);
  // Tung Tung Tung Sahur: a log in a white 67 jersey, and the bat is another log
  batter = makeTung({ look: 'tung', num: 67, name: jerseyName() });
  batter.shoulderW = 1.02; // the arms sit on the outside of the log
  batter.g.scale.setScalar(1.22); // the sheet has him a head and a half taller than a pitcher
  batter.g.position.set(-3.0, 0, 0.4);
  batter.g.rotation.y = PI / 2;
  scene.add(batter.g);
  const pts = [
    [0.09, 0],
    [0.13, 0.03],
    [0.13, 0.09],
    [0.075, 0.14],
    [0.08, 1.0],
    [0.13, 1.7],
    [0.19, 2.3],
    [0.2, 2.75],
    [0.15, 2.9],
    [0, 2.93],
  ].map((p) => new T.Vector2(p[0], p[1]));
  pts.forEach((p) => (p.x *= 1.25)); // a chunkier bat, like the sheet
  batMesh = new T.Mesh(new T.LatheGeometry(pts, 14), new T.MeshPhongMaterial({ color: TUNG.bat, shininess: 18 }));
  batMesh.castShadow = true;
  batter.g.add(batMesh);
  const grip = new T.Mesh(
    new T.CylinderGeometry(0.13, 0.13, 0.75, 10),
    new T.MeshLambertMaterial({ color: TUNG.bath }),
  );
  grip.position.y = 0.5;
  batMesh.add(grip);
  goldBat();
}
/* Redraws the batter's jersey (number and name) without rebuilding him. */
function dressBatter() {
  if (!batter) return buildBatter();
  const m = batter.g.userData.jersey,
    o = batter.g.userData.look;
  o.num = 67;
  o.name = jerseyName();
  if (m.map) m.map.dispose();
  m.map = o.look === 'tung' ? tungTex(o) : jerseyTex(o.jersey, o.trim, o.num, o.name, o.numU);
  m.needsUpdate = true;
}
function goldBat() {
  if (!batMesh) return;
  const gold = !!(uid && holder && holder.id === uid);
  batMesh.material.color.set(gold ? '#ffc83d' : TUNG.bat);
  batMesh.material.emissive.set(gold ? 0x6a4a00 : 0x000000);
  batMesh.material.shininess = gold ? 120 : 30;
}
function buildActors() {
  buildBatter();
  const field = {
      jersey: '#8a93a8',
      trim: '#1b1033',
      pants: '#8a93a8',
      skin: '#d9a57c',
      cap: '#1b1033',
      far: true,
      mitt: true,
    },
    ready = [0, 2.7, 0, 0, 0, 1.6, 0.4, 0, -0.6, 2.4, 0.95, 0.6, 2.4, 0.95, -0.7, 0, 0, 0.7, 0, 0, -0.6, -1, 0];
  [
    [58, -70],
    [22, -116],
    [-22, -116],
    [-58, -70],
    [-150, -235],
    [0, -290],
    [150, -235],
  ].forEach((p) => {
    const f = makeFigure(field);
    f.g.position.set(p[0], 0, p[1]);
    f.g.rotation.y = Math.atan2(-p[0], -p[1]);
    f.g.scale.setScalar(1.1);
    applyPitcher(f, ready);
    scene.add(f.g);
  });
  setPitcher(0);
}
