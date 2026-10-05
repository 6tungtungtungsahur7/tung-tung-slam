/* ============================================================================
   TOWN. Everything outside the ballpark that a grand slam can reach:
   the parking lot (cars with alarms), downtown (windows that break) and the road out of town.
   Distances are feet from home plate, straight out to centre field (-z).
   ============================================================================ */

const CAR = {
  ROWS: 7,
  PER_ROW: 29,
  FIRST_ROW: 600, // feet from the plate
  ROW_GAP: 34,
  AISLE: 26, // extra gap after every second row
  SPACING: 13,
  ROOF: 5.4,
  COLORS: ['#c8402f', '#e9e4d4', '#2b6cb0', '#ffc83d', '#1d8a8a', '#8a93a8', '#111014'],
  ALARM_MS: 2600,
};
/* Two rows of buildings. The near row is low so the far row shows above it. */
const CITY = {
  NEAR: { count: 24, from: 930, to: 1020, height: [60, 140], width: [60, 95] },
  FAR: { count: 28, from: 1120, to: 1220, height: [150, 260], width: [70, 110] },
  SPREAD: 1.15, // radians either side of centre field
};

/* Past downtown: houses with yards. */
const SUBURB = { HOUSES: 70, TREES: 90, from: 1400, to: 1790, SPREAD: 0.55 };

const CARS = [], // { x, z, i }
  BUILDINGS = [], // { x, z, w, h }
  HOUSES = []; // { x, z }
let carBody = null,
  carCabin = null,
  carAxle = null,
  alarmLights = [],
  alarm = null,
  brokenWindow = null,
  porchLight = null;
const carM4 = new T.Matrix4();

function buildTown(R) {
  // --- cars: a body, a cabin and two dark axles each, drawn as three instanced meshes
  const max = CAR.ROWS * CAR.PER_ROW,
    paint = CAR.COLORS.map((c) => new T.Color(c));
  carBody = new T.InstancedMesh(new T.BoxGeometry(6.4, 2.4, 15), new T.MeshLambertMaterial({ color: 0xffffff }), max);
  carCabin = new T.InstancedMesh(new T.BoxGeometry(5.6, 2.1, 7.4), new T.MeshLambertMaterial({ color: 0x241c3a }), max);
  carAxle = new T.InstancedMesh(new T.BoxGeometry(6.9, 2.2, 2.5), new T.MeshLambertMaterial({ color: 0x120c1e }), max * 2);
  const half = (CAR.PER_ROW - 1) / 2;
  for (let row = 0; row < CAR.ROWS; row++)
    for (let i = -half; i <= half; i++) {
      if (R() < 0.2) continue; // empty space
      const car = {
        i: CARS.length,
        x: i * CAR.SPACING + (row % 2) * 3,
        z: -(CAR.FIRST_ROW + row * CAR.ROW_GAP + (row >> 1) * CAR.AISLE),
      };
      CARS.push(car);
      placeCar(car, 0);
      carBody.setColorAt(car.i, paint[(R() * paint.length) | 0]);
    }
  carBody.count = carCabin.count = CARS.length;
  carAxle.count = CARS.length * 2;
  scene.add(carBody, carCabin, carAxle);

  // parking rows painted on the tarmac
  const stripe = new T.MeshBasicMaterial({ color: 0x8d83a6 });
  for (let row = 0; row < CAR.ROWS; row += 2) {
    const z = -(CAR.FIRST_ROW + row * CAR.ROW_GAP + (row >> 1) * CAR.AISLE) - CAR.ROW_GAP / 2;
    const line = new T.Mesh(new T.PlaneGeometry(CAR.PER_ROW * CAR.SPACING, 1.2), stripe);
    line.rotation.x = -PI / 2;
    line.position.set(0, 0.12, z);
    scene.add(line);
  }

  // blinking lights for car alarms (shared, moved to whichever cars are going off)
  for (let i = 0; i < 12; i++) {
    const s = new T.Sprite(
      new T.SpriteMaterial({ map: glowTex, color: 0xffa02a, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }),
    );
    s.visible = false;
    scene.add(s);
    alarmLights.push(s);
  }

  // --- downtown
  const windows = ctex(64, 128, (g, w, h) => {
    g.fillStyle = '#2a1a4a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,200,61,.8)';
    for (let i = 0; i < 46; i++) g.fillRect(((R() * 8) | 0) * 8 + 2, ((R() * 16) | 0) * 8 + 2, 3, 4);
  });
  M.city = new T.MeshBasicMaterial({ map: windows, fog: false, color: 0xb89ad0 });
  for (const rowCfg of [CITY.NEAR, CITY.FAR])
    for (let i = 0; i < rowCfg.count; i++) {
      // evenly spread with a little jitter, so there is always a building near any landing spot
      const angle = ((i + 0.5) / rowCfg.count - 0.5) * 2 * CITY.SPREAD + (R() - 0.5) * 0.05,
        r = lerp(rowCfg.from, rowCfg.to, R()),
        b = {
          x: Math.sin(angle) * r,
          z: -Math.cos(angle) * r,
          w: lerp(rowCfg.width[0], rowCfg.width[1], R()),
          h: lerp(rowCfg.height[0], rowCfg.height[1], R()),
        };
      BUILDINGS.push(b);
      const mesh = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.w), M.city);
      mesh.position.set(b.x, b.h / 2, b.z);
      scene.add(mesh);
    }

  // the hole a ball leaves in a window
  const hole = ctex(128, 128, (g, w) => {
    g.translate(w / 2, w / 2);
    g.fillStyle = '#0b0716';
    g.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2,
        r = i % 2 ? 26 + R() * 12 : 46 + R() * 16;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.fill();
    g.strokeStyle = 'rgba(255,246,224,.85)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = R() * PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
      g.lineTo(Math.cos(a + 0.1) * 62, Math.sin(a + 0.1) * 62);
      g.stroke();
    }
  });
  brokenWindow = new T.Mesh(
    new T.PlaneGeometry(15, 15),
    new T.MeshBasicMaterial({ map: hole, transparent: true, fog: false, depthWrite: false }),
  );
  brokenWindow.visible = false;
  scene.add(brokenWindow);

  // --- suburbs: houses and trees past the last buildings
  const walls = new T.InstancedMesh(new T.BoxGeometry(34, 16, 28), new T.MeshLambertMaterial({ color: 0xffffff }), SUBURB.HOUSES),
    roofGeo = new T.ConeGeometry(27, 13, 4),
    roofs = new T.InstancedMesh(roofGeo, new T.MeshLambertMaterial({ color: 0x3a2540 }), SUBURB.HOUSES),
    trees = new T.InstancedMesh(new T.ConeGeometry(9, 30, 6), new T.MeshLambertMaterial({ color: 0x2d5a45 }), SUBURB.TREES),
    wallPaint = ['#e9d8b8', '#d9b99a', '#b8c7d6', '#e6c9c0'].map((c) => new T.Color(c)),
    place = () => {
      const angle = (R() - 0.5) * 2 * SUBURB.SPREAD,
        r = lerp(SUBURB.from, SUBURB.to, R());
      return { x: Math.sin(angle) * r, z: -Math.cos(angle) * r };
    };
  roofGeo.rotateY(PI / 4);
  for (let i = 0; i < SUBURB.HOUSES; i++) {
    const h = place();
    HOUSES.push(h);
    carM4.makeTranslation(h.x, 8, h.z);
    walls.setMatrixAt(i, carM4);
    walls.setColorAt(i, wallPaint[(R() * wallPaint.length) | 0]);
    carM4.makeTranslation(h.x, 22.5, h.z);
    roofs.setMatrixAt(i, carM4);
  }
  for (let i = 0; i < SUBURB.TREES; i++) {
    const t = place();
    carM4.makeTranslation(t.x, 15, t.z);
    trees.setMatrixAt(i, carM4);
  }
  scene.add(walls, roofs, trees);
  porchLight = new T.Sprite(
    new T.SpriteMaterial({ map: glowTex, color: 0xffd98a, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }),
  );
  porchLight.scale.setScalar(60);
  porchLight.visible = false;
  scene.add(porchLight);

  // --- the road out of town: a lit sign past the last buildings
  const sign = ctex(512, 256, (g, w, h) => {
    g.fillStyle = '#1d8a5a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff6e0';
    g.lineWidth = 10;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#fff6e0';
    g.textAlign = 'center';
    g.font = '700 54px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText('NOW LEAVING', w / 2, 100);
    g.font = '700 78px "Barlow Condensed","Arial Narrow",sans-serif';
    g.fillText('DOWNTOWN', w / 2, 190);
  });
  const board = new T.Mesh(new T.PlaneGeometry(150, 75), new T.MeshBasicMaterial({ map: sign, fog: false }));
  board.position.set(-130, 70, -1330);
  scene.add(board);
  for (const dx of [-55, 55]) {
    const post = new T.Mesh(new T.BoxGeometry(5, 36, 5), new T.MeshBasicMaterial({ color: 0x1a0f31, fog: false }));
    post.position.set(-130 + dx, 18, -1331);
    scene.add(post);
  }
}

/* Writes one car's instance matrices, lifted by `hop` feet. */
function placeCar(car, hop, tilt) {
  const put = (mesh, index, y, dz) => {
    carM4.makeRotationZ(tilt || 0);
    carM4.setPosition(car.x, y + hop, car.z + dz);
    mesh.setMatrixAt(index, carM4);
    mesh.instanceMatrix.needsUpdate = true;
  };
  put(carBody, car.i, 2.3, 0);
  put(carCabin, car.i, 4.3, 0.6);
  put(carAxle, car.i * 2, 1.1, 4.6);
  put(carAxle, car.i * 2 + 1, 1.1, -4.6);
}

/* The hit car jumps; it and its neighbours flash their lights. */
function carAlarm(car) {
  const near = CARS.filter((c) => c !== car && Math.abs(c.z - car.z) < 1 && Math.abs(c.x - car.x) < CAR.SPACING * 1.6);
  alarm = { car, cars: [car].concat(near).slice(0, 3), t0: performance.now() };
}

function breakWindow(at) {
  brokenWindow.position.set(at.x, at.y, at.z + 0.4);
  brokenWindow.visible = true;
}

/* Somebody heard that: the lights come on at the nearest house. */
function wakeHouse(house) {
  porchLight.position.set(house.x, 12, house.z + 16);
  porchLight.visible = true;
}

function moonCrater(at) {
  const mark = new T.Mesh(new T.SphereGeometry(55, 10, 8), new T.MeshBasicMaterial({ color: 0xd9cfb6, fog: false }));
  mark.position.copy(at).sub(MOON_POS);
  moonGroup.add(mark);
}

/* Per-frame animation for the town (real time, so it keeps going through a hit-stop). */
function worldUpdate() {
  if (!alarm) return;
  const t = performance.now() - alarm.t0;
  if (t > CAR.ALARM_MS) {
    placeCar(alarm.car, 0);
    alarmLights.forEach((s) => (s.visible = false));
    alarm = null;
    return;
  }
  // a quick hop that settles
  const hop = t < 450 ? Math.abs(Math.sin((t / 450) * PI * 2)) * 2.2 * (1 - t / 450) : 0;
  placeCar(alarm.car, hop, t < 450 ? Math.sin(t / 40) * 0.05 : 0);
  const on = Math.floor(t / 190) % 2 === 0;
  alarm.cars.forEach((c, n) => {
    for (let k = 0; k < 4; k++) {
      const s = alarmLights[n * 4 + k];
      s.visible = on;
      s.position.set(c.x + (k % 2 ? 2.9 : -2.9), 2.9 + (c === alarm.car ? hop : 0), c.z + (k < 2 ? 7.6 : -7.6));
      s.scale.setScalar(k < 2 ? 9 : 7);
      s.material.color.setHex(k < 2 ? 0xffa02a : 0xff3b2a);
    }
  });
}
