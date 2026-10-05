/* ---------- input and boot ---------- */
addEventListener('pointerdown', audioInit, true); // browsers only allow sound after a touch
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button,input,.sheet,#lobby')) return;
  audioInit();
  if (state === 'menu') return lobbyTouch(e);
  if (state === 'cut') return skipCutscene();
  swing(e.timeStamp);
});
/* In the lobby a drag spins the batter round and a tap makes him pose. */
let spin = null;
function lobbyTouch(e) {
  if (!batter || !$('sheet').hidden) return;
  spin = { x: e.clientX, moved: 0, id: e.pointerId };
  const move = (ev) => {
    if (!spin || ev.pointerId !== spin.id) return;
    const dx = ev.clientX - spin.x;
    spin.x = ev.clientX;
    spin.moved += Math.abs(dx);
    batter.g.rotation.y += dx * 0.012;
  };
  const up = (ev) => {
    if (!spin || ev.pointerId !== spin.id) return;
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    if (spin.moved < 8 && state === 'menu') emote('sky');
    spin = null;
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}
function emote(name) {
  if (!bt.q.length) batGo(EMOTES[name] || EMOTES.sky);
  crowd.cheer(0.35, 1.2);
  sfx.pop();
  vib(10);
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (state === 'menu') {
      if (!$('pgHome').hidden && $('sheet').hidden) startRun('streak');
    } else if (state === 'over') {
      if (run.mode !== 'ninth' && $('share').hidden) startRun(run.mode, run.practiceIdx, run.duel);
    } else swing(e.timeStamp);
  }
});
$('playBtn').addEventListener('click', () => startRun('streak'));
$('dailyBtn').addEventListener('click', () => startRun('daily'));
$('ninthBtn').addEventListener('click', () => startRun('ninth'));
document.querySelectorAll('[data-close="page"]').forEach((b) => b.addEventListener('click', () => goTab('Home')));
/* claiming is one thing everywhere: results chip, Awards page, Awards sheet */
function claimNow(fromEl) {
  const got = claimRewards();
  if (!got) return;
  music.sting('record');
  crowd.claps();
  vib([20, 30, 40]);
  flashOn(0.25, 200);
  lobbySync();
  if (fromEl) {
    fromEl.classList.add('done');
    const t = fromEl.querySelector('span');
    if (t) t.textContent = 'CLAIMED';
  }
  renderAwardList($('awardList'));
  renderAwardList($('awList'));
  syncClaimButtons();
}
$('oCapsBox').addEventListener('click', () => claimNow($('oCapsBox')));
$('pgClaim').addEventListener('click', () => claimNow());
$('awClaim').addEventListener('click', () => claimNow());
$('oAwardsBtn').addEventListener('click', () => {
  const open = $('gains').hidden;
  $('gains').hidden = !open;
  $('oAwardsBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
});
$('againBtn').addEventListener('click', () => {
  if (run.mode === 'ninth' && !CFG.TEST_REPLAY) {
    showMenu();
    goTab('Ranks');
    setBoard('ninth');
  } else startRun(run.mode, run.practiceIdx, run.duel);
});
$('homeBtn').addEventListener('click', showMenu);
$('reviveBtn').addEventListener('click', takeChance);
$('endBtn').addEventListener('click', endRun);
document.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => {
    audioInit();
    goTab(b.dataset.tab);
  }),
);
document.querySelectorAll('[data-board]').forEach((b) => b.addEventListener('click', () => setBoard(b.dataset.board)));
$('shareBtn').addEventListener('click', () => {
  $('capTxt').textContent = bragText();
  // a streak run can be handed to a friend as a code: they face the same pitch draws
  $('duelRow').hidden = run.mode !== 'streak';
  $('duelCode').textContent = run.mode === 'streak' ? runCode() : '';
  $('shareMsg').textContent = '';
  $('saveBtn').hidden = !dl;
  $('share').hidden = false;
});
$('shareClose').addEventListener('click', () => {
  $('share').hidden = true;
});
$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bragText());
    $('shareMsg').textContent = 'Caption copied. Paste it with the image.';
  } catch (e) {
    $('shareMsg').textContent = 'Copy is blocked here. Press and hold the caption to copy it.';
  }
});
$('codeCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(runCode());
    $('shareMsg').textContent = 'Code copied. A friend enters it under Practice to face the same pitches.';
  } catch (e) {
    $('shareMsg').textContent = 'Copy is blocked here. The code is ' + runCode() + '.';
  }
});
/* Entering a friend's code starts a run on their pitch draws. */
function playCode() {
  const duel = readCode($('codeIn').value);
  if (!duel) {
    $('codeMsg').textContent = 'That code does not look right. It reads like ABC1234-22.';
    return;
  }
  $('codeMsg').textContent = '';
  startRun('challenge', 0, duel);
}
$('codeGo').addEventListener('click', playCode);
$('codeIn').addEventListener('keydown', (e) => {
  e.stopPropagation(); // typing a code must not swing the bat or start a run
  if (e.code === 'Enter') playCode();
});
$('capsBtn').addEventListener('click', () => {
  audioInit();
  goTab('Awards');
});
document.querySelectorAll('[data-awards]').forEach((b) => b.addEventListener('click', () => setAwardsView(b.dataset.awards)));
$('saveBtn').addEventListener('click', () => {
  if (!dl || !cardCanvas) return;
  cardCanvas.toBlob(async (blob) => {
    if (!blob) return;
    try {
      await dl.save({
        filename: 'tung-tung-slam-' + (run.mode === 'ninth' ? run.feet + 'ft' : run.streak) + '.png',
        data: blob,
      });
      $('shareMsg').textContent = 'Image saved.';
    } catch (e) {
      $('shareMsg').textContent = e && e.code === 'declined' ? '' : 'Could not save the image here.';
      if (e && (e.code === 'unavailable' || e.code === 'not_granted')) $('saveBtn').hidden = true;
    }
  }, 'image/png');
});
addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state !== 'menu' && state !== 'over' && !paused) {
    if (state !== 'chance') pauseNow();
  }
});
if (window.__DEV)
  window.__ms = {
    get state() {
      return state;
    },
    get eta() {
      return state === 'flight' ? tA - gt : null;
    },
    get streak() {
      return run.streak;
    },
    get run() {
      return run;
    },
    get pIdx() {
      return pIdx;
    },
    get ballZ() {
      return ball.pos.z;
    },
    get moodCur() {
      return moodCur;
    },
    get off() {
      return tapOff;
    },
    cue() {
      const a = cueT.getBoundingClientRect(),
        b = cueR.getBoundingClientRect();
      return { t: a.width / 2, r: cueR.hidden ? null : b.width / 2 };
    },
    /* where the ball is on screen, as fractions of the stage (0..1); null when there is no ball */
    get ballXY() {
      if (!ball.on) return null;
      const p = ball.pos.clone().project(camera);
      return { x: p.x * 0.5 + 0.5, y: -p.y * 0.5 + 0.5, behind: p.z > 1, wx: ball.pos.x, wy: ball.pos.y, wz: ball.pos.z };
    },
    get cutT() {
      return cut ? gt - cut.t0 : null;
    },
    get windows() {
      return win();
    },
    get pitchCount() {
      return pitchCount;
    },
    get pitch() {
      return pitch;
    },
    get live() {
      return pitchLive();
    },
    get audio() {
      return AC ? { time: AC.currentTime, state: AC.state, crowd: crowd.level, tune: music.playing } : null;
    },
    cfg: CFG,
    emote,
    get pitMood() {
      return pitMood;
    },
    get pitX() {
      return pit ? pit.g.position.x : 0;
    },
    get pitYaw() {
      return pitHeadYaw;
    },
    corridor() {
      // screen box the ball travels through: pitcher's hand to the target
      const hand = V(0, 0, 0);
      pit.ha[0].getWorldPosition(hand);
      const a = Object.assign({}, toScreen(hand)),
        b = toScreen(V(pitch ? pitch.end.x : 0, pitch ? pitch.end.y : ZONE_Y, 0));
      return { left: Math.min(a.x, b.x) - 30, right: Math.max(a.x, b.x) + 30, top: Math.min(a.y, b.y) - 30, bottom: Math.max(a.y, b.y) + 30 };
    },
    probe() {
      // loudness of everything going to the speakers right now
      if (!AC) return null;
      if (!this.an) {
        this.an = AC.createAnalyser();
        this.an.fftSize = 2048;
        limiter.connect(this.an);
        this.buf = new Float32Array(2048);
      }
      this.an.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      return Math.sqrt(sum / this.buf.length);
    },
    bat(mult) {
      CFG.BAT_MULT = mult;
    },
    pitcher(i) {
      setPitcher(i);
      run.tally = { homers: 0, hits: 0 };
      hud();
    },
    /* test shortcuts: jump the streak, set the saved best, hand out coins */
    streak(n) {
      run.streak = n;
      hud();
    },
    best(n) {
      best = n;
      store.set('best', n);
      lobbySync();
    },
    coins(n) {
      coins = n;
      store.set('coins', n);
      lobbySync();
    },
    /* marks every pitch type as already introduced, so no new-pitch banners appear */
    seenAll() {
      Object.keys(TYPES).forEach((t) => (seen[t] = 1));
      seen.hint = 1;
    },
    caps(n) {
      caps = n;
      store.set('caps', n);
      lobbySync();
    },
    get capCount() {
      return caps;
    },
    get career() {
      return career;
    },
    get days() {
      return dayRec;
    },
    get offset() {
      return tapOff;
    },
    get wallet() {
      return coins;
    },
    get paused() {
      return paused;
    },
    mood(k) {
      window.__moodLock = k;
      moodT = k;
      moodCur = k;
      applyMood(k);
    },
    cam(p, l) {
      camPos.set(p[0], p[1], p[2]);
      camLook.set(l[0], l[1], l[2]);
    },
    pose(a) {
      const t = { B0, B1, B2, B3, B4, B5 }[a] || B0;
      bt.q = [
        [t, 1],
        [t, 99999],
      ];
      bt.from = bt.cur.slice();
      bt.t = 0;
    },
  };

buildWorld();
buildFx();
buildActors();
resize();
renderShop();
syncSettings();
showMenu();
bootBoard();
if (document.fonts && document.fonts.ready)
  document.fonts.ready.then(() => {
    if (state === 'menu') sbDraw('WELCOME TO', 'TUNG TUNG SLAM', 'SIX SEVEN');
    dressBatter();
  });
requestAnimationFrame(frame);
