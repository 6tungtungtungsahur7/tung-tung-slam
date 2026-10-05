// Build: joins src/ into one self-contained page. Run `node build.js` after any edit.
//   node build.js            index.html for the web: three.js and the fonts come from CDNs
//   node build.js --offline  index.html that works from a file:// URL or a LAN server with no network:
//                            three.js and both typefaces are inlined (about 900 KB)
const fs = require('fs'), path = require('path');
const OFFLINE = process.argv.includes('--offline');
const ORDER = ['util', 'config', 'rules', 'awards', 'world', 'figures', 'town', 'fx', 'audio', 'state', 'progress', 'feedback', 'game', 'payoff', 'cutscene', 'update', 'render', 'boards', 'share', 'lobby', 'settings', 'main'];
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ORDER.filter(n => fs.existsSync(path.join(__dirname, 'src', n + '.js')))
  .map(n => `/* ================= ${n}.js ================= */\n${src(n + '.js')}`).join('\n');
const mod = (...p) => path.join(__dirname, 'node_modules', ...p);
function fontFaces() {
  const face = (family, weight, file) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${fs.readFileSync(mod('@fontsource', file)).toString('base64')}) format("woff2")}`;
  return face('Bungee', 400, 'bungee/files/bungee-latin-400-normal.woff2') +
    face('Barlow Condensed', 500, 'barlow-condensed/files/barlow-condensed-latin-500-normal.woff2') +
    face('Barlow Condensed', 700, 'barlow-condensed/files/barlow-condensed-latin-700-normal.woff2');
}
const fonts = OFFLINE
  ? `<style>${fontFaces()}</style>`
  : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=Barlow+Condensed:wght@500;700&display=swap">';
const three = OFFLINE
  ? `<script>${fs.readFileSync(mod('three', 'build', 'three.min.js'), 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`
  : '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
const page = `<title>Tung Tung Slam</title>
${fonts}
<style>
${src('style.css')}</style>

${src('body.html')}
${three}
<script>
(() => {
'use strict';
${js}
})();
</script>
`;
const shell = OFFLINE
  ? '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><style>html,body{margin:0;height:100%;background:#1a0f08;overflow:hidden}[hidden]{display:none!important}</style></head><body>'
  : '';
fs.writeFileSync(path.join(__dirname, 'index.html'), shell + page + (OFFLINE ? '</body></html>' : ''));
console.log('built index.html' + (OFFLINE ? ' (offline)' : ''), ((shell + page).length / 1024).toFixed(0) + ' KB', page.split('\n').length + ' lines');
