// Framing check: `node tests/frame.js`
// The camera only moves for a grand slam, so every other batted ball must stay on screen and clear
// of the scorebug for its whole flight. A bot hits 36 balls and the ball's screen position is
// sampled on every frame.
const { open, installBot } = require('./harness');

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log((cond ? '  ok    ' : '  FAIL  ') + msg);
};

(async () => {
  for (const [w, h] of [[390, 844], [320, 568], [430, 932]]) {
    const { browser, page, errors } = await open(w, h);
    await installBot(page);
    const plan = [];
    for (const kind of ['homer', 'hit', 'foul']) for (let i = 0; i < 12; i++) plan.push({ kind, f: i / 11, sign: i % 2 ? 1 : -1 });
    plan.push(300);
    await page.evaluate((p) => { window.__skipRender = true; window.__botPlan = p; }, plan);
    await page.click('[data-tab="Practice"]');
    await page.click('#pracList button:nth-child(1)');
    const rows = await page.evaluate(() => new Promise((resolve) => {
      const out = [], H = document.getElementById('stage').getBoundingClientRect().height;
      let cur = null, last = '';
      const hudBottom = () => document.querySelector('.bug').getBoundingClientRect().bottom / H;
      const tick = () => {
        const ms = window.__ms, s = ms.state;
        if (['homer', 'hit', 'foul'].includes(s)) {
          if (s !== last || !cur) { cur = { kind: s, frames: 0, clear: 0, minY: 9, maxX: 0, endClear: false }; out.push(cur); }
          const b = ms.ballXY;
          if (b) {
            cur.frames++;
            const clear = !b.behind && b.x >= 0.02 && b.x <= 0.98 && b.y > hudBottom() && b.y < 0.98;
            if (clear) cur.clear++;
            cur.minY = Math.min(cur.minY, b.y);
            cur.maxX = Math.max(cur.maxX, Math.abs(b.x - 0.5));
            cur.endClear = clear;
          }
        } else cur = null;
        last = s;
        if (s === 'over' || s === 'chance') return resolve(out);
        requestAnimationFrame(tick);
      };
      tick();
    }));
    console.log(`${w}x${h}`);
    for (const kind of ['homer', 'hit', 'foul']) {
      const set = rows.filter((r) => r.kind === kind && r.frames > 3),
        avg = (f) => set.reduce((a, r) => a + f(r), 0) / set.length,
        share = avg((r) => r.clear / r.frames),
        ends = avg((r) => (r.endClear ? 1 : 0));
      ok(set.length >= 10 && share >= 0.985 && ends === 1,
        `${kind.padEnd(5)} ${set.length} balls: in clear view ${(share * 100).toFixed(1)}% of the flight, visible at the end ${(ends * 100).toFixed(0)}%, highest ${(Math.min(...set.map((r) => r.minY)) * 100).toFixed(0)}% from the top, widest ${(Math.max(...set.map((r) => r.maxX)) * 200).toFixed(0)}% of half the screen`);
    }
    ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll framing checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
