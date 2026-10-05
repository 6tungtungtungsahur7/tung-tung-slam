/* ============================================================================
   BOARDS. Online ranks. Names come from the account, nothing to type.
   Stored per player:  scores/{id} = best streak, longest ball, chances bought in that run,
                                     plus this week's best (wk, wkBest) for divisions and "top X%"
                       daily/{id}  = today's best      ninth/{id} = one entry per weekly event
   TESTING (CFG.TEST_REPLAY): every Daily and 9th attempt is also kept in a `tries` list and
   shown as its own row ("You #2"), as if a new player had posted it.
   ============================================================================ */
const num = (v) => {
  v = +v;
  return Number.isFinite(v) ? clamp(Math.round(v), 0, 99999) : 0;
};
let me = null;
const nameCache = {};
const short = (n) => {
  n = String(n || '').trim();
  if (!n) return 'Player';
  const p = n.split(/\s+/);
  return (p[0] + (p[1] ? ' ' + p[1][0] + '.' : '')).slice(0, 16);
};
const rowName = (r) =>
  (r.id === uid ? (short(me && me.name) === 'Player' ? 'You' : short(me.name) + ' (you)') : short(nameCache[r.id])) +
  (r.n > 1 ? ' #' + r.n : '');
const MAX_TRIES = 20;
function jerseyName() {
  const n = String((me && me.name) || '')
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 8);
  return n || 'YOU';
}
async function resolveNames() {
  if (!user) return;
  const ids = [];
  for (const k in boards)
    boards[k].forEach((r) => {
      if (!(r.id in nameCache) && ids.indexOf(r.id) < 0) ids.push(r.id);
    });
  if (holder && !(holder.id in nameCache) && ids.indexOf(holder.id) < 0) ids.push(holder.id);
  if (!ids.length) return;
  try {
    const ps = await user.profiles(ids);
    ids.forEach((id) => {
      nameCache[id] = (ps[id] && ps[id].name) || '';
    });
    renderBoards(true);
  } catch (e) {
    ids.forEach((id) => {
      nameCache[id] = '';
    });
  }
}
function fillBoard(el, k, n) {
  el.textContent = '';
  const note = (t) => {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = t;
    el.append(li);
  };
  if (boardState === 'wait') {
    note('Connecting…');
    return;
  }
  if (boardState === 'off') {
    note('Ranks are live when this page is open in Claude. Your bests still save on this device.');
    return;
  }
  const rows = boards[k];
  if (!rows.length) {
    note(
      k === 'daily'
        ? 'Nobody has posted today. The first score is yours.'
        : k === 'ninth'
          ? 'Nobody has taken their shot this week.'
          : 'No scores yet. The first one is yours.',
    );
    return;
  }
  rows.slice(0, n).forEach((r, i) => {
    const li = document.createElement('li');
    li.className = (r.id === uid ? 'me ' : '') + (holder && r.id === holder.id ? 'gb' : '');
    [
      ['rk', i + 1],
      ['in', rowName(r)],
      ['st', k === 'bomb' ? r.bomb + ' ft' : k === 'ninth' ? fmt(r.feet) + ' ft' : r.streak],
    ].forEach((c) => {
      const s = document.createElement('span');
      s.className = c[0];
      s.textContent = c[1];
      li.append(s);
    });
    if (k === 'streak' && r.buys) {
      // this streak used bought chances: say how many
      const tag = document.createElement('em');
      tag.className = 'buys';
      tag.textContent = '+' + r.buys;
      tag.title = r.buys + ' extra chances bought';
      li.children[1].append(tag);
    }
    el.append(li);
  });
}
function renderBoards(skipNames) {
  fillBoard($('boardM'), tab, 20);
  $('holderMsg').textContent =
    tab === 'ninth'
      ? (holder
          ? 'Golden Bat: ' + short(nameCache[holder.id]) + ', ' + fmt(holder.feet) + ' ft last week. '
          : 'No Golden Bat holder yet. ') +
        'This week closes in ' +
        nextEventIn() +
        '.'
      : tab === 'daily'
        ? 'Resets in ' + dayEndsIn() + '.'
        : tab === 'streak'
          ? divisionLine()
          : '';
  if (state === 'over') rankLine();
  if (state === 'menu') lobbySync();
  if (!skipNames) resolveNames();
}
/* "This week: DOUBLE-A, best 27. 8 more for TRIPLE-A." plus the percentile once enough people play. */
function divisionLine() {
  const wkBest = weekRec.event === eventId() ? weekRec.best : 0,
    d = divisionOf(wkBest),
    pct = percentileOf(wkBest, boards.week.map((r) => r.wkBest));
  return (
    'This week: ' + d.name + (wkBest ? ', best ' + wkBest : '') + '.' +
    (d.next ? ' ' + d.toNext + ' more for ' + d.next.name + '.' : '') +
    (pct && wkBest ? ' Top ' + pct + '% of ' + boards.week.length + ' players.' : '') +
    ' Divisions reset in ' + nextEventIn() + '.'
  );
}
function rankLine() {
  if (run.mode === 'practice' || boardState !== 'live' || !uid) {
    $('rankMsg').textContent = '';
    return;
  }
  const k = run.mode === 'ninth' ? 'ninth' : run.mode === 'daily' ? 'daily' : 'streak',
    mine = boards[k].filter((r) => r.id === uid),
    latest = mine.reduce((a, r) => (!a || (r.n || 1) > (a.n || 1) ? r : a), null),
    i = boards[k].indexOf(CFG.TEST_REPLAY && latest ? latest : mine[0]);
  $('rankMsg').textContent = i < 0 ? '' : 'RANK #' + (i + 1) + (k === 'ninth' ? ' OF ' + boards.ninth.length : '');
}
async function postScore() {
  if (posting || !db || !uid || run.posted) return;
  posting = true;
  run.posted = true;
  try {
    const ref = db.doc('scores/' + uid),
      snap = await ref.get(),
      prev = snap.exists ? snap.data() || {} : {};
    const next = { streak: Math.max(num(prev.streak), best), bomb: Math.max(num(prev.bomb), bestBomb), buys: num(prev.buys), wk: weekRec.event || '', wkBest: num(weekRec.best), at: Date.now() };
    if (run.mode === 'streak' && run.streak > num(prev.streak)) next.buys = num(run.bought); // chances bought in the record run
    if (
      (next.streak > 0 || next.bomb > 0) &&
      !(snap.exists && next.streak === num(prev.streak) && next.bomb === num(prev.bomb) && next.wk === prev.wk && next.wkBest === num(prev.wkBest))
    )
      await ref.set(next);
    const t = today();
    if (dailyRec.day === t && dailyRec.streak > 0) {
      const r2 = db.doc('daily/' + uid),
        s2 = await r2.get(),
        p2 = s2.exists ? s2.data() || {} : {},
        same = p2.day === t;
      const n2 = {
        day: t,
        streak: Math.max(same ? num(p2.streak) : 0, dailyRec.streak),
        bomb: Math.max(same ? num(p2.bomb) : 0, dailyRec.bomb || 0),
        at: Date.now(),
      };
      let changed = !(same && n2.streak === num(p2.streak) && n2.bomb === num(p2.bomb));
      if (CFG.TEST_REPLAY && run.mode === 'daily' && run.streak > 0) {
        n2.tries = (same && Array.isArray(p2.tries) ? p2.tries : []).concat({ streak: num(run.streak), bomb: num(run.bomb) }).slice(-MAX_TRIES);
        changed = true;
      }
      if (changed) await r2.set(n2);
    }
    if (ninthRec.done && ninthRec.event) {
      const r3 = db.doc('ninth/' + uid),
        s3 = await r3.get(),
        p3 = s3.exists ? s3.data() || {} : {},
        e = {},
        old = p3.e || {};
      Object.keys(old)
        .sort()
        .slice(-7)
        .forEach((k) => {
          e[k] = { feet: num(old[k].feet), best: num(old[k].best) };
        });
      const entry = { feet: num(ninthRec.feet), best: num(Math.max.apply(null, ninthRec.shots.concat(0))) };
      if (CFG.TEST_REPLAY && run.mode === 'ninth') {
        const before = old[ninthRec.event] || {},
          tries = (Array.isArray(before.tries) ? before.tries : []).concat(entry).slice(-MAX_TRIES);
        e[ninthRec.event] = { feet: Math.max(num(before.feet), entry.feet), best: Math.max(num(before.best), entry.best), tries };
        await r3.set({ e, at: Date.now() });
      } else if (!e[ninthRec.event]) {
        e[ninthRec.event] = entry;
        await r3.set({ e, at: Date.now() });
      }
    }
    $('postMsg').textContent = '';
  } catch (e) {
    $('postMsg').textContent =
      e && e.code === 'invalid_argument'
        ? 'This link is view-only for you, so scores stay on this device.'
        : 'Could not reach the ranks. Your bests are saved on this device.';
  }
  posting = false;
}
async function bootBoard() {
  if (!window.claude || !window.claude.use) {
    boardState = 'off';
    renderBoards();
    return;
  }
  try {
    [db, user, dl] = await Promise.all([
      window.claude.use('db'),
      window.claude.use('user'),
      window.claude.use('downloads'),
    ]);
    if (user) {
      uid = await user.id();
      me = await user.me();
      dressBatter();
      lobbySync();
    }
    if (!db) {
      boardState = 'off';
      renderBoards();
      return;
    }
    const rows = (s) =>
      s.docs.map((d) => {
        const v = d.data() || {};
        return { id: d.id, streak: num(v.streak), bomb: num(v.bomb), buys: num(v.buys), tries: v.tries };
      });
    /* One row per attempt when a player has a `tries` list, otherwise one row per player. */
    const expand = (list, make) => {
      const out = [];
      list.forEach((r) => {
        if (Array.isArray(r.tries) && r.tries.length) r.tries.forEach((t, i) => out.push(Object.assign({ id: r.id, n: i + 1 }, make(t))));
        else out.push(r);
      });
      return out;
    };
    db.collection('scores')
      .orderBy('streak', 'desc')
      .limit(25)
      .onSnapshot(
        (s) => {
          boards.streak = rows(s)
            .filter((r) => r.streak > 0)
            .sort((a, b) => b.streak - a.streak || b.bomb - a.bomb);
          boardState = 'live';
          renderBoards();
        },
        () => {
          boardState = 'off';
          renderBoards();
        },
      );
    db.collection('scores')
      .orderBy('bomb', 'desc')
      .limit(25)
      .onSnapshot(
        (s) => {
          boards.bomb = rows(s)
            .filter((r) => r.bomb > 0)
            .sort((a, b) => b.bomb - a.bomb);
          renderBoards();
        },
        () => {},
      );
    // everyone who has played a streak run this week: sets "top X%" once enough players exist
    db.collection('scores')
      .where('wk', '==', eventId())
      .limit(500)
      .onSnapshot(
        (s) => {
          boards.week = s.docs.map((d) => ({ id: d.id, wkBest: num((d.data() || {}).wkBest) })).filter((r) => r.wkBest > 0);
          renderBoards();
        },
        () => {},
      );
    db.collection('daily')
      .where('day', '==', today())
      .limit(100)
      .onSnapshot(
        (s) => {
          boards.daily = expand(rows(s), (t) => ({ streak: num(t.streak), bomb: num(t.bomb) }))
            .filter((r) => r.streak > 0)
            .sort((a, b) => b.streak - a.streak || b.bomb - a.bomb);
          checkPlacings();
          renderBoards();
        },
        () => {},
      );
    db.collection('ninth')
      .limit(500)
      .onSnapshot(
        (s) => {
          const ev = eventId(),
            lv = lastEventId(),
            cur = [],
            prev = [];
          s.docs.forEach((d) => {
            const v = d.data() || {},
              e = v.e || {};
            if (e[ev]) cur.push({ id: d.id, feet: num(e[ev].feet), bomb: num(e[ev].best), tries: e[ev].tries });
            if (e[lv]) prev.push({ id: d.id, feet: num(e[lv].feet) });
          });
          boards.ninth = expand(cur, (t) => ({ feet: num(t.feet), bomb: num(t.best) })).sort((a, b) => b.feet - a.feet || b.bomb - a.bomb);
          prev.sort((a, b) => b.feet - a.feet);
          boards.ninthPrev = prev;
          holder = prev[0] || null;
          goldBat();
          checkPlacings();
          renderBoards();
        },
        () => {},
      );
  } catch (e) {
    boardState = 'off';
    renderBoards();
  }
}

/* ---------- the short board on the results card ---------- */
/* Until a board has enough real players, mock ones fill it in so the card always shows a race.
   Deterministic per day, so the same faces show up all day. */
const MOCK_NAMES = ['MAYA', 'DIEGO', 'KENJI', 'PRIYA', 'LUCAS', 'ZOE', 'OMAR', 'NINA', 'THEO', 'IVY', 'MATEO', 'SOFIA', 'JONAH', 'ELLA', 'RAVI'];
function mockBoard(myScore, seedText, count) {
  let h = hashStr(seedText);
  const rng = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
  const names = MOCK_NAMES.slice().sort(() => rng() - 0.5).slice(0, count);
  // spread the field around the player's score: a few ahead, most behind
  return names.map((n, i) => ({ id: 'mock' + i, name: n, score: Math.max(1, Math.round(myScore * (i < 2 ? 1.25 + rng() * 0.6 : 0.3 + rng() * 0.65) + (i < 2 ? 1 : 0))), mock: true }));
}
function renderResultBoard() {
  const box = $('oBoard'),
    el = $('oBoardList'),
    mode = run.mode,
    daily = mode === 'daily';
  if (mode !== 'streak' && mode !== 'daily') return (box.hidden = true);
  const mine = daily ? dailyBest() : run.streak,
    key = daily ? today() : eventId();
  $('oBoardL').textContent = daily ? 'TODAY' : 'THIS WEEK';
  // real rows first, one per player, best score each
  const real = {};
  (daily ? boards.daily : boards.week).forEach((r) => {
    const sc = daily ? r.streak : r.wkBest;
    if (r.id !== uid && sc > 0) real[r.id] = Math.max(real[r.id] || 0, sc);
  });
  let rows = Object.keys(real).map((id) => ({ id, name: short(nameCache[id]), score: real[id] }));
  if (rows.length < 6) rows = rows.concat(mockBoard(Math.max(mine, 3), key + mode, 6 - rows.length));
  rows.push({ id: uid || 'me', name: 'You', score: mine, me: true });
  rows.sort((a, b) => b.score - a.score);
  const at = rows.findIndex((r) => r.me),
    show = [];
  // the top three, then you with one neighbour either side, with a gap marker between
  for (let i = 0; i < rows.length; i++) if (i < 3 || Math.abs(i - at) <= 1) show.push(i);
  el.textContent = '';
  let last = -1;
  show.forEach((i) => {
    if (last >= 0 && i > last + 1) {
      const gap = document.createElement('li');
      gap.className = 'gap';
      gap.textContent = '···';
      el.append(gap);
    }
    last = i;
    const r = rows[i],
      li = document.createElement('li');
    li.className = (r.me ? 'me ' : '') + (r.mock ? 'mock' : '');
    [['rk', i + 1], ['in', r.name], ['st', r.score]].forEach((c) => {
      const sp = document.createElement('span');
      sp.className = c[0];
      sp.textContent = c[1];
      li.append(sp);
    });
    el.append(li);
  });
  box.hidden = false;
}
