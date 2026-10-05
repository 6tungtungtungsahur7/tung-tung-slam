// Taps every control on every screen with real pointer events and checks that nothing errors,
// nothing dead-ends, and every overlay can be left: `node tests/sweep.js`
const { open, installBot, shot } = require('./harness');
const { layoutProblems } = require('./layout');

let failures = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  ok    ' : '  FAIL  ') + msg);
  if (!cond) failures++;
};
const list = (a) => (a.length ? ':\n        ' + a.join('\n        ') : '');

/* Tap at an element's centre the way a finger does: pointer events plus the click that follows. */
async function tap(page, sel) {
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
  if (!box) throw new Error('no element ' + sel);
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(220);
}
const openOverlays = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.ovl')).filter((o) => !o.hidden).map((o) => '#' + o.id));
const visibleButtons = (page, root) =>
  page.evaluate((root) => {
    const r = document.querySelector(root);
    if (!r || r.hidden || r.closest('[hidden]')) return [];
    const all = Array.from(r.querySelectorAll('button'));
    all.forEach((b, i) => b.setAttribute('data-sw', i));
    return all
      .filter((b) => {
        if (b.disabled || b.hidden || b.closest('[hidden]')) return false;
        const cs = getComputedStyle(b),
          bb = b.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && bb.width > 2 && bb.height > 2;
      })
      .map((b) => (b.id ? '#' + b.id : '[data-sw="' + b.getAttribute('data-sw') + '"]'));
  }, root);

/* Leaves whatever overlay is open through its own controls, or reports that it cannot. */
async function leave(page, label) {
  for (let i = 0; i < 4; i++) {
    const open = await openOverlays(page);
    if (!open.length) return true;
    const top = open[open.length - 1],
      exit = await page.evaluate((id) => {
        const o = document.querySelector(id);
        const b = o.querySelector('.xbtn, #resumeBtn, #closeBtn, #homeBtn, #endBtn, #shareClose, .btn.gray');
        return b && !b.hidden && !b.closest('[hidden]') ? '#' + (b.id || '') : null;
      }, top);
    if (!exit || exit === '#') {
      ok(false, label + ': ' + top + ' has no way out');
      return false;
    }
    await tap(page, exit);
  }
  const still = await openOverlays(page);
  ok(!still.length, label + ': overlays close' + list(still));
  return !still.length;
}

(async () => {
  const { browser, page, errors } = await open(390, 844);
  await installBot(page);
  await page.evaluate(() => {
    window.__ms.seenAll();
    localStorage.setItem('ms_best', '12');
  });

  console.log('1. Settings from the lobby: open, tap the gear again, tap the dim area');
  await tap(page, '#gearBtn');
  ok((await openOverlays(page)).join() === '#sheet', 'gear opens settings');
  await tap(page, '#gearBtn'); // the sheet covers the gear: this tap lands on the dim area
  ok(!(await openOverlays(page)).length, 'tapping where the gear was closes settings and it stays closed');
  await tap(page, '#gearBtn');
  await page.mouse.click(195, 30);
  ok(!(await openOverlays(page)).length, 'tapping the dim area closes settings');
  await tap(page, '#gearBtn');
  await tap(page, '#sheetX');
  ok(!(await openOverlays(page)).length, 'the X closes settings');

  console.log('2. Every button in every lobby page');
  const skip = ['#playBtn', '#dailyBtn', '#ninthBtn', '#codeGo', '#recalBtn', '#restartBtn', '#quitBtn'];
  for (const t of ['Home', 'Shop', 'Awards', 'Ranks', 'Practice']) {
    await page.click(`[data-tab="${t}"]`);
    await page.waitForTimeout(250);
    const buttons = (await visibleButtons(page, '#lobby')).filter((b) => skip.indexOf(b) < 0);
    const isRunStarter = (b) => page.evaluate((s) => { const el = document.querySelector(s); return !!(el && (el.closest('#pracList') || el.classList.contains('tab'))); }, b);
    let tapped = 0;
    for (const b of buttons) {
      if (await isRunStarter(b)) continue; // practice cards start runs; tabs are the navigation itself
      const before = errors.length;
      try {
        await tap(page, b);
      } catch (e) {
        ok(false, t + ': could not tap ' + b + ' (' + e.message.split('\n')[0] + ')');
        continue;
      }
      tapped++;
      const state = await page.evaluate(() => window.__ms.state);
      if (state !== 'menu') {
        ok(false, t + ': ' + b + ' started a run');
        await page.evaluate(() => window.__ms.state);
        break;
      }
      if ((await openOverlays(page)).length) await leave(page, t + ' ' + b);
      // tapping may have switched tabs: come back
      await page.click(`[data-tab="${t}"]`);
      await page.waitForTimeout(120);
      ok(errors.length === before, t + ': ' + b + ' no errors' + list(errors.slice(before)));
    }
    console.log('       ' + t + ': tapped ' + tapped + ' buttons');
    const problems = await page.evaluate(layoutProblems);
    ok(!problems.length, t + ' layout clean after the sweep' + list(problems));
  }
  await page.click('[data-tab="Home"]');

  console.log('3. The pause menu, Awards and Stats from inside a run');
  await page.evaluate(() => (window.__botPlan = [0, 0, 0, 0, 0, 20, 20, 20, 20, 20, 20, 20, null, null, null]));
  await page.evaluate(() => (window.__skipRender = true));
  await tap(page, '#playBtn');
  await page.waitForFunction(() => /ready|windup|flight|taunt/.test(window.__ms.state) && window.__ms.run.streak >= 4, null, { timeout: 120000, polling: 10 });
  await page.evaluate(() => (window.__skipRender = false));
  await page.waitForTimeout(300);
  await tap(page, '#pauseBtn');
  ok((await openOverlays(page)).join() === '#sheet', 'pause opens the sheet');
  await tap(page, '#awardsBtn');
  ok((await openOverlays(page)).join() === '#awsheet', 'AWARDS opens the awards sheet in place of the pause sheet');
  const rows = await page.evaluate(() => document.querySelectorAll('#awList .award').length);
  ok(rows >= 30, 'the awards sheet lists the achievements (' + rows + ')');
  await shot(page, '60-awards-sheet');
  let problems = await page.evaluate(layoutProblems);
  ok(!problems.length, 'awards sheet layout clean' + list(problems));
  await tap(page, '#awX');
  ok((await openOverlays(page)).join() === '#sheet', 'closing Awards returns to the pause sheet');
  await tap(page, '#statsBtn');
  ok((await openOverlays(page)).join() === '#stats', 'STATS opens the career sheet');
  await tap(page, '#statsClose');
  ok((await openOverlays(page)).join() === '#sheet', 'closing Stats returns to the pause sheet');
  await tap(page, '#resumeBtn');
  ok(!(await openOverlays(page)).length && (await page.evaluate(() => !window.__ms.paused)), 'resume closes the sheet and unpauses');

  console.log('4. Earning, announcing and claiming');
  // a knockout and 10 in a row are on their way: the bar should announce and the chip should pay only on tap
  await page.evaluate(() => (window.__toasts = []));
  await page.evaluate(() => {
    const el = document.getElementById('toast');
    new MutationObserver(() => {
      if (!el.hidden && el.className === 'in') window.__toasts.push(document.getElementById('toastK').textContent + ' ' + document.getElementById('toastT').textContent);
    }).observe(el, { attributes: true });
  });
  await page.evaluate(() => (window.__skipRender = true));
  await page.waitForFunction(() => window.__ms.state === 'chance', null, { timeout: 180000, polling: 10 });
  await page.evaluate(() => (window.__skipRender = false));
  await page.waitForTimeout(200);
  await tap(page, '#endBtn');
  await page.waitForFunction(() => window.__ms.state === 'over', null, { timeout: 60000, polling: 10 });
  await page.waitForTimeout(900);
  const toasts = await page.evaluate(() => window.__toasts);
  ok(toasts.some((t) => /ACHIEVEMENT/.test(t)), 'an achievement was announced mid-run (' + toasts.join(' | ') + ')');
  const before = await page.evaluate(() => window.__ms.capCount);
  const chip = await page.evaluate(() => ({ hidden: document.getElementById('oCapsBox').hidden, text: document.getElementById('oCaps').textContent }));
  ok(!chip.hidden && /^\+\d+$/.test(chip.text), 'results card offers pizza to claim (' + chip.text + ')');
  ok(before === 0, 'nothing is paid before claiming (pizza ' + before + ')');
  await shot(page, '61-results-claim');
  await tap(page, '#oCapsBox');
  const after = await page.evaluate(() => ({ caps: window.__ms.capCount, done: document.getElementById('oCapsBox').classList.contains('done'), due: window.__ms.career.unclaimed.length }));
  ok(after.caps === +chip.text.slice(1) && after.done && after.due === 0, 'CLAIM pays exactly what was offered and empties the queue (pizza ' + after.caps + ')');
  await tap(page, '#oCapsBox');
  ok((await page.evaluate(() => window.__ms.capCount)) === after.caps, 'claiming twice pays nothing more');
  problems = await page.evaluate(layoutProblems);
  ok(!problems.length, 'results layout clean after claiming' + list(problems));
  await tap(page, '#homeBtn');
  await page.waitForTimeout(300);

  console.log('5. Profile tap and the pizza chip');
  await tap(page, '#profileBtn');
  ok((await openOverlays(page)).join() === '#stats', 'tapping your name opens the career sheet');
  await tap(page, '#statsX');
  ok(!(await openOverlays(page)).length, 'and the X closes it');
  await tap(page, '#capsBtn');
  ok(await page.evaluate(() => !document.getElementById('pgAwards').hidden), 'the pizza chip opens Awards');
  await tap(page, '#pgAwards .xbtn');
  ok(await page.evaluate(() => !document.getElementById('pgHome').hidden), 'the page X returns home');

  ok(!errors.length, 'no page errors' + list(errors));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll sweep checks passed');
  process.exit(failures ? 1 : 0);
})();
