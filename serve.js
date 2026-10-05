// Tiny static server for play-testing on a phone: `npm run dev`, then open the printed URL on any
// device on the same Wi-Fi. No dependencies. Rebuilds index.html (offline) before serving.
const http = require('http'),
  fs = require('fs'),
  path = require('path'),
  os = require('os'),
  { execSync } = require('child_process');
const PORT = +process.env.PORT || 8080,
  ROOT = __dirname;
execSync('node build.js --offline', { cwd: ROOT, stdio: 'inherit' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '0.0.0.0', () => {
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log('Tung Tung Slam is up:');
    console.log('  this computer  http://localhost:' + PORT + '/');
    ips.forEach((ip) => console.log('  phone on Wi-Fi http://' + ip + ':' + PORT + '/'));
    console.log('Edit src/, then re-run to rebuild. Ranks are off outside claude.ai; everything else works.');
  });
