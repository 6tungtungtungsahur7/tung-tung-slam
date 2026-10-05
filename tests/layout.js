// Layout rules, run inside the page by the tests. Returns a list of problems (empty = clean).
// Kept in one place so every test applies the same rules.
function layoutProblems() {
  const stage = document.getElementById('stage').getBoundingClientRect();
  const out = [];
  const shown = (el) => {
    if (!el || el.hidden || el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el),
      r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 1 && r.height > 1;
  };
  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const name = (el) => (el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) + (el.id ? '' : ' "' + el.textContent.trim().slice(0, 14) + '"');
  /* how many lines an element's own text (not its children's) takes */
  const ownLines = (el) => {
    const tops = new Set();
    el.childNodes.forEach((n) => {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) return;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0.5) tops.add(Math.round(r.top / 4));
    });
    return tops.size;
  };

  // 1. while a pitch is live, only the target and ring may sit in the ball's path
  if (window.__ms.live) {
    const lane = window.__ms.corridor();
    document.querySelectorAll('#call, #banner, #dist, #verdict, #hrTag, .bug, #pauseBtn, #lobby, .ovl, .bub').forEach((el) => {
      if (shown(el) && hits(el.getBoundingClientRect(), lane)) out.push(name(el) + ' covers the ball path');
    });
  }
  // 2. HUD pieces stay on screen, off each other, and sit the same distance from both edges
  const bug = document.querySelector('.bug'),
    pause = document.getElementById('pauseBtn'),
    hud = [bug, pause].filter(shown);
  hud.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.left < stage.left - 0.5 || r.right > stage.right + 0.5 || r.top < stage.top - 0.5 || r.bottom > stage.bottom + 0.5) out.push(name(el) + ' runs off the screen');
  });
  if (hud.length === 2) {
    const a = bug.getBoundingClientRect(),
      b = pause.getBoundingClientRect();
    if (hits(a, b)) out.push('scorebug overlaps the pause button');
    if (Math.abs(a.left - stage.left - (stage.right - b.right)) > 1.5) out.push('scorebug and pause button have different side margins');
    if (Math.abs(a.top - b.top) > 6) out.push('scorebug and pause button are not on one line');
  }
  // speech never sits on an announcement or the HUD: one voice at a time
  document.querySelectorAll('.bub').forEach((b) => {
    if (!shown(b)) return;
    const r = b.getBoundingClientRect();
    ['banner', 'call', 'hrTag', 'dist'].forEach((id) => {
      const el = document.getElementById(id);
      if (shown(el) && hits(r, el.getBoundingClientRect())) out.push(name(b) + ' overlaps #' + id);
    });
    if (shown(bug) && hits(r, bug.getBoundingClientRect())) out.push(name(b) + ' overlaps the scorebug');
    if (r.left < stage.left || r.right > stage.right) out.push(name(b) + ' runs off the screen');
  });
  const tag = document.getElementById('hrTag');
  if (shown(tag)) {
    const r = tag.getBoundingClientRect();
    if (r.left < stage.left || r.right > stage.right) out.push('#hrTag runs off the screen');
    if (shown(pause) && hits(r, pause.getBoundingClientRect())) out.push('#hrTag overlaps the pause button');
  }
  // 3. nothing is cut off: text fits its box, children stay inside their card
  document.querySelectorAll('#vs, #hStreak, #hLbl, .fact b, .fact .lbl, .ev b, .ev small, .tag, #verdict, .rib, .btn, .tog, .tab, .vrow b, .pcard b, #banner b').forEach((el) => {
    if (shown(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push(name(el) + ' text is cut off');
  });
  document.querySelectorAll('.bug, .sheet, #banner, .ev, .item, .pcard, .fact, .award, .trow, .topbar, .box').forEach((box) => {
    if (!shown(box)) return;
    const b = box.getBoundingClientRect();
    box.querySelectorAll('b, span, small, p, label, input, button').forEach((el) => {
      if (!shown(el) || el.classList.contains('tag') || el.classList.contains('rib') || el.classList.contains('soon') || el.classList.contains('xbtn')) return;
      const r = el.getBoundingClientRect();
      if (r.left < b.left - 0.5 || r.right > b.right + 0.5) out.push(name(el) + ' spills out of ' + name(box));
    });
  });
  if (shown(document.getElementById('verdict'))) {
    const r = document.getElementById('verdict').getBoundingClientRect();
    if (r.left < stage.left || r.right > stage.right) out.push('#verdict runs off the screen');
  }
  // text keeps clear of the edge of its button or tile
  document.querySelectorAll('.btn, .tog, .fact, .tab, .ev, .seg button').forEach((box) => {
    if (!shown(box)) return;
    const b = box.getBoundingClientRect();
    box.querySelectorAll('*').forEach((el) => {
      if (!shown(el) || el.classList.contains('tag') || !el.textContent.trim() || el.children.length) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r.width && (r.left < b.left + 3 || r.right > b.right - 3)) out.push(name(el) + ' touches the edge of ' + name(box));
    });
    [...box.childNodes].forEach((n) => {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) return;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.left < b.left + 3 || r.right > b.right - 3) out.push(name(box) + ' label touches its own edge');
    });
  });
  // values and labels in a row of tiles each stay on one line, so the row reads level
  document.querySelectorAll('.fact b, .fact .lbl, .rib, #verdict, #vs, .vrow b, .vrow .lbl, #banner b, .board .st, .trow b, .trow span, .award b, #hrTag em, .coins b').forEach((el) => {
    if (shown(el) && ownLines(el) > 1) out.push(name(el) + ' wraps onto ' + ownLines(el) + ' lines');
  });
  // a short name must show whole, and a card's corner tag must not sit on its other contents
  const pn = document.getElementById('pName');
  if (shown(pn) && pn.textContent.length <= 6) {
    const range = document.createRange();
    range.selectNodeContents(pn);
    if (range.getBoundingClientRect().width > pn.getBoundingClientRect().width + 0.5) out.push('#pName is cut off: "' + pn.textContent + '"');
  }
  document.querySelectorAll('.ev, #playBtn').forEach((card) => {
    const tagEl = card.querySelector('.tag');
    if (!shown(card) || !shown(tagEl)) return;
    const t = tagEl.getBoundingClientRect();
    card.querySelectorAll('b, small, .days, .pl').forEach((el) => {
      if (!shown(el)) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      if (hits(range.getBoundingClientRect(), t)) out.push(name(tagEl) + ' sits on ' + name(el));
    });
  });
  // 4. buttons: big enough to tap, label on one line, pairs match
  document.querySelectorAll('button').forEach((b) => {
    if (!shown(b)) return;
    const r = b.getBoundingClientRect();
    if (r.width < 44 || r.height < 40) out.push('button ' + name(b) + ' is ' + Math.round(r.width) + 'x' + Math.round(r.height));
    // a label and its small sub-label may stack, but neither may wrap
    if (b.matches('.btn, .tog, .tab, .ev')) [b, ...b.querySelectorAll('*')].forEach((part) => {
      if (ownLines(part) > 1 && !part.matches('.ev b, .ev small')) out.push('button ' + name(b) + ' label wraps onto ' + ownLines(part) + ' lines');
    });
  });
  document.querySelectorAll('.acts').forEach((row) => {
    const kids = [...row.children].filter(shown).map((k) => k.getBoundingClientRect());
    if (kids.length > 1 && (Math.max(...kids.map((k) => k.height)) - Math.min(...kids.map((k) => k.height)) > 1 || Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)) > 1))
      out.push('side-by-side buttons differ in height or position');
  });
  // 5. sheets: fit without scrolling, sit in the middle, and are not stretched edge to edge
  document.querySelectorAll('.ovl').forEach((o) => {
    if (!shown(o)) return;
    const s = o.querySelector('.sheet').getBoundingClientRect();
    if (o.scrollHeight > o.clientHeight + 1) out.push(name(o) + ' needs scrolling (' + o.scrollHeight + ' > ' + o.clientHeight + ')');
    if (Math.abs(s.left + s.width / 2 - (stage.left + stage.width / 2)) > 1.5) out.push(name(o) + ' sheet is off centre');
    if (s.width > stage.width * 0.86 + 1 || s.width > 302) out.push(name(o) + ' sheet is ' + Math.round(s.width) + ' px wide (limit 84% / 300)');
    if (s.top < stage.top + 4 || s.bottom > stage.bottom - 4) out.push(name(o) + ' sheet touches the screen edge');
  });
  // 6. centred things are centred
  document.querySelectorAll('.sheet > .rib, .sheet .score, #call, #banner, #dist, .logo').forEach((el) => {
    if (!shown(el)) return;
    const r = el.getBoundingClientRect(),
      box = (el.closest('.sheet') || document.getElementById('stage')).getBoundingClientRect();
    if (Math.abs(r.left + r.width / 2 - (box.left + box.width / 2)) > 2.5) out.push(name(el) + ' is ' + Math.round(r.left + r.width / 2 - (box.left + box.width / 2)) + ' px off centre');
  });
  return out;
}
module.exports = { layoutProblems };
