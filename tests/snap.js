// Extra screenshots of short moments the main run does not stop on: `node tests/snap.js`
const { open, installBot, shot } = require('./harness');
const { layoutProblems } = require('./layout');
(async () => {
  const { browser, page, errors } = await open(390, 844);
  await installBot(page);
  const fast = (on) => page.evaluate((v) => (window.__skipRender = v), on);
  const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 120000, polling: 16 });
  const freeze = async (name) => {
    // stop the game clock by pausing rendering time: take the picture on the very next frame
    await fast(false);
    await page.waitForTimeout(260);
    await shot(page, name);
    console.log(name, JSON.stringify(await page.evaluate(layoutProblems)));
    await fast(true);
  };
  await fast(true);
  await page.evaluate(() => (window.__botPlan = [{ kind: 'hit', f: 0.5, sign: 1 }, { kind: 'foul', f: 0.5, sign: -1 }, 25, 25, 25, 60, 60, null, null, null]));
  await page.click('#playBtn');
  await until(() => document.querySelector('#verdict:not([hidden])') && /BASE HIT/.test(document.getElementById('verdict').textContent));
  await freeze('50-verdict-hit');
  await until(() => /FOUL/.test(document.getElementById('verdict').textContent) && !document.getElementById('verdict').hidden);
  await freeze('51-verdict-foul');
  await until(() => /FT$/.test(document.getElementById('verdict').textContent) && !document.getElementById('verdict').hidden);
  await freeze('52-homer-landed');
  await until(() => window.__ms.state === 'ko');
  await freeze('53-knockout');
  try {
    await until(() => window.__ms.state === 'taunt');
    await freeze('54-bluff');
  } catch (e) { console.log('no bluff this run'); }
  await until(() => window.__ms.state === 'chance');
  await page.click('#endBtn');
  await page.click('#homeBtn');
  // the final boss entrance, part way through the gathering
  await page.evaluate(() => (window.__botPlan = [0]));
  await page.click('#playBtn');
  await until(() => window.__ms.state === 'ready');
  await page.evaluate(() => (window.__ms.pitcher(6), window.__ms.streak(25)));
  await until(() => window.__ms.cutT !== null && window.__ms.cutT > 1900);
  await freeze('55-boss-gather');
  console.log('errors:', errors);
  await browser.close();
})();
