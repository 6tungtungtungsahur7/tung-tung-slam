// Loads src/config.js and src/rules.js into Node so tests can call the real rules.
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const prelude = `
  const PI = Math.PI;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
`;
const names = ['CFG', 'TYPES', 'PITCHERS', 'GHOST', 'HOMER_ZONES', 'GRAND_ZONES', 'MIMIC_LEARNS', 'BLUFFS', 'BLUFF_TRUTH',
  'windowsAt', 'fastballAt', 'styleOf', 'buildProgress', 'ghostAlpha', 'makePitch', 'bluffFor', 'judgeSwing', 'homerFeet',
  'zoneOf', 'pitcherLeaves', 'coinsFor', 'knockoutCoins', 'chanceCaps', 'hrTier', 'hrCoinMult', 'divisionOf', 'percentileOf', 'makeCode', 'readCode',
  'newCareer', 'ACHIEVEMENTS', 'ACCOLADES', 'BEST_ACCOLADE_MIN', 'achievementDone', 'claimAchievements', 'recordRun', 'nextGoal', 'dayStreakAfter', 'dayStreakAccolade'];
module.exports = new Function(prelude + read('config.js') + read('rules.js') + read('awards.js') + '; return { ' + names.join(', ') + ' };')();
module.exports.gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
module.exports.quantile = (xs, f) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) * f)];
