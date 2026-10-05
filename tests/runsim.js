// Whole-run simulation with the real rules: `node tests/runsim.js`
// How long streaks last, who meets the final boss, home run streaks, coins, and what Rally Caps do to the board.
const { CFG, quantile } = require('./load-rules');
const { playRun, PLAYERS } = require('./player');
const pct = (x) => (x * 100).toFixed(0) + '%';
const N = 10000;

function table(title, o, extra) {
  const rows = [];
  for (const [name, sigma] of PLAYERS) {
    const runs = Array.from({ length: N }, () => playRun(sigma, o)), s = runs.map((r) => r.streak), m = runs.filter((r) => r.metMimic);
    const row = { player: `${name} (±${sigma} ms)`, 'median streak': quantile(s, 0.5), 'top 10%': quantile(s, 0.9), 'top 1%': quantile(s, 0.99), best: Math.max(...s),
      'meets final boss': pct(m.length / N), 'he enters at streak': m.length > 50 ? `${quantile(m.map((r) => r.mimicAt), 0.1)}-${quantile(m.map((r) => r.mimicAt), 0.9)}` : '-',
      knockouts: quantile(runs.map((r) => r.koNames.length), 0.5), 'coins earned': quantile(runs.map((r) => r.coins), 0.5) };
    if (extra) Object.assign(row, extra(runs));
    rows.push(row);
  }
  console.log('\n' + title);
  console.table(rows);
  return rows;
}

const base = table('1. Streak runs, no Rally Caps spent', {}, (runs) => ({
  'home runs / hits': pct(runs.reduce((a, r) => a + r.homers, 0) / runs.reduce((a, r) => a + r.hits, 0)),
  '3 HR in a row': pct(runs.filter((r) => r.bestHrRun >= 3).length / N), '5 in a row': pct(runs.filter((r) => r.bestHrRun >= 5).length / N), '8 in a row': pct(runs.filter((r) => r.bestHrRun >= 8).length / N),
}));
table('2. Camping: aiming off-centre on purpose to avoid knockouts', { aim: true });
table('3. One Rally Cap to spend (one extra chance)', { caps: 1 });
table('4. Six Rally Caps to spend (three extra chances: 1 + 2 + 3)', { caps: 6 });

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL  ' + msg); } };
const row = (name) => base.find((r) => r.player.startsWith(name));
check(row('casual')['median streak'] >= 8 && row('casual')['median streak'] <= 14, 'casual median streak should sit near 10');
check(PLAYERS.every(([n], i) => i === 0 || row(PLAYERS[i - 1][0])['median streak'] > row(n)['median streak']), 'better timing must mean longer streaks');
check(row('elite')['top 1%'] < 200, 'the curve must cap even elite players');
check(parseInt(row('average')['3 HR in a row']) <= 80 && parseInt(row('casual')['3 HR in a row']) <= 40, 'three home runs in a row should be an event, not a habit');
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll run checks passed');
process.exit(failures ? 1 : 0);
