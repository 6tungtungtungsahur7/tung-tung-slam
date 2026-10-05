// Pace check: `node tests/pace.js`
// A bot plays 30 pitches with a normal mix of outcomes, as a returning player. The run must average under 4.0 s per pitch
// (3.8 before base hits obeyed gravity; bluffs are random, so single runs swing by about 0.2 s)
// and spend less than a third of its time waiting between pitches.
const { open, installBot } = require('./harness');
(async () => {
  const { browser, page, errors } = await open(390, 844);
  await installBot(page);
  const plan = [];
  for (let i = 0; i < 30; i++) plan.push({ kind: ['hit', 'homer', 'hit', 'foul', 'homer', 'hit'][i % 6], f: 0.5, sign: i % 2 ? 1 : -1 });
  plan.push(300, 300, 300); // three strikes
  // a returning player: every pitch type has been introduced already
  await page.evaluate((p) => { window.__skipRender = true; window.__botPlan = p; window.__ms.seenAll(); }, plan);
  await page.click('#playBtn');
  const r = await page.evaluate(() => new Promise((resolve) => {
    const by = {}, t0 = performance.now(); let last = performance.now(), prev = window.__ms.state, first = null;
    const tick = () => {
      const now = performance.now(), s = window.__ms.state;
      by[prev] = (by[prev] || 0) + (now - last); last = now; prev = s;
      if (first === null && s === 'windup') first = now - t0;
      if (s === 'chance' || s === 'over') return resolve({ by, total: now - t0, pitches: window.__ms.pitchCount, streak: window.__ms.run.streak, first });
      requestAnimationFrame(tick);
    };
    tick();
  }));
  const sum = (ks) => ks.reduce((a, k) => a + (r.by[k] || 0), 0) / 1000;
  const waiting = sum(['ready', 'taunt', 'intro', 'ko', 'swap', 'cut']), pitching = sum(['windup', 'flight', 'lead']), watching = sum(['hit', 'homer', 'foul', 'grand', 'hitstop', 'miss']);
  const perPitch = r.total / 1000 / r.pitches, share = (waiting * 1000) / r.total;
  console.log(`${r.pitches} pitches, streak ${r.streak}, ${(r.total / 1000).toFixed(0)} s: ${perPitch.toFixed(1)} s per pitch. First pitch ${(r.first / 1000).toFixed(1)} s after PLAY.`);
  console.log(`  waiting between pitches ${waiting.toFixed(0)} s (${Math.round(share * 100)}%), the pitch itself ${pitching.toFixed(0)} s, watching the result ${watching.toFixed(0)} s`);
  console.log('  seconds by state:', JSON.stringify(Object.fromEntries(Object.entries(r.by).map(([k, v]) => [k, +(v / 1000).toFixed(1)]))));
  let failures = 0;
  const ok = (c, m) => { if (!c) failures++; console.log((c ? '  ok    ' : '  FAIL  ') + m); };
  ok(perPitch <= 4.0, 'under 4.0 s per pitch (was 5.1)');
  ok(share <= 0.33, 'under a third of the run is waiting (was 37%)');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nPace checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
