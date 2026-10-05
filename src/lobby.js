/* ---------- lobby, tabs, shop, cards ---------- */
const IC = {
  ball: '<circle cx="12" cy="12" r="9"/><path d="M5.6 6.4c2.6 3 2.6 8.2 0 11.2M18.4 6.4c-2.6 3-2.6 8.2 0 11.2"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cap: '<path d="M4 16a7 7 0 0 1 14 0H4z"/><path d="M18 16h4M11 9v0"/>',
  gum: '<circle cx="12" cy="9.5" r="6.5" fill="currentColor" stroke="none"/><circle cx="9.6" cy="7.2" r="1.6" fill="#fff" stroke="none" opacity=".8"/><path d="M8.5 18.5c1.2.8 2.3 1.2 3.5 1.2s2.3-.4 3.5-1.2M10 16.2l2 1.4 2-1.4"/>',
  // a cheesy pepperoni slice: crust along the top, cheese, three pepperoni
  pizza: '<path d="M3.5 6.5C8 4.2 16 4.2 20.5 6.5L12 21.5z" fill="#ffc83d" stroke="#1a0f08" stroke-width="1.8"/><path d="M3.5 6.5C8 4.2 16 4.2 20.5 6.5l-.9 1.9C15.6 6.4 8.4 6.4 4.4 8.4z" fill="#c98a00" stroke="none"/><circle cx="9" cy="10" r="1.7" fill="#e8402a" stroke="none"/><circle cx="14.6" cy="10.6" r="1.7" fill="#e8402a" stroke="none"/><circle cx="12" cy="15" r="1.7" fill="#e8402a" stroke="none"/>',
  cup: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  aim: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  pause:
    '<rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  flame: '<path d="M12 3c1 3.2 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.8.7-3 1.6-4 .3 1.6 1.2 2.3 1.9 2.3C11.6 8.4 10.8 5.6 12 3z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
  home: '<path d="M4 11l8-7 8 7M6.5 10v9h11v-9"/>',
  redo: '<path d="M19 12a7 7 0 1 1-2.2-5.1M19 4v4h-4"/>',
  sound: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  vib: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 9v6M20 9v6"/>',
  heart: '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>',
  bat: '<path d="M4 20l2.5-2.5M6.5 17.5L16 8a3 3 0 0 1 4.5-4 3 3 0 0 1-4 4.5"/>',
  park: '<path d="M3 18a9 9 0 0 1 18 0H3z"/><path d="M12 9v9M7.5 11l4.5 7M16.5 11L12 18"/>',
  flag: '<path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6"/>',
  ko: '<path d="M7 11V8a2 2 0 0 1 4 0v3M11 10V6.5a2 2 0 0 1 4 0V10M15 10V8a2 2 0 0 1 4 0v4c0 4-2.5 7-6.5 7S6 16 6 13v-2a2 2 0 0 1 1-1.7"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8-4.3-4.1 5.9-.8z"/>',
  podium: '<path d="M9 20v-9h6v9M3 20v-5h6v5M15 20v-7h6v7M2 20h20M12 3l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 9l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
};
const ic = (n, sz) =>
  '<svg viewBox="0 0 24 24" width="' +
  (sz || 22) +
  '" height="' +
  (sz || 22) +
  '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  IC[n] +
  '</svg>';
document
  .querySelectorAll('[data-ic]')
  .forEach((e) => e.insertAdjacentHTML('afterbegin', ic(e.dataset.ic, +e.dataset.sz || 22)));
function dayEndsIn() {
  const n = new Date(),
    ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n,
    h = Math.floor(ms / 36e5);
  return h ? h + 'h ' + Math.floor((ms % 36e5) / 6e4) + 'm' : Math.floor(ms / 6e4) + 'm';
}
function lobbySync() {
  const nm = short(me && me.name);
  $('pName').textContent = nm === 'Player' ? 'You' : nm;
  // the top bar is narrow: big balances are shortened so the name beside them never gets squeezed
  $('coinN').textContent = coins >= 10000 ? (coins / 1000).toFixed(coins >= 100000 ? 0 : 1) + 'K' : fmt(coins);
  $('capN').textContent = caps;
  $('bestTag').textContent = best ? 'BEST ' + best : '';
  const av = $('pAva');
  if (me && me.avatarUrl) {
    if (!av.firstElementChild) {
      av.textContent = '';
      const im = document.createElement('img');
      im.alt = '';
      im.src = me.avatarUrl;
      av.append(im);
    }
  } else av.textContent = (nm === 'Player' ? 'Y' : nm[0]).toUpperCase();
  // Daily Pitch: today's best or today's reward, and the seven-day strip
  const d2 = dailyBest(),
    days = dayStreakDots();
  $('dailySub').textContent = days.playedToday ? (d2 ? 'Best today ' + d2 : 'Played') : 'Same pitches for all';
  $('dailyTag').textContent = dayEndsIn();
  // the world: today's top streak and how many are in, once the board is live
  const dl = boards.daily || [],
    dTop = dl.reduce((a, r) => Math.max(a, r.streak || 0), 0),
    dN = new Set(dl.map((r) => r.id)).size;
  $('dailyMeta').textContent = dN ? 'World best ' + dTop + ' · ' + dN + (dN === 1 ? ' player' : ' players') : 'Resets at midnight';
  // the day streak flame by the player's name
  $('dayFire').hidden = days.streak < 2;
  $('dayFireN').textContent = days.streak;
  const played = ninthPlayed(),
    mine = boards.ninth.find((r) => r.id === uid),
    ft = mine ? mine.feet : ninthRec.event === eventId() ? ninthRec.feet : 0;
  $('ninthSub').textContent = played ? 'Your shot: ' + fmt(ft) + ' ft' : 'Win the Golden Bat';
  $('ninthTag').textContent = played ? nextEventIn() : '1 SHOT';
  $('ninthMeta').textContent = holder ? 'Holder ' + short(nameCache[holder.id]) + ' · ' + fmt(holder.feet) + ' ft' : 'No holder yet';
}
const TABS = ['Home', 'Shop', 'Awards', 'Ranks', 'Practice'];
function goTab(t) {
  if (state !== 'menu') showMenu();
  TABS.forEach((n) => {
    $('pg' + n).hidden = n !== t;
  });
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('sel', b.dataset.tab === t));
  if (t === 'Ranks') renderBoards();
  if (t === 'Awards') renderAwards();
  if (t === 'Home') lobbySync();
}
function setBoard(t) {
  tab = t;
  document.querySelectorAll('[data-board]').forEach((x) => x.classList.toggle('sel', x.dataset.board === t));
  renderBoards();
}
const SHOP = {
  shopBats: [
    ['Maple Slugger', 'A little more carry.', 500, 'bat', '#e8c88f'],
    ['Thunder Stick', 'Long balls go longer.', 1500, 'bat', '#5ec4c4'],
    ['Moon Bat', 'Built for orbit.', 5000, 'bat', '#b38cf0'],
    ['Golden Bat', 'Win the 9th to hold it.', null, 'bat', '#ffc83d'],
  ],
  shopParks: [
    ['Sandlot', 'Sunny afternoon.', 800, 'park', '#9be06a'],
    ['Night Dome', 'Lights and lasers.', 2500, 'park', '#7a9cff'],
    ['Lunar Park', 'Low gravity crowd.', 8000, 'park', '#cfd6e6'],
    ['Boardwalk', 'Hit it into the sea.', 3000, 'park', '#ff9e6b'],
  ],
  // playable batters: Tung Tung is yours from the start; the rest are earned, bought or swapped in later
  shopTeams: [
    ['Tung Tung Tung Sahur', 'Number 67. The log is the bat.', 0, 'bat', '#8a5a2b'],
    ['Chimpanzini Bananini', 'Peels off the fastball.', 2500, 'star', '#ffd23d'],
    ['Lirilì Larilà', 'Swings in his own time.', 2500, 'star', '#c9b48a'],
    ['Brr Brr Patapim', 'Branches everywhere.', 2500, 'star', '#4fc46a'],
    ['Cappuccino Assassino', 'One swing, one espresso.', 2500, 'star', '#6b3f1d'],
  ],
};
function renderShop() {
  for (const id in SHOP) {
    const el = $(id);
    el.textContent = '';
    SHOP[id].forEach((it) => {
      const d = document.createElement('div');
      d.className = 'item';
      const art = document.createElement('div');
      art.className = 'art';
      art.style.background = it[4];
      art.innerHTML = ic(it[3], 40);
      const soon = document.createElement('span');
      soon.className = 'soon';
      soon.innerHTML = ic('lock', 12);
      soon.append('SOON');
      const b = document.createElement('b');
      b.textContent = it[0];
      const s = document.createElement('small');
      s.textContent = it[1];
      const pr = document.createElement('span');
      pr.className = 'price';
      if (it[2]) {
        const c = document.createElement('i');
        c.className = 'coin';
        pr.append(c, fmt(it[2]));
      } else pr.textContent = 'PRIZE ONLY';
      d.append(art, soon, b, s, pr);
      el.append(d);
    });
  }
}
/* ---------- awards tab: achievements with progress, and the pitcher cards ---------- */
function setAwardsView(view) {
  document.querySelectorAll('[data-awards]').forEach((b) => b.classList.toggle('sel', b.dataset.awards === view));
  $('awGoals').hidden = view !== 'goals';
  $('cardList').hidden = view !== 'cards';
}
function renderAwards() {
  const done = ACHIEVEMENTS.filter((a) => career.got.indexOf(a.id) >= 0).length;
  $('capsNote').textContent =
    'You hold ' + caps + (caps === 1 ? ' slice' : ' slices') + ' of pizza. One buys the second chance on strike three. ' + done + ' of ' + ACHIEVEMENTS.length + ' earned. The Daily pays one a day.';
  syncClaimButtons();
  renderAwardList($('awardList'));
}
/* The CLAIM buttons and badges everywhere show what is waiting. */
function syncClaimButtons() {
  const due = unclaimedCaps(career),
    n = career.unclaimed.length,
    label = 'CLAIM ' + due + (due === 1 ? ' SLICE' : ' SLICES');
  ['pgClaim', 'awClaim'].forEach((id) => ($(id).hidden = !due));
  $('pgClaimT').textContent = label;
  $('awClaimT').textContent = label;
  $('awardsBtnN').textContent = n ? n + ' TO CLAIM' : 'Goals';
  $('capsBtn').classList.toggle('due', !!due);
}
/* The accolades waiting to be claimed (daily, day streaks, placings) sit above the achievements. */
function renderAwardList(list) {
  list.textContent = '';
  const pending = career.unclaimed.filter((u) => !ACHIEVEMENTS.some((a) => a.id === u.id));
  if (pending.length) {
    const h = document.createElement('span');
    h.className = 'lbl';
    h.textContent = 'Earned';
    list.append(h);
    pending.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'award ready';
      row.innerHTML = '<div><b></b><small>Ready to claim</small></div><span class="pay">' + ic('pizza', 16) + '+' + u.caps + '</span>';
      row.querySelector('b').textContent = u.title;
      list.append(row);
    });
  }
  let group = '';
  // unfinished first within each group, so the next thing to chase is on top
  ACHIEVEMENTS.forEach((a) => {
    if (a.group !== group) {
      group = a.group;
      const h = document.createElement('span');
      h.className = 'lbl';
      h.textContent = group;
      list.append(h);
    }
    const got = career.got.indexOf(a.id) >= 0,
      ready = got && career.unclaimed.some((u) => u.id === a.id),
      [have, need] = a.progress ? a.progress(career) : [got ? 1 : 0, 1],
      row = document.createElement('div');
    row.className = 'award' + (ready ? ' ready' : got ? ' got' : '');
    const text = document.createElement('div'),
      title = document.createElement('b'),
      what = document.createElement('small'),
      bar = document.createElement('i'),
      fill = document.createElement('i'),
      pay = document.createElement('span');
    title.textContent = a.title;
    what.textContent = a.text + (a.progress && !got && need > 1 ? ' · ' + fmt(have) + '/' + fmt(need) : '');
    bar.className = 'gbar';
    fill.style.width = Math.round((Math.min(have, need) / need) * 100) + '%';
    bar.append(fill);
    text.append(title, what, bar);
    pay.className = 'pay';
    pay.innerHTML = got && !ready ? ic('check', 18) : ic('pizza', 16);
    if (!got || ready) pay.append('+' + a.caps);
    row.append(text, pay);
    list.append(row);
  });
}
function openAwardsSheet() {
  syncClaimButtons();
  renderAwardList($('awList'));
  $('awsheet').hidden = false;
  $('awList').scrollTop = 0;
}

/* Lifetime numbers against one pitcher, as tiles. */
function vsStatsHtml(name) {
  const v = (career.vs && career.vs[name]) || { pa: 0, hits: 0, homers: 0, grands: 0, kos: 0, ks: 0, best: 0, swings: 0, bias: 0 },
    tile = (val, lbl) => '<div><b>' + val + '</b><span>' + lbl + '</span></div>',
    avg = v.pa ? Math.round((v.hits / v.pa) * 1000) : 0,
    lean = swingLean(v);
  return tile(v.pa, 'FACED') + tile(v.pa ? '.' + String(avg).padStart(3, '0') : '-', 'AVG') + tile(v.homers, 'HR') + tile(v.grands, 'SLAMS') + tile(v.kos, 'KOS') + tile(v.ks, 'K') + tile(v.best, 'STREAK') + tile(lean, 'SWING');
}
/* "12 EARLY", "ON TIME" or "8 LATE": the average timing of swings in a record. */
function swingLean(v) {
  if (!v.swings) return '-';
  const ms = Math.round(v.bias / v.swings);
  return Math.abs(ms) < 4 ? 'ON TIME' : Math.abs(ms) + (ms < 0 ? ' EARLY' : ' LATE');
}
/* The career sheet from the pause menu. */
function openStats() {
  const c = career,
    f = $('statFacts'),
    r = $('statRows');
  f.innerHTML = [[fmt(c.best), 'Best streak'], [fmt(c.homers), 'Home runs'], [fmt(c.kos), 'Knockouts']]
    .map(([v, l]) => '<div class="fact"><span class="lbl">' + l + '</span><b>' + v + '</b></div>')
    .join('');
  const avg = c.hits && c.runs ? '.' + String(Math.round((c.hits / Math.max(1, c.hits + (c.swings - c.hits))) * 1000)).padStart(3, '0') : '-';
  r.innerHTML = [['Runs', fmt(c.runs)], ['Hits', fmt(c.hits)], ['Grand slams', fmt(c.grands)], ['Longest ball', bestBomb ? fmt(bestBomb) + ' ft' : '-'], ['HR streak', c.bestHrRun], ['Swing timing', swingLean(c)], ['Daily days', c.dailyDays], ['Achievements', c.got.length + ' / ' + ACHIEVEMENTS.length]]
    .map(([l, v]) => '<div><span>' + l + '</span><b>' + v + '</b></div>')
    .join('');
  $('stats').hidden = false;
}
function renderCards() {
  const cl = $('cardList'),
    pl = $('pracList');
  cl.textContent = '';
  pl.textContent = '';
  PITCHERS.forEach((P, i) => {
    const n = koMap[P.name] || 0,
      src = faceAvatar(lookOf(P, i));
    const mk = (tag, cls) => {
      const d = document.createElement(tag);
      d.className = 'pcard' + cls;
      const im = document.createElement('img');
      im.alt = '';
      im.src = src;
      const w = document.createElement('div'),
        b = document.createElement('b'),
        s = document.createElement('small'),
        e = document.createElement('em');
      b.textContent = P.name;
      s.textContent = P.tag;
      e.textContent = P.final ? 'ENTERS AFTER ' + CFG.MIMIC_MIN_STREAK + ' IN A ROW' : n ? 'KNOCKED OUT ×' + n : CFG.KO.HOMERS + ' HOME RUNS OR 1 GRAND SLAM';
      w.append(b, s, e);
      d.append(im, w);
      return d;
    };
    // the Awards card opens to the lifetime numbers against him
    const card = mk('button', n ? ' ko' : '');
    card.type = 'button';
    card.insertAdjacentHTML('beforeend', '<span class="chev">' + ic('chev', 18) + '</span>');
    const wrap = document.createElement('div'),
      statsBox = document.createElement('div');
    wrap.className = 'pwrap';
    statsBox.className = 'pstats';
    statsBox.hidden = true;
    card.addEventListener('click', () => {
      const open = statsBox.hidden;
      statsBox.hidden = !open;
      card.classList.toggle('open', open);
      if (open) statsBox.innerHTML = vsStatsHtml(P.name);
    });
    wrap.append(card, statsBox);
    cl.append(wrap);
    const pb = mk('button', '');
    pb.type = 'button';
    pb.addEventListener('click', () => startRun('practice', i));
    pl.append(pb);
  });
}
