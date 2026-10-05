/* ---------- share: a card to save and a caption to copy ---------- */
let cardCanvas = null;
function buildCard() {
  const c = cardCanvas || (cardCanvas = document.createElement('canvas'));
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d'),
    nin = run.mode === 'ninth';
  const paint = (img) => {
    const gr = g.createLinearGradient(0, 0, 0, 1350);
    gr.addColorStop(0, '#2e2370');
    gr.addColorStop(0.5, '#d65d8e');
    gr.addColorStop(1, '#ffb680');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1080, 1350);
    if (img) {
      const s = Math.max(1080 / img.width, 1350 / img.height),
        w = img.width * s,
        h = img.height * s;
      g.drawImage(img, (1080 - w) / 2, (1350 - h) / 2, w, h);
    }
    const sh = g.createLinearGradient(0, 0, 0, 1350);
    sh.addColorStop(0, 'rgba(22,12,46,.82)');
    sh.addColorStop(0.3, 'rgba(22,12,46,.1)');
    sh.addColorStop(0.5, 'rgba(22,12,46,.4)');
    sh.addColorStop(1, 'rgba(22,12,46,.96)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 1080, 1350);
    const D1 = '"Bungee","Impact",sans-serif',
      D2 = '700 52px "Barlow Condensed","Arial Narrow",sans-serif';
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = '#fff6e0';
    g.font = '64px ' + D1;
    g.fillText('TUNG TUNG SLAM', 64, 120);
    g.fillStyle = '#ffc83d';
    g.fillText('STREAK', 64, 186);
    g.textAlign = 'right';
    g.fillStyle = '#fff6e0';
    g.font = D2;
    g.fillText(nin ? 'BOTTOM OF THE 9TH' : run.mode === 'daily' ? 'DAILY PITCH' : 'STREAK RUN', 1016, 112);
    g.fillText(nin ? run.event : today(), 1016, 170);
    g.textAlign = 'left';
    g.fillStyle = '#ffc83d';
    g.font = (nin ? '250px ' : '340px ') + D1;
    g.fillText(nin ? fmt(run.feet) : String(run.streak), 56, 980, 968);
    g.fillStyle = '#fff6e0';
    g.font = '66px ' + D1;
    g.fillText(nin ? 'FEET IN 3 PITCHES' : 'IN A ROW', 64, 1062);
    g.font = D2;
    let y = 1150;
    if (nin) {
      g.fillText(run.shots.map((s) => (s ? s + ' FT' : '0')).join('  ·  '), 64, y, 950);
      y += 64;
    } else if (run.bomb) {
      g.fillText('LONG BALL ' + run.bomb + ' FT' + ' · ' + zoneLabel(run.bomb), 64, y, 950);
      y += 64;
    }
    if (run.kos.length) {
      g.fillText('KNOCKED OUT: ' + run.kos.join(', '), 64, y, 950);
      y += 64;
    }
    g.fillStyle = 'rgba(255,246,224,.78)';
    if (run.got) g.fillText(run.got, 64, y, 950);
    try {
      $('cardImg').src = c.toDataURL('image/jpeg', 0.86);
    } catch (e) {}
  };
  if (run.snap) {
    const im = new Image();
    im.onload = () => paint(im);
    im.onerror = () => paint(null);
    im.src = run.snap;
  } else paint(null);
}
const bragText = () =>
  run.mode === 'ninth'
    ? 'Bottom of the 9th in Tung Tung Slam: ' + fmt(run.feet) + ' ft in 3 pitches. One shot a week. Beat that.'
    : 'I hit ' +
      run.streak +
      ' in a row in Tung Tung Slam' +
      (run.bomb ? ' and sent one ' + run.bomb + ' ft' : '') +
      (run.kos.length ? '. Knocked out ' + run.kos.join(', ') : '') +
      (run.mode === 'streak' ? '. Same pitches, your turn: code ' + runCode() : '. Beat that.');
