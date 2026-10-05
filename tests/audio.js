// Sound checks: `node tests/audio.js`
// Nobody can listen in a test, so this measures loudness over time instead.
//   - between events the crowd is a faint bed, and it reacts loudly to a home run
//   - pausing mid-cheer drops everything to a whisper within a second, never silent
//   - dragging a slider plays only that side
//   - the organ plays in the lobby and stops in a run
const { open, installBot } = require('./harness');

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log((cond ? '  ok    ' : '  FAIL  ') + msg);
};
const sample = (page, seconds) =>
  page.evaluate(
    (seconds) =>
      new Promise((resolve) => {
        const out = [],
          t0 = performance.now();
        const id = setInterval(() => {
          out.push(window.__ms.probe());
          if (performance.now() - t0 > seconds * 1000) {
            clearInterval(id);
            resolve(out);
          }
        }, 100);
      }),
    seconds,
  );
const stats = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length,
    sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length);
  return { mean, swing: sd / (mean || 1), min: Math.min(...xs), max: Math.max(...xs) };
};
const show = (s) => `mean ${s.mean.toFixed(4)}, low ${s.min.toFixed(4)}, high ${s.max.toFixed(4)}`;
const slide = (page, id, value) =>
  page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, value });

(async () => {
  const { browser, page, errors } = await open(390, 844);
  await page.evaluate(() => (window.__skipRender = true));
  await installBot(page);

  console.log('1. Lobby');
  await page.click('#gearBtn'); // first touch starts the sound
  await page.click('#closeBtn');
  await page.waitForTimeout(1500);
  let a = await page.evaluate(() => window.__ms.audio);
  ok(a && a.state === 'running' && a.tune, 'sound engine running and the organ tune plays: ' + JSON.stringify(a));
  const lobby = stats(await sample(page, 3));
  console.log('  lobby with organ: ' + show(lobby));

  console.log('2. Sliders');
  await page.click('#gearBtn');
  await slide(page, 'volMusic', 0);
  await page.click('#closeBtn');
  await page.waitForTimeout(700);
  const bed = stats(await sample(page, 6));
  console.log('  music at 0 (crowd bed only): ' + show(bed));
  ok(bed.mean < lobby.mean * 0.5, 'music slider at 0 removes the organ');
  ok(bed.mean > 0.0003, 'a faint crowd is still there');
  ok(bed.mean < 0.03, 'the crowd bed is quiet (was 0.058 with the old constant crowd)');
  await page.click('#gearBtn');
  await slide(page, 'volMusic', 60);
  // hold the sound slider: only sound effects and crowd should play
  await page.evaluate(() => document.getElementById('volSound').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(600);
  const soloSound = stats(await sample(page, 2.5));
  await page.evaluate(() => document.getElementById('volSound').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  console.log('  holding the Sound slider: ' + show(soloSound));
  ok(soloSound.max > bed.mean * 3, 'holding the Sound slider plays sample sounds');
  await slide(page, 'volSound', 0);
  await page.evaluate(() => document.getElementById('volMusic').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(600);
  const soloMusic = stats(await sample(page, 2));
  await page.evaluate(() => document.getElementById('volMusic').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  console.log('  sound at 0, holding the Music slider: ' + show(soloMusic));
  ok(soloMusic.mean > 0.01, 'holding the Music slider plays the organ alone');
  await slide(page, 'volSound', 80);
  await page.click('#closeBtn');

  console.log('3. In play');
  await page.evaluate(() => (window.__botPlan = [25, 25, null, null, null]));
  await page.click('#playBtn');
  a = await page.evaluate(() => window.__ms.audio);
  ok(a && !a.tune, 'organ tune stops when the run starts');
  await page.waitForFunction(() => window.__ms.state === 'windup', null, { timeout: 30000 });
  const calm = stats(await sample(page, 0.8));
  await page.waitForFunction(() => window.__ms.state === 'homer', null, { timeout: 30000 });
  const cheer = stats(await sample(page, 1.6));
  console.log('  before the pitch: ' + show(calm));
  console.log('  home run:         ' + show(cheer));
  ok(cheer.max > calm.mean * 3, 'the crowd reacts: a home run is over 3x the bed');
  ok(cheer.max < 0.9, 'nothing clips');

  console.log('4. Pausing in the middle of a cheer');
  await page.waitForFunction(() => window.__ms.state === 'homer', null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const loud = stats(await sample(page, 0.4));
  await page.click('#pauseBtn');
  await page.waitForTimeout(900);
  const pausedLevel = stats(await sample(page, 2.5));
  console.log('  just before pausing: ' + show(loud));
  console.log('  on the pause menu:   ' + show(pausedLevel));
  ok(pausedLevel.max < loud.mean * 0.35, 'pause drops the sound to a whisper within a second');
  ok(pausedLevel.mean > 0.0001, 'but it is not dead silent');
  ok(pausedLevel.max < 0.02, 'no cheer is left hanging on the pause menu');
  await page.click('#pauseBtn');
  await page.waitForTimeout(600);
  const resumed = stats(await sample(page, 1));
  ok(resumed.mean > pausedLevel.mean * 1.5, 'sound comes back on resume');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll sound checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
