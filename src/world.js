/* ---------- three setup ---------- */
const glc = $('gl');
let renderer;
try {
  // no multisampling on dense screens: at 2x the toon edges are clean without it and the fill cost halves
  renderer = new T.WebGLRenderer({ canvas: glc, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
} catch (e) {
  $('noGL').hidden = false;
  throw e;
}
renderer.shadowMap.enabled = true;
/* Phones get the cheaper shadow filter and a smaller map: at phone sizes the difference is invisible, the frame time is not. */
const PHONE = window.matchMedia && matchMedia('(pointer:coarse)').matches;
renderer.shadowMap.type = PHONE ? T.PCFShadowMap : T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.fog = new T.FogExp2(0xffb27c, 0.0011);
const camera = new T.PerspectiveCamera(50, 1, 1, 40000);
/* camera sits low on the line from the mound through the plate, so the pitcher stands right above the zone */
const HOME = V(0, 5, 20),
  HLOOK = V(-0.9, 6.1, -30),
  MENU_POS = V(8.1, 3.6, -12.4),
  MENU_LOOK = V(-2.6, 3.3, 0.3);
let camPos = HOME.clone(),
  camLook = HLOOK.clone(),
  W = 390,
  H = 844,
  PR = 1,
  partMat = null,
  starMat = null;
let PRcap = 2,
  qual = 0,
  qAcc = 0,
  qN = 0;
function resize() {
  const r = stage.getBoundingClientRect();
  W = Math.max(260, r.width);
  H = Math.max(380, r.height);
  PR = Math.min(PRcap, window.devicePixelRatio || 1);
  renderer.setPixelRatio(PR);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  if (partMat) partMat.size = 5 * PR;
  if (starMat) starMat.size = 2 * PR;
}
const hemi = new T.HemisphereLight(0xffe8d2, 0x3f6f4c, 0.72);
scene.add(hemi);
const key = new T.DirectionalLight(0xffdfb8, 0.62);
key.position.set(-70, 55, 35);
key.target.position.set(0, 0, -25);
scene.add(key, key.target);
key.castShadow = true;
{
  const sc = key.shadow.camera;
  sc.left = -50;
  sc.right = 50;
  sc.top = 52;
  sc.bottom = -52;
  sc.near = 10;
  sc.far = 320;
  key.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048);
  key.shadow.bias = -0.0006;
}
const rim = new T.DirectionalLight(0xffc890, 0.3);
rim.position.set(60, 50, -140);
rim.target.position.set(0, 3, -10);
scene.add(rim, rim.target);
function ctex(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  return new T.CanvasTexture(c);
}
const glowTex = ctex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, w);
});
const MOON_POS = V(1500, 8800, -6400),
  MOON_R = 900,
  CZ = -150,
  WR = 230;
let sbCtx = null,
  sbTex = null,
  moonGroup = null;
const M = {}; // mood-driven materials and objects

function buildWorld() {
  const flat = (geo, color, order) => {
    const m = new T.Mesh(
      geo,
      new T.MeshLambertMaterial({
        color,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -order,
        polygonOffsetUnits: -order,
      }),
    );
    m.rotation.x = -PI / 2;
    m.renderOrder = order;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  let seed = 5;
  const R = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const grad = (stops) =>
    ctex(8, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      stops.forEach((s) => gr.addColorStop(s[0], s[1]));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  // two skies: golden hour underneath, night fading in on top
  scene.add(
    new T.Mesh(
      new T.SphereGeometry(14000, 32, 20),
      new T.MeshBasicMaterial({
        map: grad([
          [0, '#04030c'],
          [0.2, '#120f3d'],
          [0.32, '#2e2370'],
          [0.41, '#7a3e9e'],
          [0.46, '#d65d8e'],
          [0.485, '#ff8a6e'],
          [0.5, '#ffb680'],
          [1, '#ffb680'],
        ]),
        side: T.BackSide,
        fog: false,
        depthWrite: false,
      }),
    ),
  );
  M.night = new T.MeshBasicMaterial({
    map: grad([
      [0, '#010108'],
      [0.3, '#05061a'],
      [0.42, '#0d0c2c'],
      [0.48, '#241b52'],
      [0.5, '#3a2a66'],
      [1, '#3a2a66'],
    ]),
    side: T.BackSide,
    fog: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const nd = new T.Mesh(new T.SphereGeometry(13800, 32, 20), M.night);
  nd.renderOrder = -5;
  scene.add(nd);
  M.sun = new T.SpriteMaterial({
    map: glowTex,
    color: 0xffe6aa,
    blending: T.AdditiveBlending,
    fog: false,
    depthWrite: false,
    transparent: true,
  });
  const sunG = new T.Sprite(M.sun);
  sunG.position.set(-3200, 300, -11000);
  sunG.scale.set(7000, 4200, 1);
  scene.add(sunG);
  {
    const n = 900,
      pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const e = (14 + 76 * Math.sqrt(R())) * D,
        a = R() * PI * 2,
        RR = 12500;
      pos[i * 3] = RR * Math.cos(e) * Math.sin(a);
      pos[i * 3 + 1] = RR * Math.sin(e);
      pos[i * 3 + 2] = RR * Math.cos(e) * Math.cos(a);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    starMat = new T.PointsMaterial({
      color: 0xfff6e0,
      size: 2,
      sizeAttenuation: false,
      fog: false,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    scene.add(new T.Points(g, starMat));
  }
  moonGroup = new T.Group();
  moonGroup.position.copy(MOON_POS);
  scene.add(moonGroup);
  const moonTex = ctex(512, 256, (g, w, h) => {
    g.fillStyle = '#f4ecd8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = 'rgba(27,16,51,' + (0.06 + R() * 0.1) + ')';
      g.beginPath();
      g.arc(R() * w, 20 + R() * (h - 40), 4 + R() * 22, 0, 7);
      g.fill();
    }
  });
  moonGroup.add(
    new T.Mesh(new T.SphereGeometry(MOON_R, 40, 28), new T.MeshBasicMaterial({ map: moonTex, fog: false })),
  );
  const mg = new T.Sprite(
    new T.SpriteMaterial({
      map: glowTex,
      color: 0xf4ecd8,
      blending: T.AdditiveBlending,
      fog: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    }),
  );
  mg.scale.set(MOON_R * 5, MOON_R * 5, 1);
  moonGroup.add(mg);
  M.cloud = new T.MeshBasicMaterial({
    color: 0xffd8cc,
    transparent: true,
    opacity: 0.55,
    fog: false,
    depthWrite: false,
  });
  const cg = new T.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 22; i++) {
    const c = new T.Group(),
      s = 140 + R() * 260;
    c.position.set((R() - 0.5) * 3600, 560 + R() * 900, -500 - R() * 3400);
    for (let k = 0; k < 3; k++) {
      const m = new T.Mesh(cg, M.cloud);
      m.scale.set(s * (1 - 0.25 * k), s * 0.26, s * 0.6);
      m.position.set((k - 1) * s * 0.8, k === 1 ? s * 0.08 : 0, (R() - 0.5) * s * 0.3);
      c.add(m);
    }
    scene.add(c);
  }
  // grass mown in a checkerboard
  const gt2 = ctex(64, 64, (g, w, h) => {
    g.fillStyle = '#2f9e5c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#27884e';
    g.fillRect(0, 0, w / 2, h / 2);
    g.fillRect(w / 2, h / 2, w / 2, h / 2);
  });
  gt2.wrapS = gt2.wrapT = T.RepeatWrapping;
  gt2.repeat.set(3200 / 52, 3200 / 52);
  const grass = new T.Mesh(new T.PlaneGeometry(3200, 3200), new T.MeshLambertMaterial({ map: gt2 }));
  grass.rotation.x = -PI / 2;
  grass.receiveShadow = true;
  grass.renderOrder = -1;
  scene.add(grass);
  {
    const R2 = 95,
      c = 1 / Math.SQRT2,
      bq = -2 * c * MOUND,
      cq = MOUND * MOUND - R2 * R2,
      t = (-bq + Math.sqrt(bq * bq - 4 * cq)) / 2,
      px = t * c,
      a0 = Math.atan2(px - MOUND, px);
    const sh = new T.Shape();
    sh.moveTo(0, -4);
    sh.lineTo(px, px);
    sh.absarc(0, MOUND, R2, a0, PI - a0, false);
    sh.lineTo(0, -4);
    flat(new T.ShapeGeometry(sh, 40), '#a07a58', 1);
  }
  const ig = flat(new T.PlaneGeometry(82, 82), '#2c9256', 2);
  ig.rotation.z = PI / 4;
  ig.position.set(0, 0, -63.64);
  flat(new T.CircleGeometry(13, 36), '#a07a58', 3);
  for (const s of [-1, 1]) {
    const l = flat(new T.PlaneGeometry(0.45, 312), '#fffdf5', 4);
    l.position.set(s * 110, 0, -110);
    l.rotation.z = (s * -PI) / 4;
  }
  [
    [63.64, -63.64],
    [0, -127.28],
    [-63.64, -63.64],
  ].forEach((b) => {
    const m = new T.Mesh(new T.BoxGeometry(1.4, 0.25, 1.4), new T.MeshLambertMaterial({ color: '#fffdf5' }));
    m.position.set(b[0], 0.12, b[1]);
    m.rotation.y = PI / 4;
    scene.add(m);
  });
  for (const s of [-1, 1]) {
    const x0 = s * 1.25,
      x1 = s * 5.2;
    [
      [(x0 + x1) / 2, -3, Math.abs(x1 - x0), 0.24],
      [(x0 + x1) / 2, 3, Math.abs(x1 - x0), 0.24],
      [x0, 0, 0.24, 6],
      [x1, 0, 0.24, 6],
    ].forEach((q) => {
      flat(new T.PlaneGeometry(q[2], q[3]), '#fffdf5', 4).position.set(q[0], 0, q[1]);
    });
  }
  {
    const sh = new T.Shape();
    sh.moveTo(-0.71, 0.71);
    sh.lineTo(0.71, 0.71);
    sh.lineTo(0.71, 0);
    sh.lineTo(0, -0.71);
    sh.lineTo(-0.71, 0);
    sh.closePath();
    flat(new T.ShapeGeometry(sh), '#ffffff', 5);
  }
  const md = new T.Mesh(
    new T.SphereGeometry(9, 28, 10, 0, PI * 2, 0, PI / 2),
    new T.MeshLambertMaterial({ color: '#ad8a68' }),
  );
  md.scale.y = MOUND_H / 9;
  md.position.set(0, 0, -MOUND);
  md.receiveShadow = true;
  scene.add(md);
  const rb = new T.Mesh(new T.BoxGeometry(2, 0.12, 0.5), new T.MeshLambertMaterial({ color: '#fffdf5' }));
  rb.position.set(0, MOUND_H + 0.02, -MOUND);
  scene.add(rb);
  // outfield wall with league lettering, warning track, foul poles
  const th0 = 1.876,
    thL = 2.531;
  const wallTex = ctex(2048, 64, (g, w, h) => {
    g.fillStyle = '#125238';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,246,224,.9)';
    g.font = '700 40px "Barlow Condensed","Arial Narrow",sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    for (let i = 0; i < 4; i++) g.fillText(i % 2 ? 'TUNG TUNG SLAM' : 'SIX SEVEN', 256 + i * 512, h / 2 + 2);
    g.fillStyle = '#ffc83d';
    g.fillText('380', w / 2, h / 2 + 2);
  });
  wallTex.wrapS = T.RepeatWrapping;
  wallTex.repeat.x = -1;
  const wall = new T.Mesh(
    new T.CylinderGeometry(WR, WR, 12, 64, 1, true, th0, thL),
    new T.MeshLambertMaterial({ map: wallTex, side: T.DoubleSide }),
  );
  wall.position.set(0, 6, CZ);
  scene.add(wall);
  const cap2 = new T.Mesh(
    new T.CylinderGeometry(WR - 0.2, WR - 0.2, 0.9, 64, 1, true, th0, thL),
    new T.MeshBasicMaterial({ color: '#ffc83d', side: T.DoubleSide }),
  );
  cap2.position.set(0, 12, CZ);
  scene.add(cap2);
  flat(new T.RingGeometry(WR - 14, WR, 64, 1, 0.305, thL), '#8a6c52', 1).position.set(0, 0, CZ);
  for (const s of [-1, 1]) {
    const p = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 60, 8), new T.MeshBasicMaterial({ color: '#ffc83d' }));
    p.position.set(s * 219, 30, -219);
    scene.add(p);
  }
  // stands: crowd texture all the way around, standing fans in center field
  const crowdTex = ctex(512, 128, (g, w, h) => {
    g.fillStyle = '#2a1a4a';
    g.fillRect(0, 0, w, h);
    const cols = ['#fff6e0', '#ffc83d', '#ff5a36', '#ff9e6b', '#5ec4c4', '#b38cf0', '#8ea0c8', '#f06aa8'];
    for (let y = 3; y < h; y += 6) {
      g.fillStyle = 'rgba(12,6,28,.5)';
      g.fillRect(0, y + 4, w, 1.5);
      for (let x = R() * 4; x < w; x += 5) {
        if (R() < 0.12) continue;
        g.globalAlpha = 0.5 + R() * 0.5;
        g.fillStyle = cols[(R() * cols.length) | 0];
        g.fillRect(x, y, 3, 3.4);
      }
    }
    g.globalAlpha = 1;
  });
  crowdTex.wrapS = T.RepeatWrapping;
  crowdTex.repeat.set(14, 1);
  M.stands = new T.MeshBasicMaterial({ map: crowdTex, side: T.DoubleSide });
  const darkM = new T.MeshBasicMaterial({ color: '#1a0f31', side: T.DoubleSide });
  const lower = new T.Mesh(new T.CylinderGeometry(330, WR + 6, 58, 72, 1, true), M.stands);
  lower.position.set(0, 41, CZ);
  scene.add(lower);
  const fac = new T.Mesh(new T.CylinderGeometry(333, 331, 12, 72, 1, true), darkM);
  fac.position.set(0, 75, CZ);
  scene.add(fac);
  const upper = new T.Mesh(new T.CylinderGeometry(405, 336, 52, 72, 1, true), M.stands);
  upper.position.set(0, 106, CZ);
  scene.add(upper);
  const roof = new T.Mesh(new T.CylinderGeometry(407, 405, 5, 72, 1, true), darkM);
  roof.position.set(0, 134, CZ);
  scene.add(roof);
  buildFans(R);
  // light towers with beams
  const lampM = new T.MeshBasicMaterial({ color: '#fffdf0', fog: false });
  M.lamp = new T.SpriteMaterial({
    map: glowTex,
    color: 0xfff3d6,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.5,
    fog: false,
  });
  const shaftTex = ctex(4, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.7, 'rgba(255,255,255,.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  M.shaft = new T.MeshBasicMaterial({
    map: shaftTex,
    color: 0xfff1d0,
    transparent: true,
    opacity: 0.02,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
    fog: false,
  });
  [-2.4, -1.5, -0.75, -0.22, 0.22, 0.75, 1.5, 2.4].forEach((a) => {
    const x = Math.sin(a) * 410,
      z = CZ - Math.cos(a) * 410;
    const p = new T.Mesh(new T.BoxGeometry(3.5, 54, 3.5), darkM);
    p.position.set(x, 160, z);
    scene.add(p);
    const b = new T.Mesh(new T.BoxGeometry(34, 12, 3), lampM);
    b.position.set(x, 190, z);
    b.lookAt(0, 40, -60);
    scene.add(b);
    const gl = new T.Sprite(M.lamp.clone());
    gl.position.set(x * 0.98, 190, z + 6);
    gl.scale.set(110, 110, 1);
    scene.add(gl);
    if (Math.abs(a) < 1.6) TOWERS.push({ x, z, glow: gl }); // the ones a grand slam can reach
    if (Math.abs(a) < 1) {
      const L = V(x, 188, z),
        Fp = V(x * 0.12, 0, -70),
        dir = L.clone().sub(Fp),
        len = dir.length();
      const sh = new T.Mesh(new T.ConeGeometry(75, len, 20, 1, true), M.shaft);
      sh.position.copy(Fp).addScaledVector(dir, 0.5);
      sh.quaternion.setFromUnitVectors(YA, dir.normalize());
      sh.renderOrder = 8;
      scene.add(sh);
    }
  });
  // scoreboard
  const sbC = document.createElement('canvas');
  sbC.width = 512;
  sbC.height = 192;
  sbCtx = sbC.getContext('2d');
  sbTex = new T.CanvasTexture(sbC);
  SB_POS.set(0, 84, -452);
  const sb = new T.Mesh(new T.PlaneGeometry(104, 39), new T.MeshBasicMaterial({ map: sbTex, fog: false }));
  sb.position.set(0, 84, -452);
  scene.add(sb);
  const sbb = new T.Mesh(new T.BoxGeometry(110, 45, 5), darkM);
  sbb.position.set(0, 84, -456);
  scene.add(sbb);
  // parking lot, city and everything a grand slam can land on: see town.js
  flat(new T.RingGeometry(409, 2600, 72, 1), '#4a3d5c', 1).position.set(0, 0, CZ);
  buildTown(R);
}
/* standing fans: instanced bodies and heads that jump when the crowd is up */
let fanB = null,
  fanH = null,
  fanD = [];
const fanM = new T.Matrix4();
function buildFans(R) {
  const cols = ['#ff5a36', '#ffc83d', '#5ec4c4', '#f06aa8', '#fff6e0', '#7a9cff', '#9be06a', '#b38cf0'].map(
      (c) => new T.Color(c),
    ),
    skins = ['#f0c39a', '#d9a57c', '#a9744f', '#e8c4a0', '#8a5a3a'].map((c) => new T.Color(c));
  for (let r = 244; r <= 324; r += 6.6)
    for (let a = -0.5; a <= 0.5; a += 5.2 / r) {
      const x = Math.sin(a) * r,
        z = CZ - Math.cos(a) * r;
      if (r > 296 && Math.abs(x) < 60) continue;
      if (R() < 0.1) continue;
      fanD.push({ x: x + R() * 1.5, y: 12 + (r - 236) * 0.617 + 1.4, z, ph: R() * 6.28, amp: 0.6 + R() * 1.2 });
    }
  const n = fanD.length;
  fanB = new T.InstancedMesh(
    new T.CylinderGeometry(1.2, 0.95, 3.4, 6),
    new T.MeshLambertMaterial({ color: 0xffffff }),
    n,
  );
  fanH = new T.InstancedMesh(new T.SphereGeometry(1.05, 8, 6), new T.MeshLambertMaterial({ color: 0xffffff }), n);
  for (let i = 0; i < n; i++) {
    fanB.setColorAt(i, cols[(R() * cols.length) | 0]);
    fanH.setColorAt(i, skins[(R() * skins.length) | 0]);
  }
  scene.add(fanB, fanH);
  fansUpdate(0, true);
  const um = new T.InstancedMesh(new T.ConeGeometry(3.4, 1.5, 8), new T.MeshLambertMaterial({ color: 0xffffff }), 28);
  for (let i = 0; i < 28; i++) {
    const d = fanD[(R() * n) | 0];
    fanM.makeTranslation(d.x, d.y + 5.6, d.z);
    um.setMatrixAt(i, fanM);
    um.setColorAt(i, cols[(R() * cols.length) | 0]);
  }
  scene.add(um);
}
let fansStill = false;
function fansUpdate(h, force) {
  if (h < 0.02 && fansStill && !force) return;
  fansStill = h < 0.02;
  const t = gt * 0.013;
  for (let i = 0; i < fanD.length; i++) {
    const d = fanD[i],
      y = d.y + Math.abs(Math.sin(t + d.ph)) * d.amp * h * 2.4;
    fanM.makeTranslation(d.x, y, d.z);
    fanB.setMatrixAt(i, fanM);
    fanM.makeTranslation(d.x, y + 2.5, d.z);
    fanH.setMatrixAt(i, fanM);
  }
  fanB.instanceMatrix.needsUpdate = true;
  fanH.instanceMatrix.needsUpdate = true;
}
/* Light towers a grand slam can hit, and the scoreboard's place in the world. */
const TOWERS = [],
  SB_POS = V(0, 84, -452),
  SB_W = 104,
  SB_H = 39;
let sbLast = ['', '', ''],
  sbBroken = 0;
/* A ball into a light bank: the lamps stutter for a moment, then settle. */
function towerHit(t) {
  const g = t.glow,
    t0 = performance.now();
  const flicker = () => {
    const k = (performance.now() - t0) / 1500;
    if (k >= 1) {
      g.material.opacity = M.lamp.opacity;
      return;
    }
    g.material.opacity = M.lamp.opacity * (Math.random() < 0.5 - 0.4 * k ? 0.05 : 1 + (1 - k));
    requestAnimationFrame(flicker);
  };
  flicker();
}
/* A ball through the scoreboard: cracks spread from the hit, the text goes to static, then it reboots. */
function boardSmash(at) {
  if (!sbCtx) return;
  const g = sbCtx,
    x = ((at.x - SB_POS.x) / SB_W + 0.5) * 512,
    y = (0.5 - (at.y - SB_POS.y) / SB_H) * 192;
  sbBroken = performance.now();
  // static
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#2a2347' : Math.random() < 0.5 ? '#ffc83d' : '#120c24';
    g.fillRect(Math.random() * 512, Math.random() * 192, rnd(6, 40), rnd(2, 6));
  }
  g.strokeStyle = '#fff6e0';
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const a = rnd(0, PI * 2),
      len = rnd(60, 220);
    g.beginPath();
    g.moveTo(x, y);
    let px = x,
      py = y;
    for (let k = 0; k < 4; k++) {
      px += Math.cos(a + rnd(-0.4, 0.4)) * (len / 4);
      py += Math.sin(a + rnd(-0.4, 0.4)) * (len / 4);
      g.lineTo(px, py);
    }
    g.stroke();
  }
  g.fillStyle = '#fff6e0';
  g.beginPath();
  g.arc(x, y, 9, 0, PI * 2);
  g.fill();
  sbTex.needsUpdate = true;
  const broke = sbBroken;
  setTimeout(() => {
    if (sbBroken !== broke) return;
    sbBroken = 0;
    sbDraw(...sbLast);
  }, 2600);
}
function sbDraw(a, b, c) {
  if (!sbCtx) return;
  sbLast = [a, b, c];
  if (sbBroken) return; // it is in pieces; it comes back on its own
  const g = sbCtx;
  // an LED board: black bezel, dot-matrix amber and green, a thing that lives in the stadium
  g.fillStyle = '#07060c';
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#0f1a12';
  g.fillRect(14, 14, 484, 164);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const score = typeof ninthScore === 'function' && ninthScore();
  if (score) {
    // the 9th: the line score rides on top, the message underneath
    g.fillStyle = '#ffb02e';
    g.font = '36px "Bungee","Impact",sans-serif';
    g.fillText('VIS ' + score.vis + '   HOME ' + score.home, 256, 40, 470);
    g.fillStyle = score.walkoff ? '#ffb02e' : '#7cff5a';
    g.font = '700 22px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText(score.line, 256, 72, 470);
    g.fillStyle = '#ff5a36';
    g.fillRect(14, 86, 484, 2);
    g.fillStyle = '#7cff5a';
    g.font = '700 22px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText(a || '', 256, 106, 460);
    g.fillStyle = '#ffb02e';
    g.font = '36px "Bungee","Impact",sans-serif';
    g.fillText(b || '', 256, 138, 460);
    g.fillStyle = '#7cff5a';
    g.font = '700 20px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText(c || '', 256, 166, 460);
  } else {
    g.fillStyle = '#7cff5a';
    g.font = '700 30px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText(a || '', 256, 42, 460);
    g.fillStyle = '#ffb02e';
    g.font = '62px "Bungee","Impact",sans-serif';
    g.fillText(b || '', 256, 98, 460);
    g.fillStyle = '#7cff5a';
    g.font = '700 32px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText(c || '', 256, 152, 460);
  }
  g.fillStyle = ledMask();
  g.fillRect(14, 14, 484, 164);
  sbTex.needsUpdate = true;
}
/* The dark grid between LED dots, drawn once as a pattern. */
let ledPat = null;
function ledMask() {
  if (ledPat) return ledPat;
  const c = document.createElement('canvas');
  c.width = c.height = 5;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fillRect(0, 0, 5, 5);
  g.clearRect(1, 1, 3, 3);
  ledPat = sbCtx.createPattern(c, 'repeat');
  return ledPat;
}

/* ---------- mood: golden hour (0) into night under the lights (1) ---------- */
const mc = (a, b) => [new T.Color(a), new T.Color(b)],
  MC = {
    hs: mc(0xffe8d2, 0x93a4ff),
    hg: mc(0x3f6f4c, 0x1d3a2c),
    kc: mc(0xffdfb8, 0xf2f5ff),
    rc: mc(0xffc890, 0xb8ccff),
    fog: mc(0xffb27c, 0x1b1540),
    cl: mc(0xffd8cc, 0x3c3766),
    st: mc(0xffffff, 0xb4aee0),
    ci: mc(0xb89ad0, 0x7466a8),
  };
const KP0 = V(-70, 55, 35),
  KP1 = V(-36, 118, 44);
let moodCur = -1,
  moodT = 0.18,
  pressCur = 0;
function applyMood(k) {
  hemi.color.lerpColors(MC.hs[0], MC.hs[1], k);
  hemi.groundColor.lerpColors(MC.hg[0], MC.hg[1], k);
  hemi.intensity = lerp(0.72, 0.36, k);
  key.color.lerpColors(MC.kc[0], MC.kc[1], k);
  key.intensity = lerp(0.62, 0.95, k);
  key.position.lerpVectors(KP0, KP1, k);
  rim.color.lerpColors(MC.rc[0], MC.rc[1], k);
  rim.intensity = lerp(0.3, 0.6, k);
  scene.fog.color.lerpColors(MC.fog[0], MC.fog[1], k);
  scene.fog.density = lerp(0.0011, 0.00085, k);
  M.night.opacity = k;
  M.sun.opacity = 1 - k;
  M.cloud.color.lerpColors(MC.cl[0], MC.cl[1], k);
  M.cloud.opacity = lerp(0.55, 0.35, k);
  M.stands.color.lerpColors(MC.st[0], MC.st[1], k);
  M.city.color.lerpColors(MC.ci[0], MC.ci[1], k);
  M.lamp.opacity = lerp(0.45, 1, k);
  M.shaft.opacity = lerp(0.02, 0.2, k);
  starMat.opacity = lerp(0.15, 0.95, k);
}
