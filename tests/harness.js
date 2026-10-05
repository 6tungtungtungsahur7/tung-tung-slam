// Shared test harness: opens the built page in headless Chromium with the 3D engine inlined
// (the sandbox cannot reach the CDN) and the game's dev hooks switched on.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const THREE_SRC = path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js');
const CDN_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';

/* The game's two typefaces, inlined: text must be measured with the real fonts, not a fallback. */
function fontFaces() {
  const face = (family, weight, file) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${fs
      .readFileSync(path.join(ROOT, 'node_modules', '@fontsource', file))
      .toString('base64')}) format("woff2")}`;
  return (
    face('Bungee', 400, 'bungee/files/bungee-latin-400-normal.woff2') +
    face('Barlow Condensed', 500, 'barlow-condensed/files/barlow-condensed-latin-500-normal.woff2') +
    face('Barlow Condensed', 700, 'barlow-condensed/files/barlow-condensed-latin-700-normal.woff2')
  );
}

function writeTestPage() {
  const three = fs.readFileSync(THREE_SRC, 'utf8').replace(/<\/script>/g, '<\\/script>');
  const body = fs
    .readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(CDN_TAG, `<script>window.__DEV=true</script><script>${three}</script>`);
  const shell =
    '<!doctype html><html><head><meta charset=utf8>' +
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<style>' + fontFaces() + 'body{margin:0}[hidden]{display:none!important}</style></head><body>';
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'page.html');
  fs.writeFileSync(file, shell + body + '</body></html>');
  return file;
}

async function open(width = 390, height = 844) {
  const file = writeTestPage();
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' ' + String(e.stack || '').split('\n')[1]));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto('file://' + file);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { browser, page, errors };
}

// Makes the bot swing on every pitch. window.__botPlan is a list, one entry per pitch:
//   a number   timing error in ms (0 = dead on, negative = early, positive = late)
//   null       take the pitch without swinging
//   { kind: 'homer' | 'hit' | 'foul', f: 0..1, sign: -1 | 1 }
//              land inside that outcome's window, f of the way across it, whatever the windows are right now
async function installBot(page) {
  await page.evaluate(() => {
    const stage = document.getElementById('stage');
    window.__botPlan = window.__botPlan || [];
    window.__botDefault = 0;
    let armedFor = -1;
    const loop = () => {
      const ms = window.__ms;
      if (ms.state === 'flight' && armedFor !== ms.pitchCount) {
        armedFor = ms.pitchCount;
        let planned = window.__botPlan.length ? window.__botPlan.shift() : window.__botDefault;
        if (planned && typeof planned === 'object') {
          const w = ms.windows,
            lo = planned.kind === 'homer' ? ms.cfg.GRAND_MS + 1 : planned.kind === 'hit' ? w[0] + 1 : w[1] + 1,
            hi = planned.kind === 'homer' ? w[0] : planned.kind === 'hit' ? w[1] : w[2];
          planned = (planned.sign || 1) * (lo + (hi - lo - 0.5) * planned.f);
        }
        if (planned !== null) {
          window.__forceDelta = planned;
          window.__botSwingAt = true;
        } else window.__botSwingAt = false;
      }
      if (ms.state === 'flight' && window.__botSwingAt && ms.eta !== null && ms.eta <= 0) {
        window.__botSwingAt = false;
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

module.exports = { open, installBot, shot, writeTestPage, OUT, ROOT };
