/* ============================================================================
   PAUSE AND SETTINGS. One sheet for both: Resume, two volume sliders, haptics,
   and (during a run) Restart and Home. Tapping outside the sheet, or the pause
   button again, resumes.
   ============================================================================ */

function syncSettings() {
  for (const [which, id] of [['sound', 'volSound'], ['music', 'volMusic']]) {
    $(id).value = Math.round(vol[which] * 100);
    $(id + 'N').textContent = Math.round(vol[which] * 100);
  }
  const hap = $('tHap');
  hap.classList.toggle('off', !hapOn);
  hap.setAttribute('aria-pressed', String(hapOn));
  hap.querySelector('small').textContent = hapOn ? 'ON' : 'OFF';
}

let quitArm = 0;
function openSheet(mode) {
  const inRun = mode === 'pause';
  paused = inRun;
  $('shTitle').textContent = inRun ? 'PAUSED' : 'SETTINGS';
  $('resumeBtn').hidden = !inRun;
  $('runActs').hidden = !inRun;
  $('closeBtn').hidden = inRun;
  $('restartBtn').hidden = run.mode === 'ninth' && !CFG.TEST_REPLAY;
  $('quitBtn').lastChild.nodeValue = 'HOME';
  quitArm = 0;
  $('pauseMsg').textContent =
    inRun && run.mode === 'ninth' && !CFG.TEST_REPLAY ? 'Leaving ends your one attempt this week with the feet you have so far.' : '';
  $('recalBtn').hidden = inRun; // offered from the lobby only: it would throw away a run
  syncSettings();
  $('sheet').hidden = false;
  $('sheet').scrollTop = 0;
  $('pauseBtn').innerHTML = ic(inRun ? 'play' : 'pause', 24);
  $('pauseBtn').setAttribute('aria-label', 'Resume');
  applyVolumes(); // everything drops to a whisper
}
function closeSheet() {
  $('sheet').hidden = true;
  audioSolo(null);
  $('pauseBtn').innerHTML = ic('pause', 24);
  $('pauseBtn').setAttribute('aria-label', 'Pause');
  if (paused) {
    paused = false;
    if (state === 'ready') nextAt = Math.max(nextAt, gt + 700);
  }
  applyVolumes();
}

// the pause button is a toggle and stays above the sheet
$('pauseBtn').addEventListener('click', () => (paused ? closeSheet() : pauseNow()));
// tapping the dimmed area around the sheet closes it. On click, not pointerdown: closing on the
// down event let the matching click land on whatever sat underneath (the gear button, which
// reopened the sheet on phones).
$('sheet').addEventListener('click', (e) => {
  if (e.target === $('sheet')) closeSheet();
});
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (!$('sheet').hidden) closeSheet();
  else pauseNow();
});
$('gearBtn').addEventListener('click', () => {
  audioInit();
  openSheet('settings');
});
$('resumeBtn').addEventListener('click', closeSheet);
$('closeBtn').addEventListener('click', closeSheet);
$('sheetX').addEventListener('click', closeSheet);
/* the performance readout: fps and where the time goes, for phones that feel slow */
function syncPerf() {
  $('perf').hidden = !PERF.on;
  $('perfBtn').textContent = PERF.on ? 'Hide performance numbers' : 'Show performance numbers';
}
$('perfBtn').addEventListener('click', () => {
  PERF.on = !PERF.on;
  store.set('perf', PERF.on ? '1' : '0');
  syncPerf();
});
syncPerf();
$('shareX').addEventListener('click', () => ($('share').hidden = true));
/* the career sheet takes the pause sheet's place and hands it back on close */
$('statsBtn').addEventListener('click', () => {
  $('sheet').hidden = true;
  statsFromPause = true;
  openStats();
});
$('awardsBtn').addEventListener('click', () => {
  $('sheet').hidden = true;
  openAwardsSheet();
});
const closeAwards = () => {
  $('awsheet').hidden = true;
  $('sheet').hidden = false;
};
$('awX').addEventListener('click', closeAwards);
$('awClose').addEventListener('click', closeAwards);
let statsFromPause = false;
const closeStats = () => {
  $('stats').hidden = true;
  if (statsFromPause) $('sheet').hidden = false;
};
$('profileBtn').addEventListener('click', () => {
  audioInit();
  statsFromPause = false;
  openStats();
});
$('statsX').addEventListener('click', closeStats);
$('statsClose').addEventListener('click', closeStats);
$('restartBtn').addEventListener('click', () => {
  closeSheet();
  startRun(run.mode === 'warmup' ? 'streak' : run.mode, run.practiceIdx, run.duel);
});
$('quitBtn').addEventListener('click', () => {
  // ask twice: one stray tap should not throw a streak away
  if (performance.now() > quitArm) {
    quitArm = performance.now() + 3000;
    $('quitBtn').lastChild.nodeValue = 'SURE?';
    setTimeout(() => {
      if ($('quitBtn').lastChild.nodeValue === 'SURE?') $('quitBtn').lastChild.nodeValue = 'HOME';
    }, 3000);
    return;
  }
  closeSheet();
  if (run.mode === 'ninth') {
    overInfo = { how: 'looking' };
    endRun();
  } else showMenu();
});

/* Volume sliders. While one is held, only that side plays so it can be set by ear. */
for (const [which, id] of [['sound', 'volSound'], ['music', 'volMusic']]) {
  const el = $(id);
  el.addEventListener('input', () => {
    audioInit();
    setVolume(which, +el.value / 100);
    $(id + 'N').textContent = el.value;
    audioSolo(which);
  });
  el.addEventListener('pointerdown', () => {
    audioInit();
    audioSolo(which);
  });
  for (const ev of ['pointerup', 'pointercancel', 'change', 'blur']) el.addEventListener(ev, () => audioSolo(null));
}
$('tHap').addEventListener('click', () => {
  hapOn = !hapOn;
  store.set('hap', hapOn ? '1' : '0');
  syncSettings();
  vib(20);
});
/* Tap timing centres itself as you play. If it has drifted, the warm-up sets it again from three swings. */
$('recalBtn').addEventListener('click', () => {
  closeSheet();
  startRun('warmup');
});
