// Bot playthrough and layout checks. Plays every mode in headless Chromium, forces each outcome,
// and checks the layout on every frame.
//   node tests/play.js            everything (about 20 minutes)
//   node tests/play.js flow       lobby, a full streak run, chances, pause, knockouts, records, home run streak
//   node tests/play.js boss       the final boss and the four landing zones
//   node tests/play.js modes      Daily and day streak, practice, challenge codes, the 9th, warm-up, awards, ranks
//   node tests/play.js sizes      four other screen sizes
const { open, installBot, shot } = require('./harness');
const { layoutProblems } = require('./layout');

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log((cond ? '  ok    ' : '  FAIL  ') + msg);
};
const list = (p) => (p.length ? ':\n        ' + p.join('\n        ') : '');
const st = (page) => page.evaluate(() => window.__ms.state);
const ms = (page, fn, arg) => page.evaluate(fn, arg);
/* Gum waits to be claimed since v9: the results chip pays it out. */
async function claimIfOffered(page) {
  const offered = await page.evaluate(() => !document.getElementById('oCapsBox').hidden && !document.getElementById('oCapsBox').classList.contains('done'));
  if (offered) {
    await page.click('#oCapsBox');
    await page.waitForTimeout(150);
  }
}
async function waitState(page, want, timeout = 120000) {
  await page.waitForFunction((l) => l.includes(window.__ms.state), [].concat(want), { timeout, polling: 30 });
  return st(page);
}
const fast = (page, on) => page.evaluate((v) => (window.__skipRender = v), on);
const check = (page) => page.evaluate(layoutProblems);
async function snap(page, name, wait = 350) {
  await fast(page, false);
  await page.waitForTimeout(wait);
  await shot(page, name);
  await fast(page, true);
}
async function clean(page, label) {
  const lp = await check(page);
  ok(!lp.length, label + ' clean' + list(lp));
}

/* Samples the layout on every frame for `duration` ms and returns the distinct problems, tagged with the state. */
function watchLayout(page, duration) {
  return page.evaluate(
    ({ src, duration }) =>
      new Promise((resolve) => {
        const rules = new Function('return (' + src + ')')();
        const seen = new Set(),
          t0 = performance.now();
        const tick = () => {
          rules().forEach((p) => seen.add(window.__ms.state + ': ' + p));
          if (performance.now() - t0 < duration) requestAnimationFrame(tick);
          else resolve([...seen]);
        };
        tick();
      }),
    { src: layoutProblems.toString(), duration },
  );
}

/* Plays until one of `until` states, watching the layout the whole time. shots: { state: file name } */
async function play(page, plan, { until = ['chance', 'over'], label, shots = {}, timeout = 240000 } = {}) {
  // a plan that ends in a take keeps taking: three strikes end the at-bat now, not one
  if (plan && plan[plan.length - 1] === null) plan = plan.concat([null, null]);
  if (plan) await page.evaluate((p) => (window.__botPlan = p.slice()), plan);
  const problems = new Set(),
    seen = new Set(),
    t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await st(page);
    seen.add(s);
    if (until.includes(s)) break;
    (await watchLayout(page, 200)).forEach((p) => problems.add(p));
    if (shots[s]) {
      await snap(page, shots[s]);
      delete shots[s];
    }
  }
  if (label) console.log(`  ${label}: states seen = ${[...seen].join(', ')}`);
  return { problems: [...problems], seen };
}
const endRunFromChance = async (page) => {
  await page.click('#endBtn');
  await waitState(page, 'over');
};
const HOMER = { kind: 'homer', f: 0.5, sign: 1 },
  HIT = { kind: 'hit', f: 0.5, sign: 1 },
  FOUL = { kind: 'foul', f: 0.5, sign: -1 };

/* ============================================================== flow */
async function flow() {
  console.log('1. Lobby');
  const { browser, page, errors } = await open(390, 844);
  await installBot(page);
  ok((await st(page)) === 'menu', 'starts in the lobby');
  await clean(page, 'lobby');
  await ms(page, () => window.__ms.best(15));
  ok(await ms(page, () => document.getElementById('bestTag').textContent === 'BEST 15'), 'best streak shows as a badge on PLAY');
  ok(await ms(page, () => document.getElementById('capN').textContent === '0'), 'pizza balance is on the lobby');
  await clean(page, 'lobby with badge');
  await shot(page, '01-lobby');
  await ms(page, () => window.__ms.best(0));

  console.log('2. Streak run: grand slam, home run, base hit, foul, three strikes');
  await fast(page, true);
  await page.click('#playBtn');
  let res = await play(page, [0, HOMER, HIT, FOUL, HOMER, 5, null, null, null], { label: 'streak', shots: { windup: '02-windup', flight: '03-flight', homer: '04-homer', hit: '05-hit', foul: '06-foul' } });
  for (const s of ['windup', 'flight', 'grand', 'homer', 'hit', 'foul', 'ko', 'swap', 'miss', 'chance']) ok(res.seen.has(s), 'reached state: ' + s);
  ok(!res.problems.length, 'in-play layout clean' + list(res.problems));
  let run = await ms(page, () => ({ streak: window.__ms.run.streak, grands: window.__ms.run.grands, kos: window.__ms.run.kos.length, pitcher: window.__ms.pIdx, coins: window.__ms.run.coins, strikes: window.__ms.run.strikes }));
  console.log('  run so far', run);
  ok(run.streak === 5, 'streak counts hits and home runs, not the foul (got ' + run.streak + ')');
  ok(run.kos === 2 && run.pitcher === 2, 'each grand slam knocked a pitcher out');
  ok(run.strikes === 3, 'three strikes brought up the chance sheet (strikes ' + run.strikes + ')');
  ok(await ms(page, () => document.querySelectorAll('#ks i.on').length === 3), 'the scorebug shows three strike squares filled');

  console.log('3. The one paid second chance');
  await snap(page, '07-chance');
  await clean(page, 'chance sheet');
  let sheet = await ms(page, () => ({ sub: document.getElementById('reviveSub').textContent, off: document.getElementById('reviveBtn').disabled, caps: window.__ms.capCount }));
  ok(sheet.caps === 0 && /^NEEDS 1 SLICE/.test(sheet.sub) && sheet.off, 'without pizza the button says what it needs and is disabled ("' + sheet.sub + '")');
  await ms(page, () => window.__ms.caps(3));
  await page.click('#endBtn'); // re-open with gum: the sheet is filled on open
  await waitState(page, 'over');
  await page.click('#homeBtn');
  await page.click('#playBtn');
  res = await play(page, [HIT, HIT, null, null, null], { label: 'to strike three' });
  await ms(page, (p) => (window.__botPlan = p), [HIT, null]);
  await page.click('#reviveBtn');
  ok((await ms(page, () => window.__ms.capCount)) === 2 && (await ms(page, () => window.__ms.run.revived)), 'the chance took one slice and the run is back');
  ok(await ms(page, () => document.querySelectorAll('#ks i').length === 1), 'one strike square left after the chance');
  await waitState(page, 'over');
  ok(await ms(page, () => window.__ms.run.streak === 3 && window.__ms.run.bought === 1), 'one more strike ended the run with no second sheet (streak ' + (await ms(page, () => window.__ms.run.streak)) + ')');
  await page.click('#homeBtn');
  await page.click('#playBtn');
  res = await play(page, [0, HOMER, HIT, FOUL, HOMER, 5, null, null, null], { label: 'streak again' });
  await ms(page, () => (window.__ms.caps(0), window.__ms.run));
  sheet = await ms(page, () => ({ sub: document.getElementById('reviveSub').textContent }));
  await clean(page, 'chance sheet without caps');
  await page.click('#endBtn');
  await waitState(page, 'over');
  await snap(page, '09-results', 900);
  await clean(page, 'results sheet');
  const card = await ms(page, () => ({ cause: document.getElementById('cause').textContent + ' ' + document.getElementById('lastWhat').textContent, league: document.getElementById('leagueName').textContent + ' / ' + document.getElementById('leagueNote').textContent, goal: document.getElementById('goalText').textContent, caps: document.getElementById('oCaps').textContent, gains: document.getElementById('gains').textContent }));
  console.log('  results card:', JSON.stringify(card));
  ok(/No swing|early|late/.test(card.cause), 'results describe the last pitch');
  ok(/ROOKIE LEAGUE/.test(card.league) && /TO SINGLE-A/.test(card.league), 'results show this week\'s division and what the next one needs');
  ok(/^Next: /.test(card.goal), 'results name the next goal');
  ok(await ms(page, () => ['fpko', 'b2b', 'ko3'].some((id) => window.__ms.career.got.indexOf(id) >= 0)), 'the grand slams earned their achievements');
  await page.click('#shareBtn');
  await page.waitForTimeout(300);
  await clean(page, 'share sheet');
  ok(await ms(page, () => /^[0-9A-Z]{7}-5$/.test(document.getElementById('duelCode').textContent)), 'share sheet carries a challenge code for this run');
  await shot(page, '10-share');
  await page.click('#shareClose');
  await page.click('#homeBtn');
  ok((await st(page)) === 'menu', 'home button returns to the lobby');

  console.log('4. Pause: any moment, tap outside or the button to resume');
  await ms(page, () => ((window.__botPlan = []), (window.__botDefault = null)));
  await page.click('#playBtn');
  await waitState(page, 'flight');
  const before = await ms(page, () => window.__ms.pitchCount);
  await page.click('#pauseBtn');
  ok(await ms(page, () => window.__ms.paused && !document.getElementById('sheet').hidden), 'pause works while the ball is in the air');
  await snap(page, '11-pause', 300);
  await clean(page, 'pause sheet');
  await page.waitForTimeout(700);
  ok((await ms(page, () => window.__ms.pitchCount)) === before && (await st(page)) === 'ready', 'no pitch is thrown while paused');
  await page.mouse.click(8, 420);
  ok(await ms(page, () => !window.__ms.paused && document.getElementById('sheet').hidden), 'tapping outside the sheet resumes');
  await waitState(page, 'flight');
  ok((await ms(page, () => window.__ms.pitchCount)) === before + 1, 'the interrupted pitch was replaced by a new one');
  await page.click('#pauseBtn');
  await page.click('#pauseBtn');
  ok(await ms(page, () => !window.__ms.paused), 'the pause button also resumes');
  await page.click('#pauseBtn');
  await page.click('#quitBtn');
  await page.click('#quitBtn');
  ok((await st(page)) === 'menu', 'home (asked twice) returns to the lobby');
  await ms(page, () => (window.__botDefault = 0));

  console.log('5. Home runs in a row: the tag, the tiers, the end');
  await ms(page, () => window.__ms.best(3));
  await page.click('#playBtn');
  await ms(page, (p) => (window.__botPlan = p), [HOMER, HOMER, HOMER]);
  await page.waitForFunction(() => !document.getElementById('hrTag').hidden, null, { timeout: 120000, polling: 30 });
  let tag = await ms(page, () => document.getElementById('hrTag').textContent);
  ok(/×3/.test(tag) && /HOT BAT/.test(tag), 'tag appears at three in a row: "' + tag + '"');
  await snap(page, '12-hr-streak-3', 250);
  await waitState(page, ['ko', 'swap']);
  ok((await ms(page, () => window.__ms.run.kos.length)) === 1, 'three home runs also knocked Rookie out');
  res = await play(page, [HOMER, HOMER, HIT, null], { label: 'home run streak' });
  ok(!res.problems.length, 'layout clean through the streak and the record moment' + list(res.problems));
  run = await ms(page, () => ({ rec: window.__ms.run.rec.bestHrRun, now: window.__ms.run.hrRun, hidden: document.getElementById('hrTag').hidden, gold: document.getElementById('bug').classList.contains('gold'), coins: window.__ms.run.coins }));
  ok(run.rec === 5 && run.now === 0 && run.hidden, 'reached five in a row, then a base hit ended it and the tag left (best ' + run.rec + ')');
  ok(run.gold, 'scorebug turned gold after passing the old best of 3');
  await endRunFromChance(page);
  await snap(page, '13-record-results', 1100);
  ok(await ms(page, () => document.getElementById('over').classList.contains('record') && document.querySelectorAll('#confetti i').length > 20), 'results celebrate the record with confetti');
  ok(await ms(page, () => /Old best 3\. New best 6\./.test(document.getElementById('cause').textContent)), 'results show old best and new best');
  ok(await ms(page, () => document.getElementById('f2L').textContent === 'HR streak' && document.getElementById('f2').textContent === '5'), 'results show the home run streak');
  ok(await ms(page, () => /Hot Bat/.test(document.getElementById('gains').textContent) && /On Fire/.test(document.getElementById('gains').textContent)), 'the streak paid its two achievements');
  await clean(page, 'record results');
  await page.click('#homeBtn');

  await page.click('#playBtn');
  res = await play(page, Array(10).fill(HIT).concat([null]), { label: 'ten base hits' });
  run = await ms(page, () => ({ kos: window.__ms.run.kos.length, pitcher: window.__ms.pIdx, streak: window.__ms.run.streak }));
  ok(run.kos === 0 && run.pitcher === 1 && run.streak === 10, 'ten hits without a knockout: Rookie is pulled, no knockout credited');
  ok(!errors.length, 'no page errors' + list(errors));
  await browser.close();
}

/* ============================================================== boss */
async function boss() {
  console.log('6. The final boss');
  const { browser, page, errors } = await open(390, 844);
  await installBot(page);
  await fast(page, true);
  await page.click('#playBtn');
  await waitState(page, 'ready');
  await ms(page, () => (window.__ms.pitcher(6), window.__ms.streak(12), (window.__botPlan = [0, 0])));
  await waitState(page, ['grand']);
  await waitState(page, ['ready', 'taunt', 'windup']);
  ok((await ms(page, () => window.__ms.pIdx)) === 6, 'a knockout before streak 20 does not bring him in');
  await ms(page, (p) => (window.__ms.streak(21), (window.__botPlan = p)), [0, HOMER, HIT, HOMER, HIT, HOMER, HIT, null, null, null]);
  await waitState(page, 'cut', 120000);
  await page.waitForFunction(() => !document.getElementById('banner').hidden, null, { timeout: 120000 });
  await snap(page, '14-boss-reveal', 400);
  await clean(page, 'boss entrance');
  let res = await play(page, null, { label: 'vs final boss', shots: { windup: '15-boss-windup' } });
  const run = await ms(page, () => ({ pitcher: window.__ms.pIdx, level: window.__ms.run.mimicLevel, hits: window.__ms.run.mimicHits }));
  ok(run.pitcher === 7, 'final boss is pitching');
  ok(run.level >= 1, 'he learned something after ' + run.hits + ' hits (level ' + run.level + ')');
  ok(!res.problems.length, 'layout clean against the final boss' + list(res.problems));
  await endRunFromChance(page);
  await page.click('#homeBtn');

  console.log('7. Where grand slams land');
  for (const [mult, want, name] of [[1, /OFF THE LIGHTS|SCOREBOARD/, '19-land-park'], [1.5, /PARKING LOT/, '20-land-cars'], [2, /DOWNTOWN/, '21-land-city'], [2.5, /OUT OF TOWN/, '22-land-beyond'], [3, /MOONSHOT/, '23-land-moon']]) {
    await ms(page, (m) => (window.__ms.bat(m), (window.__forceRoll = 0.5), (window.__botPlan = [0, null, null, null])), mult);
    await page.click('#playBtn');
    await waitState(page, 'grand');
    await page.waitForFunction(() => document.getElementById('tier').textContent !== '', null, { timeout: 120000, polling: 30 });
    await fast(page, false);
    await page.waitForTimeout(700);
    const tier = await ms(page, () => document.getElementById('tier').textContent + ' ' + document.getElementById('distN').textContent);
    ok(want.test(tier), `bat x${mult} lands: ${tier}`);
    await clean(page, name + ' landing');
    await shot(page, name);
    await fast(page, true);
    await waitState(page, 'chance');
    await endRunFromChance(page);
    await page.click('#homeBtn');
  }
  ok(!errors.length, 'no page errors' + list(errors));
  await browser.close();
}

/* ============================================================== modes */
async function modes() {
  let { browser, page, errors } = await open(390, 844);
  await installBot(page);
  await fast(page, true);

  console.log('8. Daily Pitch: one cap a day, and a bonus on days 3, 5 and 7 in a row');
  const playDaily = async (date) => {
    await ms(page, (d) => ((window.__today = d), (window.__botPlan = [{ kind: 'hit', f: 0.5, sign: 1 }, null, null, null])), date);
    await page.click('[data-tab="Home"]');
    await page.click('#dailyBtn');
    await waitState(page, 'over'); // the Daily has no second chance: three strikes and it is over
    await claimIfOffered(page);
    const out = await ms(page, () => ({ caps: window.__ms.capCount, days: window.__ms.days.streak, gains: document.getElementById('gains').textContent }));
    await page.click('#homeBtn');
    return out;
  };
  let d = await playDaily('2026-10-05');
  ok(d.caps === 1 && d.days === 1 && /Daily Pitch played/.test(d.gains), 'first Daily of the day pays 1 cap (caps ' + d.caps + ', "' + d.gains + '")');
  d = await playDaily('2026-10-05');
  ok(d.caps === 1, 'a second Daily the same day pays nothing more');
  ok(await ms(page, () => /Played|Best today/.test(document.getElementById('dailySub').textContent)), 'the Daily tile says it was played');
  await snap(page, '30-daily-strip', 250);
  await clean(page, 'lobby with day strip');
  d = await playDaily('2026-10-06');
  ok(d.caps === 2 && d.days === 2, 'day two: streak 2, one more cap');
  d = await playDaily('2026-10-07');
  ok(d.caps === 4 && d.days === 3 && /3 days in a row/.test(d.gains), 'day three pays the streak bonus too (caps ' + d.caps + ')');
  d = await playDaily('2026-10-09');
  ok(d.days === 1 && d.caps === 5, 'missing a day resets the streak to 1 (caps ' + d.caps + ')');
  // the dots under the pitcher's name count the pitches faced against him: 1..5, then the change, then 1 again
  await ms(page, () => {
    window.__pips = [];
    let last = -1;
    const tick = () => {
      const m = window.__ms;
      if (m.state === 'flight' && m.pitchCount !== last) {
        last = m.pitchCount;
        window.__pips.push(document.querySelectorAll('#pips i:not(.off)').length);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  let res = await (async () => {
    await page.click('#dailyBtn');
    return play(page, [HOMER, HIT, HIT, HOMER, HIT, HIT, HOMER, null], { label: 'daily' });
  })();
  ok(res.seen.has('swap'), 'daily changes pitcher on schedule');
  ok(!res.problems.length, 'daily layout clean' + list(res.problems));
  const pips = await ms(page, () => window.__pips.join(','));
  ok(/^1,2,3,4,5,1,2/.test(pips), 'daily pips fill 1 to 5 and start over with the next pitcher (' + pips + ')');
  await waitState(page, 'over');
  await page.click('#homeBtn');

  console.log('9. Challenge a friend: the code replays the same pitch draws');
  const recordPitches = (n) =>
    page.evaluate(
      (n) =>
        new Promise((resolve) => {
          const out = [];
          let last = -1;
          const tick = () => {
            const m = window.__ms;
            if (m.pitch && m.pitchCount !== last && m.state === 'flight') {
              last = m.pitchCount;
              out.push(m.pitch.label + ' ' + m.pitch.mph + ' ' + m.pitch.launch.toFixed(3));
            }
            if (out.length >= n || m.state === 'over' || m.state === 'chance') return resolve(out);
            requestAnimationFrame(tick);
          };
          tick();
        }),
      n,
    );
  await ms(page, (p) => (window.__botPlan = p), [0, HOMER, HIT, HOMER, HIT, null, null, null]);
  await page.click('#playBtn');
  const first = await recordPitches(6);
  await waitState(page, 'chance');
  await endRunFromChance(page);
  await page.click('#shareBtn');
  const code = await ms(page, () => document.getElementById('duelCode').textContent);
  ok(/Same pitches, your turn: code /.test(await ms(page, () => document.getElementById('capTxt').textContent)), 'the caption carries the code');
  await page.click('#shareClose');
  await page.click('#homeBtn');
  await page.click('[data-tab="Practice"]');
  await page.waitForTimeout(150);
  await clean(page, 'practice tab');
  await shot(page, '31-practice-code');
  await page.fill('#codeIn', 'not a code');
  await page.click('#codeGo');
  ok((await st(page)) === 'menu' && (await ms(page, () => document.getElementById('codeMsg').textContent.length > 0)), 'a bad code is refused with a message');
  await page.fill('#codeIn', code.toLowerCase());
  await ms(page, (p) => (window.__botPlan = p), [0, HOMER, HIT, HOMER, HIT, HIT, HIT, null, null, null]);
  const coinsBefore = await ms(page, () => window.__ms.wallet);
  await page.click('#codeGo');
  ok((await ms(page, () => window.__ms.run.mode)) === 'challenge', 'the code starts a challenge run');
  const second = await recordPitches(6);
  ok(JSON.stringify(first) === JSON.stringify(second), 'same pitches both times: ' + first.slice(0, 3).join(' | '));
  res = await play(page, null, { label: 'challenge', until: ['over'] }); // a challenge has no second chance
  ok(!res.problems.length, 'challenge layout clean' + list(res.problems));
  await snap(page, '32-challenge-result', 800);
  const duel = await ms(page, () => ({ head: document.getElementById('overHead').textContent, again: document.getElementById('againBtn').textContent, wallet: window.__ms.wallet, earnHidden: document.getElementById('earnRow').hidden }));
  ok(duel.head === 'YOU WIN!' && duel.again === 'TRY AGAIN', 'beating the code says so (' + duel.head + ')');
  ok(duel.wallet === coinsBefore && duel.earnHidden, 'a challenge pays nothing');
  await clean(page, 'challenge results');
  await page.click('#homeBtn');

  console.log('10. Practice and the 9th (replayable in this test build)');
  await page.click('[data-tab="Practice"]');
  await ms(page, () => (window.__botPlan = [0, 300]));
  await page.click('#pracList button:nth-child(5)');
  await waitState(page, 'over');
  ok(await ms(page, () => window.__ms.run.mode === 'practice' && window.__ms.run.coins === 0), 'practice earns no coins');
  await page.click('#homeBtn');
  const capsBefore9 = await ms(page, () => window.__ms.capCount);
  for (const attempt of [1, 2]) {
    await ms(page, () => (window.__moodLock = null));
    await page.click(attempt === 1 ? '#ninthBtn' : '#againBtn');
    res = await play(page, [10, HIT, 0], { until: ['over'], label: '9th, attempt ' + attempt, shots: attempt === 1 ? { windup: '33-ninth-windup' } : {} });
    await claimIfOffered(page);
    const ninth = await ms(page, () => ({ shots: window.__ms.run.shots }));
    ok(ninth.shots.length === 3 && ninth.shots[1] === 0 && ninth.shots[0] > 0 && ninth.shots[2] > 0, 'the 9th counts home run feet only: ' + JSON.stringify(ninth.shots));
    ok(!res.problems.length, '9th layout clean' + list(res.problems));
  }
  ok((await ms(page, () => window.__ms.capCount)) >= capsBefore9 + 1, 'taking your shot in the 9th pays a cap once per week');
  await snap(page, '34-ninth-results', 800);
  await clean(page, '9th results');
  await page.click('#homeBtn');

  console.log('11. Awards, shop and ranks pages');
  await page.click('#capsBtn');
  await page.waitForTimeout(150);
  ok(await ms(page, () => !document.getElementById('pgAwards').hidden && document.querySelectorAll('#awardList .award').length >= 30 && document.querySelectorAll('#awardList .award.got, #awardList .award.ready').length >= 1), 'the caps button opens the awards page with progress');
  await clean(page, 'awards page');
  await shot(page, '35-awards');
  await page.click('[data-awards="cards"]');
  await page.waitForTimeout(100);
  await clean(page, 'pitcher cards');
  for (const tab of ['Shop', 'Ranks']) {
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForTimeout(150);
    await clean(page, tab + ' tab');
    await shot(page, '36-tab-' + tab.toLowerCase());
  }
  ok(await ms(page, () => /This week: /.test(document.getElementById('holderMsg').textContent)), 'ranks show this week\'s division');
  ok(!errors.length, 'no page errors' + list(errors));
  await browser.close();

  console.log('12. Warm-up on first launch');
  ({ browser, page, errors } = await open(390, 844));
  await installBot(page);
  await ms(page, () => ((window.__warmup = true), (window.__skipRender = true), (window.__botPlan = [-45, 30, 0])));
  await page.click('#playBtn');
  ok((await ms(page, () => window.__ms.run.mode)) === 'warmup', 'first PLAY starts the warm-up');
  await waitState(page, 'windup');
  await snap(page, '37-warmup', 300);
  ok(await ms(page, () => document.getElementById('vs').textContent === 'WARM-UP'), 'the scorebug says warm-up');
  res = await play(page, null, { until: ['never'], label: 'warm-up', timeout: 1 });
  await page.waitForFunction(() => window.__ms.run.mode === 'streak' && window.__ms.state !== 'menu', null, { timeout: 120000, polling: 30 });
  ok(true, 'after three swings the real run starts by itself');
  ok((await ms(page, () => window.__ms.run.streak)) === 0 && (await ms(page, () => window.__ms.wallet)) === 0, 'warm-up swings count for nothing');
  await ms(page, () => (window.__botPlan = [null, null, null]));
  await waitState(page, 'chance');
  await endRunFromChance(page);
  await page.click('#homeBtn');
  await page.click('#playBtn');
  ok((await ms(page, () => window.__ms.run.mode)) === 'streak', 'the warm-up only happens once');
  ok(!errors.length, 'no page errors' + list(errors));
  await browser.close();
}

/* ============================================================== sizes */
async function sizes() {
  console.log('13. Screen sizes');
  for (const [w, h] of [[320, 568], [360, 740], [430, 932], [768, 1024]]) {
    const { browser, page, errors } = await open(w, h);
    await installBot(page);
    const at = `${w}x${h} `;
    await ms(page, () => (window.__ms.best(2), window.__ms.caps(12)));
    await clean(page, at + 'lobby');
    await shot(page, `40-lobby-${w}`);
    for (const tab of ['Awards', 'Practice', 'Ranks', 'Shop']) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForTimeout(120);
      await clean(page, at + tab + ' tab');
    }
    await page.click('[data-tab="Awards"]');
    await shot(page, `41-awards-${w}`);
    await page.click('[data-tab="Home"]');
    await page.click('#gearBtn');
    await page.waitForTimeout(200);
    await clean(page, at + 'settings');
    await page.click('#closeBtn');
    await fast(page, true);
    await page.click('#playBtn');
    const res = await play(page, [HOMER, HOMER, HOMER, 0, HIT, FOUL, HOMER, null], { label: at.trim(), shots: { flight: `42-flight-${w}`, homer: `43-homer-${w}` } });
    ok(!res.problems.length, at + 'in-play clean' + list(res.problems));
    await snap(page, `44-chance-${w}`, 300);
    await clean(page, at + 'chance sheet');
    await endRunFromChance(page);
    await snap(page, `45-results-${w}`, 900);
    await clean(page, at + 'results');
    await page.click('#shareBtn');
    await page.waitForTimeout(250);
    await clean(page, at + 'share sheet');
    ok(!errors.length, at + 'no page errors' + list(errors));
    await browser.close();
  }
}

const PARTS = { flow, boss, modes, sizes };
(async () => {
  const want = process.argv[2];
  for (const name in PARTS) if (!want || want === name) await PARTS[name]();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll play checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
