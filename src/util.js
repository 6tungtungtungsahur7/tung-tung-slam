const $ = (id) => document.getElementById(id);
const stage = $('stage');
if (!window.THREE) {
  $('noGL').hidden = false;
  throw new Error('three.js did not load');
}
const T = THREE,
  PI = Math.PI,
  D = PI / 180;
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  },
  eOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const rnd = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new T.Vector3(x, y, z),
  YA = V(0, 1, 0),
  TV = V(0, 0, 0),
  TV2 = V(0, 0, 0),
  M4 = new T.Matrix4();
/* Scratch vectors for per-frame maths: nothing is allocated, so the garbage collector stays quiet.
   scrReset() at the top of a frame-level function, then sv() hands out vectors that live until the
   next reset. Never keep one across frames: copy it into a vector you own instead. */
const SCRATCH = Array.from({ length: 128 }, () => new T.Vector3());
let scrI = 0;
const scrReset = () => (scrI = 0);
const sv = (x, y, z) => SCRATCH[scrI++ & 127].set(x || 0, y || 0, z || 0);
const svc = (v) => SCRATCH[scrI++ & 127].copy(v);
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('ms_' + k);
      return v === null ? d : v;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('ms_' + k, v);
    } catch (e) {}
  },
  json(k, d) {
    try {
      return JSON.parse(this.get(k, '')) || d;
    } catch (e) {
      return d;
    }
  },
};
function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
/* Today's date as YYYY-MM-DD (UTC). Tests can set window.__today to move the calendar. */
const today = () => (window.__DEV && window.__today) || new Date().toISOString().slice(0, 10);
function isoWeek(d) {
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return d.getUTCFullYear() + '-W' + String(Math.ceil(((d - y0) / 864e5 + 1) / 7)).padStart(2, '0');
}
const eventId = () => isoWeek(new Date()),
  lastEventId = () => isoWeek(new Date(Date.now() - 7 * 864e5));
function nextEventIn() {
  const n = new Date(),
    day = n.getUTCDay() || 7,
    ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + (8 - day)) - n,
    d = Math.floor(ms / 864e5),
    h = Math.floor((ms % 864e5) / 36e5);
  return d ? d + 'd ' + h + 'h' : h + 'h ' + Math.floor((ms % 36e5) / 6e4) + 'm';
}
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
